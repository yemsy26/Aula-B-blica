package org.verbovivo.app;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.StatFs;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * Motor GGUF nativo de VerboVivo.
 *
 * Usa llama.cpp compilado con el NDK (ARM64 y x86_64), no WebAssembly. La
 * descarga de modelos también vive aquí: llama.cpp necesita una ruta real en
 * el sistema de archivos, y los archivos de OPFS no son accesibles desde C++.
 *
 * El modelo se guarda en filesDir/models, propiedad de la app. Ningún archivo
 * sale del dispositivo.
 */
@CapacitorPlugin(name = "LlamaNative")
public class LlamaNativePlugin extends Plugin {

    private static final String MODELS_DIR = "models";
    private static final long PROGRESS_INTERVAL_MS = 180L;
    private static final int FINISH_EOS = 1;
    private static final int FINISH_LENGTH = 2;
    private static final int FINISH_ABORT = 3;
    private static final int FINISH_ERROR = 4;

    // Un cierre nativo (SIGSEGV del driver Vulkan/Hexagon) no puede capturarse
    // con try/catch: el proceso muere. Antes de cada intento dejamos un
    // marcador síncrono; si al arrancar sigue ahí y Android registró un fallo
    // nativo, ese acelerador se pone en cuarentena y no vuelve a intentarse.
    private static final String ACCEL_PREFS = "verbovivo_acceleration";
    private static final String KEY_PENDING_TARGET = "pending_target";
    private static final String KEY_PENDING_PHASE = "pending_phase";
    private static final String KEY_PENDING_FILE = "pending_file";
    private static final String KEY_PENDING_AT = "pending_at";
    private static final String PREFIX_FAILED = "failed_";
    private static final String PREFIX_REASON = "failed_reason_";
    private static final String PREFIX_PHASE = "failed_phase_";
    private static final String PREFIX_AT = "failed_at_";

    private static final String TARGET_CPU = "cpu";
    private static final String TARGET_NPU = "npu";
    private static final String TARGET_GPU = "gpu";

    private static final int JNI_TARGET_CPU = 0;
    private static final int JNI_TARGET_NPU = 1;
    private static final int JNI_TARGET_GPU = 2;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .followRedirects(true)
            .followSslRedirects(true)
            .retryOnConnectionFailure(true)
            .build();

    private final ExecutorService inferenceExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService downloadExecutor = Executors.newCachedThreadPool();
    private final Map<String, DownloadJob> downloads = new ConcurrentHashMap<>();

    private volatile String loadedFileName = null;
    private volatile String activeTarget = TARGET_CPU;
    private boolean recoveryDone = false;
    private boolean probedGpu = false;
    private boolean probedNpu = false;

    private static class DownloadJob {
        final String fileName;
        volatile boolean cancelled = false;
        volatile boolean paused = false;
        volatile Call httpCall = null;

        DownloadJob(String fileName) {
            this.fileName = fileName;
        }
    }

    @Override
    public void load() {
        recoverInterruptedAttempt();
    }

    // ---------------------------------------------------------------------
    // Información del dispositivo y del runtime
    // ---------------------------------------------------------------------

    @PluginMethod
    public void getInfo(PluginCall call) {
        recoverInterruptedAttempt();

        JSObject info = new JSObject();
        info.put("available", LlamaJni.AVAILABLE);
        info.put("abi", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "desconocido");
        info.put("supportedAbis", new JSArray());
        info.put("cores", Runtime.getRuntime().availableProcessors());
        info.put("recommendedThreads", recommendedThreads());
        info.put("totalRamMb", totalRamMb());
        info.put("freeStorageMb", freeStorageMb());
        info.put("ready", LlamaJni.isLoaded());
        info.put("loadedFileName", loadedFileName == null ? "" : loadedFileName);
        if (LlamaJni.AVAILABLE) {
            try {
                info.put("runtime", LlamaJni.nativeSystemInfo());
            } catch (Throwable error) {
                info.put("runtime", "llama.cpp nativo disponible");
            }
            JSONObject gpu = gpuInfo();
            info.put("gpu", gpu);
            JSONObject npu = npuInfo();
            info.put("npu", npu);
            JSONObject load = loadInfo();
            info.put("acceleration", load.optString("acceleration", "cpu"));
            info.put("gpuLayers", load.optInt("gpuLayers", 0));
            info.put("gpuFallback", load.optBoolean("gpuFallback", false));
            info.put("npuFallback", load.optBoolean("npuFallback", false));
            info.put("npuError", load.optString("npuError", ""));
            info.put("accelerationPolicy", accelerationPolicy(gpu, npu));
        }
        info.put("models", listModelsArray());

        JSArray abis = new JSArray();
        for (String abi : Build.SUPPORTED_ABIS) abis.put(abi);
        info.put("supportedAbis", abis);

        call.resolve(info);
    }

    @PluginMethod
    public void listModels(PluginCall call) {
        JSObject result = new JSObject();
        result.put("models", listModelsArray());
        call.resolve(result);
    }

    private JSArray listModelsArray() {
        JSArray models = new JSArray();
        File dir = modelsDir();
        File[] files = dir.listFiles();
        if (files == null) return models;

        for (File file : files) {
            if (!file.isFile() || !file.getName().endsWith(".gguf")) continue;
            JSObject item = new JSObject();
            item.put("fileName", file.getName());
            item.put("sizeBytes", file.length());
            models.put(item);
        }
        return models;
    }

    /**
     * Dispositivo Vulkan detectado por llama.cpp. `usable` es false cuando el
     * driver es un rasterizador de software (SwiftShader/llvmpipe) o cuando el
     * backend no admite offload; en ese caso no se miente sobre la aceleración.
     */
    private JSONObject gpuInfo() {
        if (!LlamaJni.AVAILABLE) return new JSONObject();
        recoverInterruptedAttempt();

        // Si la enumeración Vulkan fue lo que cerró la app, no se repite en
        // este proceso: el simple hecho de volver a tocar el driver podría
        // cerrarla otra vez antes de que el usuario vea nada.
        if ("probe".equals(quarantinePhase(TARGET_GPU))) {
            return quarantinedProbeInfo(TARGET_GPU);
        }

        boolean marker = false;
        if (!probedGpu) {
            probedGpu = true;
            beginAttempt(TARGET_GPU, "probe", "");
            marker = true;
        }

        try {
            return new JSONObject(LlamaJni.nativeGpuInfo());
        } catch (Throwable error) {
            JSONObject fallback = new JSONObject();
            try {
                fallback.put("available", false);
                fallback.put("usable", false);
                fallback.put("software", false);
                fallback.put("name", "");
                fallback.put("description", "");
                fallback.put("error", safeMessage(error));
            } catch (Throwable ignored) {
                // JSONObject.put declara JSONException; sin datos tampoco pasa nada.
            }
            return fallback;
        } finally {
            if (marker) clearPendingAttempt();
        }
    }

    private JSONObject loadInfo() {
        if (!LlamaJni.AVAILABLE) return new JSONObject();
        try {
            return new JSONObject(LlamaJni.nativeLoadInfo());
        } catch (Throwable error) {
            return new JSONObject();
        }
    }

    /**
     * NPU Hexagon detectada por llama.cpp. Solo es `usable` en Snapdragon con
     * Hexagon v73–v85 y cuando el APK incluye las bibliotecas del DSP; en el
     * resto de equipos se explica el motivo y se cae a Vulkan o CPU.
     */
    private JSONObject npuInfo() {
        if (!LlamaJni.AVAILABLE) return new JSONObject();
        recoverInterruptedAttempt();

        // Abrir una sesión FastRPC también puede tumbar el proceso si el DSP o
        // el firmware no responden; no se reintenta la sonda que ya falló.
        if ("probe".equals(quarantinePhase(TARGET_NPU))) {
            return quarantinedProbeInfo(TARGET_NPU);
        }

        boolean marker = false;
        if (!probedNpu) {
            probedNpu = true;
            beginAttempt(TARGET_NPU, "probe", "");
            marker = true;
        }

        try {
            return new JSONObject(LlamaJni.nativeNpuInfo());
        } catch (Throwable error) {
            JSONObject fallback = new JSONObject();
            try {
                fallback.put("available", false);
                fallback.put("usable", false);
                fallback.put("arch", 0);
                fallback.put("name", "");
                fallback.put("reason", "No se pudo consultar la NPU: " + safeMessage(error));
            } catch (Throwable ignored) {
                // Igual que en gpuInfo(): sin datos no hay nada que anunciar.
            }
            return fallback;
        } finally {
            if (marker) clearPendingAttempt();
        }
    }

    private int recommendedThreads() {
        int cores = Runtime.getRuntime().availableProcessors();
        if (cores <= 2) return 1;
        // Medido en el emulador x86_64: 2 hilos = 30.7 s de prefill para 465
        // tokens, 3 hilos = 21.0 s, 4 hilos = 17.0 s. Dejamos un núcleo para
        // la interfaz y la síntesis de voz; en big.LITTLE, seis hilos es el
        // máximo razonable para evitar sobrecalentamiento.
        return Math.max(2, Math.min(6, cores - 1));
    }

    private long totalRamMb() {
        try {
            ActivityManager manager =
                    (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (manager == null) return 0;
            ActivityManager.MemoryInfo info = new ActivityManager.MemoryInfo();
            manager.getMemoryInfo(info);
            return info.totalMem / (1024L * 1024L);
        } catch (Throwable error) {
            return 0;
        }
    }

    private long freeStorageMb() {
        try {
            StatFs stat = new StatFs(getContext().getFilesDir().getAbsolutePath());
            return stat.getAvailableBytes() / (1024L * 1024L);
        } catch (Throwable error) {
            return 0;
        }
    }

    private File modelsDir() {
        File dir = new File(getContext().getFilesDir(), MODELS_DIR);
        if (!dir.exists() && !dir.mkdirs()) {
            // La descarga fallará con un error explícito; no ocultamos el fallo.
        }
        return dir;
    }

    // ---------------------------------------------------------------------
    // Descarga y almacenamiento del GGUF
    // ---------------------------------------------------------------------

    @PluginMethod
    public void downloadModel(PluginCall call) {
        if (!LlamaJni.AVAILABLE) {
            call.reject("El motor nativo no está disponible en este APK/ABI.");
            return;
        }

        final String fileName = sanitizeFileName(call.getString("fileName"));
        final String url = call.getString("url");
        if (fileName == null) {
            call.reject("Nombre de archivo inválido.");
            return;
        }
        if (url == null || url.trim().isEmpty()) {
            call.reject("El catálogo no define una URL de descarga.");
            return;
        }

        if (downloads.containsKey(fileName)) {
            call.reject("Ya hay una descarga en curso para " + fileName + ".");
            return;
        }

        DownloadJob job = new DownloadJob(fileName);
        downloads.put(fileName, job);
        call.setKeepAlive(true);

        final long expectedBytes = call.getLong("expectedBytes", 0L);
        final String expectedSha = call.getString("sha256", "");

        downloadExecutor.execute(() -> runDownload(call, job, url.trim(), expectedBytes, expectedSha));
    }

    private void runDownload(
            PluginCall call,
            DownloadJob job,
            String url,
            long expectedBytes,
            String expectedSha) {
        File finalFile = new File(modelsDir(), job.fileName);
        File partFile = new File(modelsDir(), job.fileName + ".part");
        long initialBytes = partFile.isFile() ? partFile.length() : 0L;

        try {
            if (expectedBytes > 0 && freeStorageMb() * 1024L * 1024L < expectedBytes + 64L * 1024L * 1024L) {
                call.reject("No hay espacio libre suficiente para descargar este modelo.");
                return;
            }

            if (expectedBytes > 0 && initialBytes > expectedBytes) {
                deleteQuietly(partFile);
                initialBytes = 0L;
            }

            // Re-descarga explícita: si ya existe un archivo final y no hay
            // bloques parciales, empezamos de cero.
            if (!partFile.exists() && finalFile.exists()) {
                deleteQuietly(finalFile);
            }

            Request.Builder builder = new Request.Builder()
                    .url(url)
                    .header("Accept-Encoding", "identity")
                    .header("User-Agent", "VerboVivo/1.0 (Android)");
            if (initialBytes > 0) {
                builder.header("Range", "bytes=" + initialBytes + "-");
            }

            Request request = builder.build();
            Call httpCall = httpClient.newCall(request);
            job.httpCall = httpCall;

            try (Response response = httpCall.execute()) {
                if (job.cancelled) {
                    deleteQuietly(partFile);
                    resolveCancelled(call);
                    return;
                }
                if (job.paused) {
                    resolvePaused(call, initialBytes);
                    return;
                }

                if (response.code() == 416) {
                    if (expectedBytes > 0 && initialBytes == expectedBytes) {
                        completeDownload(call, job, partFile, finalFile, expectedSha, expectedBytes);
                    } else {
                        deleteQuietly(partFile);
                        call.reject("El servidor rechazó la reanudación. Vuelve a iniciar la descarga.");
                    }
                    return;
                }

                if (!response.isSuccessful()) {
                    call.reject("El servidor respondió HTTP " + response.code() + " al descargar el modelo.");
                    return;
                }

                ResponseBody body = response.body();
                if (body == null) {
                    call.reject("La respuesta del servidor no contiene el archivo.");
                    return;
                }

                boolean resumed = response.code() == 206;
                if (!resumed) {
                    // El servidor ignoró Range: reiniciamos para no duplicar bytes.
                    initialBytes = 0L;
                    deleteQuietly(partFile);
                }

                long contentLength = body.contentLength();
                long totalBytes = contentLength >= 0 ? initialBytes + contentLength : expectedBytes;
                long received = initialBytes;
                long lastNotify = 0L;

                emitDownloadProgress(job.fileName, received, totalBytes, "downloading", false, null);

                try (InputStream input = new BufferedInputStream(body.byteStream());
                     FileOutputStream output = new FileOutputStream(partFile, resumed)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;

                    while ((read = input.read(buffer)) != -1) {
                        if (job.cancelled) {
                            output.flush();
                            deleteQuietly(partFile);
                            resolveCancelled(call);
                            return;
                        }
                        if (job.paused) {
                            output.flush();
                            resolvePaused(call, received);
                            return;
                        }

                        output.write(buffer, 0, read);
                        received += read;

                        long now = System.currentTimeMillis();
                        if (now - lastNotify >= PROGRESS_INTERVAL_MS) {
                            lastNotify = now;
                            emitDownloadProgress(
                                    job.fileName, received, totalBytes, "downloading", false, null);
                        }
                    }
                }

                if (contentLength >= 0 && received - initialBytes != contentLength) {
                    call.reject(
                            "La descarga llegó incompleta: " + (received - initialBytes) + " de " +
                                    contentLength + " bytes. El bloque parcial queda para reanudar.");
                    return;
                }

                emitDownloadProgress(job.fileName, received, totalBytes, "verifying", false, null);
                completeDownload(call, job, partFile, finalFile, expectedSha, received);
            }
        } catch (IOException error) {
            if (job.cancelled) {
                deleteQuietly(partFile);
                resolveCancelled(call);
                return;
            }
            if (job.paused) {
                resolvePaused(call, partFile.isFile() ? partFile.length() : 0L);
                return;
            }
            call.reject("La descarga falló: " + safeMessage(error));
        } catch (Throwable error) {
            if (job.cancelled) {
                deleteQuietly(partFile);
                resolveCancelled(call);
                return;
            }
            call.reject("La descarga falló: " + safeMessage(error));
        } finally {
            job.httpCall = null;
            downloads.remove(job.fileName);
        }
    }

    private void completeDownload(
            PluginCall call,
            DownloadJob job,
            File partFile,
            File finalFile,
            String expectedSha,
            long sizeBytes) {
        try {
            if (finalFile.exists() && !deleteQuietly(finalFile)) {
                call.reject("No se pudo reemplazar el modelo anterior.");
                return;
            }

            if (!partFile.renameTo(finalFile)) {
                // Algunos sistemas de archivos no permiten rename entre
                // estados; copiamos y luego borramos el parcial.
                copyFile(partFile, finalFile);
                deleteQuietly(partFile);
            }

            if (expectedSha != null && !expectedSha.trim().isEmpty()) {
                String actual = sha256(finalFile);
                if (!actual.equalsIgnoreCase(expectedSha.trim())) {
                    deleteQuietly(finalFile);
                    call.reject(
                            "SHA-256 no coincide. Se descartó el archivo para no cargar un modelo corrupto.");
                    return;
                }
            }

            emitDownloadProgress(job.fileName, finalFile.length(), finalFile.length(), "done", true, null);

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("fileName", finalFile.getName());
            result.put("sizeBytes", finalFile.length());
            result.put("sha256Verified", expectedSha != null && !expectedSha.trim().isEmpty());
            call.resolve(result);
        } catch (Throwable error) {
            deleteQuietly(finalFile);
            call.reject("No se pudo finalizar la descarga: " + safeMessage(error));
        }
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        DownloadJob job = jobFor(call);
        if (job != null) {
            job.paused = true;
            Call current = job.httpCall;
            if (current != null) current.cancel();
        }
        call.resolve();
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        DownloadJob job = jobFor(call);
        if (job != null) {
            job.cancelled = true;
            Call current = job.httpCall;
            if (current != null) current.cancel();
        } else {
            // Sin descarga activa sí podemos limpiar el parcial de inmediato;
            // con una activa, el hilo de descarga es el único que debe borrarlo
            // para no dejar un archivo a medio escribir.
            String fileName = sanitizeFileName(call.getString("fileName"));
            if (fileName != null) {
                deleteQuietly(new File(modelsDir(), fileName + ".part"));
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        String fileName = sanitizeFileName(call.getString("fileName"));
        if (fileName == null) {
            call.reject("Nombre de archivo inválido.");
            return;
        }

        DownloadJob job = downloads.get(fileName);
        if (job != null) {
            job.cancelled = true;
            Call current = job.httpCall;
            if (current != null) current.cancel();
        }

        if (fileName.equals(loadedFileName)) {
            inferenceExecutor.execute(() -> {
                LlamaJni.nativeRelease();
                loadedFileName = null;
                activeTarget = TARGET_CPU;
                clearPendingAttempt();
            });
        }

        File file = new File(modelsDir(), fileName);
        File part = new File(modelsDir(), fileName + ".part");
        boolean removed = deleteQuietly(file) | deleteQuietly(part);

        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("removed", removed);
        call.resolve(result);
    }

    private DownloadJob jobFor(PluginCall call) {
        String fileName = sanitizeFileName(call.getString("fileName"));
        return fileName == null ? null : downloads.get(fileName);
    }

    private void emitDownloadProgress(
            String fileName,
            long bytes,
            long totalBytes,
            String phase,
            boolean done,
            String error) {
        JSObject data = new JSObject();
        data.put("fileName", fileName);
        data.put("bytes", bytes);
        data.put("totalBytes", totalBytes);
        data.put("percent", totalBytes > 0 ? Math.min(100, Math.round(bytes * 100.0 / totalBytes)) : 0);
        data.put("phase", phase);
        data.put("done", done);
        if (error != null) data.put("error", error);
        notifyListeners("downloadProgress", data);
    }

    private void resolvePaused(PluginCall call, long bytes) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("paused", true);
        result.put("bytes", bytes);
        call.resolve(result);
    }

    private void resolveCancelled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("cancelled", true);
        call.resolve(result);
    }

    // ---------------------------------------------------------------------
    // Inferencia
    // ---------------------------------------------------------------------

    @PluginMethod
    public void loadModel(PluginCall call) {
        if (!LlamaJni.AVAILABLE) {
            call.reject("El motor nativo no está disponible en este APK/ABI.");
            return;
        }

        String fileName = sanitizeFileName(call.getString("fileName"));
        if (fileName == null) {
            call.reject("Nombre de archivo inválido.");
            return;
        }

        File file = new File(modelsDir(), fileName);
        if (!file.isFile()) {
            call.reject("El archivo " + fileName + " no está descargado en el almacenamiento nativo.");
            return;
        }

        final int contextTokens = intOr(call.getInt("contextTokens"), 2048);
        final int threads = intOr(call.getInt("threads"), recommendedThreads());
        final int batchTokens = intOr(call.getInt("batchTokens"), Math.min(512, contextTokens));

        // `acceleration`: auto (por defecto), cpu, npu o gpu. Cada intento se
        // hace desde Java para poder dejar un marcador síncrono antes de tocar
        // el driver; si el proceso muere, el próximo arranque pone ese
        // acelerador en cuarentena en vez de repetir el cierre.
        final int requestedGpuLayers = intOr(call.getInt("gpuLayers"), -1);
        final String requestedMode = normalizeAccelerationMode(call.getString("acceleration"));
        JSONObject gpu = gpuInfo();
        JSONObject npu = npuInfo();
        final List<String> targets =
                accelerationOrder(requestedMode, requestedGpuLayers, gpu, npu);

        call.setKeepAlive(true);
        inferenceExecutor.execute(() -> {
            if (fileName.equals(loadedFileName) && LlamaJni.isLoaded()) {
                JSObject cached = new JSObject();
                cached.put("ok", true);
                cached.put("cached", true);
                cached.put("context", LlamaJni.nativeContextSize());
                cached.put("threads", threads);
                cached.put("loadMs", 0);
                putAcceleration(cached, gpu, npu);
                call.resolve(cached);
                return;
            }

            long started = System.currentTimeMillis();
            List<String> failures = new ArrayList<>();
            String usedTarget = null;

            try {
                LlamaJni.nativeRelease();

                for (String target : targets) {
                    final boolean accelerated = !TARGET_CPU.equals(target);
                    if (accelerated) beginAttempt(target, "load", fileName);

                    try {
                        final int layers = accelerated
                                ? Math.max(1, requestedGpuLayers > 0 ? requestedGpuLayers : 999)
                                : 0;
                        String error = LlamaJni.nativeLoad(
                                file.getAbsolutePath(),
                                contextTokens,
                                threads,
                                batchTokens,
                                layers,
                                jniTarget(target));

                        if (error == null || error.isEmpty()) {
                            usedTarget = target;
                            activeTarget = target;
                            // Con CPU no queda nada que pueda cerrar la app;
                            // con NPU/GPU el marcador sigue vivo hasta que una
                            // generación completa confirme que el driver
                            // también aguanta el cálculo, no solo la carga.
                            if (accelerated) beginAttempt(target, "runtime", fileName);
                            else clearPendingAttempt();
                            break;
                        }

                        if (accelerated) clearPendingAttempt();
                        failures.add(labelForTarget(target) + ": " + error);
                    } catch (OutOfMemoryError oom) {
                        throw oom;
                    } catch (Throwable error) {
                        if (accelerated) clearPendingAttempt();
                        failures.add(labelForTarget(target) + ": " + safeMessage(error));
                    }
                }

                if (usedTarget == null) {
                    loadedFileName = null;
                    activeTarget = TARGET_CPU;
                    clearPendingAttempt();
                    StringBuilder detail = new StringBuilder();
                    for (String failure : failures) {
                        if (detail.length() > 0) detail.append(' ');
                        detail.append(failure);
                    }
                    call.reject(
                            "No se pudo cargar el modelo nativo con ningún acelerador. " + detail);
                    return;
                }

                LlamaJni.markLoaded();
                loadedFileName = fileName;

                JSObject result = new JSObject();
                result.put("ok", true);
                result.put("cached", false);
                result.put("context", LlamaJni.nativeContextSize());
                result.put("threads", threads);
                result.put("loadMs", System.currentTimeMillis() - started);
                putAcceleration(result, gpu, npu);
                applyAttemptFailures(result, failures);
                call.resolve(result);
            } catch (OutOfMemoryError error) {
                LlamaJni.nativeRelease();
                loadedFileName = null;
                activeTarget = TARGET_CPU;
                clearPendingAttempt();
                call.reject(
                        "El dispositivo se quedó sin memoria al cargar el modelo. Prueba uno más pequeño.");
            } catch (Throwable error) {
                LlamaJni.nativeRelease();
                loadedFileName = null;
                activeTarget = TARGET_CPU;
                clearPendingAttempt();
                call.reject("No se pudo cargar el modelo nativo: " + safeMessage(error));
            }
        });
    }

    /** Añade a la respuesta las capas realmente aceleradas, no las pedidas. */
    private void putAcceleration(JSObject target, JSONObject gpu, JSONObject npu) {
        JSONObject load = loadInfo();
        target.put("gpu", gpu);
        target.put("npu", npu);
        target.put("gpuLayers", load.optInt("gpuLayers", 0));
        target.put("gpuFallback", load.optBoolean("gpuFallback", false));
        target.put("gpuError", load.optString("gpuError", ""));
        target.put("npuFallback", load.optBoolean("npuFallback", false));
        target.put("npuError", load.optString("npuError", ""));
        target.put("acceleration", load.optString("acceleration", "cpu"));
        target.put("accelerationPolicy", accelerationPolicy(gpu, npu));
    }

    /**
     * Un intento acelerado que falló sin tumbar la app (por ejemplo, Hexagon
     * no soporta el modelo) también debe explicarse en la respuesta.
     */
    private void applyAttemptFailures(JSObject target, List<String> failures) {
        String npuFailure = firstFailure(failures, TARGET_NPU);
        String gpuFailure = firstFailure(failures, TARGET_GPU);
        if (npuFailure != null) {
            target.put("npuFallback", true);
            target.put("npuError", npuFailure);
        }
        if (gpuFailure != null) {
            target.put("gpuFallback", true);
            target.put("gpuError", gpuFailure);
        }
    }

    private static String firstFailure(List<String> failures, String target) {
        String prefix = labelForTarget(target) + ": ";
        for (String failure : failures) {
            if (failure.startsWith(prefix)) return failure.substring(prefix.length());
        }
        return null;
    }

    @PluginMethod
    public void generate(PluginCall call) {
        if (!LlamaJni.AVAILABLE) {
            call.reject("El motor nativo no está disponible en este APK/ABI.");
            return;
        }
        if (loadedFileName == null) {
            call.reject("Primero carga el modelo con loadModel.");
            return;
        }

        final String[] roles;
        final String[] contents;
        final String rawPrompt;

        JSArray messages = call.getArray("messages");
        if (messages != null && messages.length() > 0) {
            roles = new String[messages.length()];
            contents = new String[messages.length()];
            try {
                for (int index = 0; index < messages.length(); index++) {
                    JSONObject item = messages.getJSONObject(index);
                    roles[index] = item.optString("role", "user");
                    contents[index] = item.optString("content", "");
                }
            } catch (Throwable error) {
                call.reject("El historial enviado al modelo no tiene el formato esperado.");
                return;
            }
            rawPrompt = null;
        } else {
            roles = new String[0];
            contents = new String[0];
            rawPrompt = call.getString("prompt", "");
        }

        final int maxTokens = intOr(call.getInt("maxTokens"), 256);
        final float temperature = floatOr(call.getDouble("temperature"), 0.7f);
        final float topP = floatOr(call.getDouble("topP"), 0.85f);
        final int topK = intOr(call.getInt("topK"), 40);
        final float minP = floatOr(call.getDouble("minP"), 0.05f);
        final float repeatPenalty = floatOr(call.getDouble("repeatPenalty"), 1.12f);
        final float frequencyPenalty = floatOr(call.getDouble("frequencyPenalty"), 0.15f);
        final float presencePenalty = floatOr(call.getDouble("presencePenalty"), 0.2f);
        final int penaltyLastN = intOr(call.getInt("penaltyLastN"), 64);
        final int seed = intOr(call.getInt("seed"), (int) (System.nanoTime() & 0x7fffffff));

        call.setKeepAlive(true);
        inferenceExecutor.execute(() -> {
            long started = System.currentTimeMillis();
            try {
                String prompt;
                if (roles.length > 0) {
                    prompt = LlamaJni.nativeFormatChat(roles, contents);
                } else {
                    prompt = rawPrompt == null ? "" : rawPrompt;
                }

                if (prompt == null || prompt.isEmpty()) {
                    call.reject("No se pudo construir el prompt para el modelo.");
                    return;
                }

                // La compilación de pipelines Vulkan y la sesión Hexagon
                // también pueden tumbar el proceso en el primer cálculo. El
                // marcador se renueva aquí y solo se borra si la generación
                // termina completa (no si el usuario aborta o hay un error).
                if (!TARGET_CPU.equals(activeTarget)) {
                    beginAttempt(
                            activeTarget,
                            "runtime",
                            loadedFileName == null ? "" : loadedFileName);
                }

                notifyActivity("prefill");

                LlamaJni.nativeSetSampling(
                        temperature,
                        topP,
                        topK,
                        minP,
                        repeatPenalty,
                        frequencyPenalty,
                        presencePenalty,
                        penaltyLastN,
                        seed);

                int promptTokens = LlamaJni.nativeStartPrompt(prompt, maxTokens, true);
                if (promptTokens < 0) {
                    int reason = LlamaJni.nativeFinishReason();
                    if (LlamaJni.nativeAccelerationFailed()) {
                        String detail = LlamaJni.nativeLastError();
                        abandonAcceleratedSession(activeTarget, loadedFileName);
                        call.reject(
                                detail + " Se reintentará en CPU; vuelve a enviar el mensaje.",
                                "ACCELERATION_FAILED");
                    } else if (reason == FINISH_ABORT) {
                        resolveAborted(call, started);
                    } else {
                        call.reject(LlamaJni.nativeLastError());
                    }
                    return;
                }

                long prefillDone = System.currentTimeMillis();
                StringBuilder text = new StringBuilder();
                int tokenIndex = 0;
                boolean announcedGeneration = false;

                while (true) {
                    String piece = LlamaJni.nativeNextToken();
                    if (piece == null) break;
                    if (piece.isEmpty()) continue;

                    if (!announcedGeneration) {
                        announcedGeneration = true;
                        notifyActivity("generating");
                    }

                    text.append(piece);

                    JSObject token = new JSObject();
                    token.put("token", piece);
                    token.put("index", tokenIndex++);
                    notifyListeners("llamaToken", token);
                }

                int reason = LlamaJni.nativeFinishReason();
                if (reason == FINISH_ERROR) {
                    if (LlamaJni.nativeAccelerationFailed()) {
                        String detail = LlamaJni.nativeLastError();
                        abandonAcceleratedSession(activeTarget, loadedFileName);
                        call.reject(
                                detail + " Se reintentará en CPU.",
                                "ACCELERATION_FAILED");
                    } else {
                        call.reject(LlamaJni.nativeLastError());
                    }
                    return;
                }

                String finishReason;
                if (reason == FINISH_ABORT) {
                    finishReason = "abort";
                } else if (reason == FINISH_LENGTH) {
                    finishReason = "length";
                } else {
                    finishReason = "stop";
                }

                long finished = System.currentTimeMillis();
                int generated = LlamaJni.nativeGeneratedTokens();
                double seconds = Math.max(0.001, (finished - prefillDone) / 1000.0);

                JSObject result = new JSObject();
                result.put("text", text.toString());
                result.put("finishReason", finishReason);
                result.put("promptTokens", LlamaJni.nativePromptTokens());
                result.put("generatedTokens", generated);
                result.put("cacheReusedTokens", LlamaJni.nativeCacheReusedTokens());
                result.put("prefillMs", prefillDone - started);
                result.put("generationMs", finished - prefillDone);
                result.put("tokensPerSecond", generated / seconds);

                // Generación completa: el acelerador sobrevivió a la carga y
                // al cálculo real. Ya no hay nada pendiente que cuarentenar.
                clearPendingAttempt();
                call.resolve(result);
            } catch (OutOfMemoryError error) {
                LlamaJni.nativeAbort();
                call.reject(
                        "El dispositivo se quedó sin memoria durante la generación. Prueba un modelo más pequeño.");
            } catch (Throwable error) {
                call.reject("La generación nativa falló: " + safeMessage(error));
            }
        });
    }

    @PluginMethod
    public void cancelGeneration(PluginCall call) {
        LlamaJni.nativeAbort();
        call.resolve();
    }

    /**
     * Descarta la caché KV sin recargar el modelo. Se usa al empezar una
     * conversación nueva para no arrastrar el contexto de la anterior.
     */
    @PluginMethod
    public void resetCache(PluginCall call) {
        if (!LlamaJni.AVAILABLE) {
            call.resolve();
            return;
        }
        LlamaJni.nativeResetCache();
        call.resolve();
    }

    @PluginMethod
    public void release(PluginCall call) {
        call.setKeepAlive(true);
        inferenceExecutor.execute(() -> {
            LlamaJni.nativeRelease();
            loadedFileName = null;
            activeTarget = TARGET_CPU;
            clearPendingAttempt();
            call.resolve();
        });
    }

    /**
     * Borra el historial de aceleradores bloqueados. Sirve para reintentar la
     * NPU o Vulkan tras una actualización de firmware o del APK; la app vuelve
     * a probarlos y, si el driver sigue cerrándola, se cuarentenan de nuevo.
     */
    @PluginMethod
    public void resetAcceleration(PluginCall call) {
        accelPrefs().edit().clear().commit();
        probedGpu = false;
        probedNpu = false;
        call.resolve();
    }

    private void resolveAborted(PluginCall call, long started) {
        JSObject result = new JSObject();
        result.put("text", "");
        result.put("finishReason", "abort");
        result.put("promptTokens", LlamaJni.nativePromptTokens());
        result.put("generatedTokens", LlamaJni.nativeGeneratedTokens());
        result.put("cacheReusedTokens", LlamaJni.nativeCacheReusedTokens());
        result.put("prefillMs", System.currentTimeMillis() - started);
        result.put("generationMs", 0);
        result.put("tokensPerSecond", 0);
        call.resolve(result);
    }

    private void notifyActivity(String activity) {
        JSObject data = new JSObject();
        data.put("activity", activity);
        notifyListeners("llamaActivity", data);
    }

    @Override
    protected void handleOnDestroy() {
        LlamaJni.nativeAbort();
        LlamaJni.nativeRelease();
        loadedFileName = null;
        activeTarget = TARGET_CPU;
        clearPendingAttempt();
        super.handleOnDestroy();
    }

    // ---------------------------------------------------------------------
    // Política y cuarentena de aceleradores
    // ---------------------------------------------------------------------

    private SharedPreferences accelPrefs() {
        return getContext().getSharedPreferences(ACCEL_PREFS, Context.MODE_PRIVATE);
    }

    /**
     * Si el proceso anterior murió durante una sonda o una carga, el marcador
     * sigue en disco. Solo se cuarentena cuando Android confirma un cierre
     * nativo posterior al marcador: cerrar la app a mano o que el sistema la
     * recicle no debe desactivar la aceleración para siempre.
     */
    private synchronized void recoverInterruptedAttempt() {
        if (recoveryDone) return;
        SharedPreferences prefs = accelPrefs();

        String target = prefs.getString(KEY_PENDING_TARGET, null);
        if (target == null) {
            recoveryDone = true;
            return;
        }

        long startedAt = prefs.getLong(KEY_PENDING_AT, 0L);
        String phase = prefs.getString(KEY_PENDING_PHASE, "load");
        String file = prefs.getString(KEY_PENDING_FILE, "");

        SharedPreferences.Editor editor = prefs.edit()
                .remove(KEY_PENDING_TARGET)
                .remove(KEY_PENDING_PHASE)
                .remove(KEY_PENDING_FILE)
                .remove(KEY_PENDING_AT);

        boolean quarantine =
                (TARGET_NPU.equals(target) || TARGET_GPU.equals(target))
                        && crashedNativelySince(startedAt);
        if (quarantine) {
            String where = "probe".equals(phase)
                    ? "al detectar el dispositivo"
                    : "runtime".equals(phase)
                            ? "durante el cálculo"
                            : "al cargar el modelo";
            String suffix = file == null || file.isEmpty() ? "" : " (" + file + ")";
            editor.putBoolean(PREFIX_FAILED + target, true)
                    .putString(
                            PREFIX_REASON + target,
                            "La última vez, " + labelForTarget(target) + " cerró la aplicación " +
                                    where + suffix + ". Se evita en modo automático hasta que " +
                                    "restablezcas la aceleración.")
                    .putString(PREFIX_PHASE + target, phase)
                    .putLong(PREFIX_AT + target, System.currentTimeMillis());
        }
        editor.commit();
        recoveryDone = true;
    }

    private boolean crashedNativelySince(long sinceMs) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            // Sin ApplicationExitInfo no hay forma de distinguir un cierre del
            // usuario; ante la duda protegemos la app de un bucle de cierres.
            return true;
        }
        try {
            ActivityManager manager =
                    (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (manager == null) return true;

            List<ApplicationExitInfo> exits = manager.getHistoricalProcessExitReasons(
                    getContext().getPackageName(), 0, 8);
            for (ApplicationExitInfo exit : exits) {
                if (exit == null || exit.getTimestamp() < sinceMs) continue;
                int reason = exit.getReason();
                if (reason == ApplicationExitInfo.REASON_CRASH_NATIVE
                        || reason == ApplicationExitInfo.REASON_CRASH
                        || reason == ApplicationExitInfo.REASON_SIGNALED) {
                    return true;
                }
            }
            return false;
        } catch (Throwable error) {
            return true;
        }
    }

    private boolean isQuarantined(String target) {
        return accelPrefs().getBoolean(PREFIX_FAILED + target, false);
    }

    private String quarantinePhase(String target) {
        if (!isQuarantined(target)) return "";
        return accelPrefs().getString(PREFIX_PHASE + target, "");
    }

    private String quarantineReason(String target) {
        return accelPrefs().getString(PREFIX_REASON + target, "");
    }

    /** Marcador síncrono: debe estar en disco antes de tocar el driver. */
    private void beginAttempt(String target, String phase, String fileName) {
        accelPrefs().edit()
                .putString(KEY_PENDING_TARGET, target)
                .putString(KEY_PENDING_PHASE, phase)
                .putString(KEY_PENDING_FILE, fileName == null ? "" : fileName)
                .putLong(KEY_PENDING_AT, System.currentTimeMillis())
                .commit();
    }

    private void clearPendingAttempt() {
        accelPrefs().edit()
                .remove(KEY_PENDING_TARGET)
                .remove(KEY_PENDING_PHASE)
                .remove(KEY_PENDING_FILE)
                .remove(KEY_PENDING_AT)
                .commit();
    }

    /**
     * Cuarentena inmediata cuando el backend acelerado lanza una excepción de
     * Vulkan capturada en C++. A diferencia de un cierre nativo, la app sigue
     * viva, así que el marcador de intento se sustituye en el acto por la
     * marca de fallo para que el siguiente intento use CPU.
     */
    /**
     * Un fallo de aceleración en tiempo de ejecución deja la sesión nativa con
     * un backend roto. Se cuarentena el acelerador y se libera el modelo para
     * que el reintento que hace la interfaz cargue de verdad en CPU en lugar
     * de reutilizar la sesión cacheada con Vulkan/Hexagon.
     */
    private void abandonAcceleratedSession(String target, String fileName) {
        quarantineAccelerator(target, "runtime", fileName);
        LlamaJni.nativeRelease();
        loadedFileName = null;
        activeTarget = TARGET_CPU;
    }

    private void quarantineAccelerator(String target, String phase, String fileName) {
        if (target == null || TARGET_CPU.equals(target)) return;
        String where = "runtime".equals(phase) ? "durante el cálculo" : "al cargar el modelo";
        String suffix = fileName == null || fileName.isEmpty() ? "" : " (" + fileName + ")";
        accelPrefs().edit()
                .putBoolean(PREFIX_FAILED + target, true)
                .putString(
                        PREFIX_REASON + target,
                        labelForTarget(target) + " rechazó el cálculo con un error del controlador " +
                                where + suffix + ". Se usará la CPU hasta que restablezcas la aceleración.")
                .putString(PREFIX_PHASE + target, phase)
                .putLong(PREFIX_AT + target, System.currentTimeMillis())
                .commit();
        clearPendingAttempt();
    }

    private JSONObject quarantinedProbeInfo(String target) {
        JSONObject json = new JSONObject();
        try {
            json.put("available", false);
            json.put("usable", false);
            if (TARGET_GPU.equals(target)) {
                json.put("software", false);
            } else {
                json.put("arch", 0);
            }
            json.put("name", "");
            json.put("description", "");
            json.put("quarantined", true);
            json.put("reason", quarantineReason(target));
        } catch (Throwable ignored) {
            // Sin datos, la UI seguirá mostrando CPU; no se anuncia nada falso.
        }
        return json;
    }

    /**
     * Estado real de cada acelerador para la interfaz. `usable` aquí ya
     * incorpora la cuarentena y, en Vulkan, la omisión automática en Adreno.
     */
    private JSObject accelerationPolicy(JSONObject gpu, JSONObject npu) {
        JSObject policy = new JSObject();
        policy.put("mode", "auto");
        policy.put(
                TARGET_NPU,
                acceleratorState(TARGET_NPU, npu.optBoolean("usable", false), ""));
        policy.put(
                TARGET_GPU,
                acceleratorState(
                        TARGET_GPU,
                        gpu.optBoolean("usable", false),
                        gpuSkipReason(gpu)));
        return policy;
    }

    private JSObject acceleratorState(String target, boolean usable, String skipReason) {
        boolean quarantined = isQuarantined(target);
        JSObject state = new JSObject();
        state.put("usable", usable && !quarantined && skipReason.isEmpty());
        state.put("quarantined", quarantined);
        state.put("skipped", !skipReason.isEmpty());
        state.put("reason", quarantined ? quarantineReason(target) : skipReason);
        state.put("phase", quarantined ? quarantinePhase(target) : "");
        return state;
    }

    /**
     * El backend Vulkan de llama.cpp ha cerrado la app en varios Adreno al
     * crear pipelines (SIGSEGV/SIGABRT dentro del driver, imposible de
     * atrapar). En modo automático se usa la NPU Hexagon, que es la vía que
     * Qualcomm recomienda, o la CPU. La GPU sigue disponible como elección
     * manual. Se comprueba el nombre del dispositivo y, como respaldo, el SoC:
     * si el nombre no trae «Adreno», un Qualcomm sigue siendo Adreno.
     */
    private String gpuSkipReason(JSONObject gpu) {
        if (!gpu.optBoolean("usable", false)) return "";
        String haystack = (gpu.optString("name", "") + " " + gpu.optString("description", ""))
                .toLowerCase(Locale.US);
        boolean adreno = haystack.contains("adreno");

        boolean qualcomm = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            String soc = Build.SOC_MANUFACTURER;
            qualcomm = soc != null && soc.toLowerCase(Locale.US).contains("qualcomm");
        }
        String hardware = (Build.HARDWARE + " " + Build.BOARD).toLowerCase(Locale.US);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            hardware = hardware + " " + Build.SOC_MODEL;
        }
        qualcomm = qualcomm
                || hardware.contains("qcom")
                || hardware.contains("kalama")
                || hardware.contains("pineapple")
                || hardware.contains("taro")
                || hardware.contains("sun")
                || hardware.contains("volcano");

        if (!adreno && !qualcomm) return "";
        return "Vulkan se omite en modo automático en GPUs Adreno: este driver no compila "
                + "los dmmv de K-quant y el catálogo usa Q4_K_M. Solo un modelo Q4_0 pequeño "
                + "ha resultado correcto en pruebas; el resto se ejecuta en CPU.";
    }

    private List<String> accelerationOrder(
            String mode, int requestedGpuLayers, JSONObject gpu, JSONObject npu) {
        List<String> order = new ArrayList<>();
        if (requestedGpuLayers == 0 || "cpu".equals(mode)) {
            order.add(TARGET_CPU);
            return order;
        }

        boolean npuReady = npu.optBoolean("usable", false) && !isQuarantined(TARGET_NPU);
        boolean gpuReady = gpu.optBoolean("usable", false) && !isQuarantined(TARGET_GPU);

        if ("npu".equals(mode)) {
            if (npuReady) order.add(TARGET_NPU);
        } else if ("gpu".equals(mode)) {
            if (gpuReady) order.add(TARGET_GPU);
        } else {
            if (npuReady) order.add(TARGET_NPU);
            if (gpuReady && gpuSkipReason(gpu).isEmpty()) order.add(TARGET_GPU);
        }

        order.add(TARGET_CPU);
        return order;
    }

    private static String normalizeAccelerationMode(String value) {
        if (value == null) return "auto";
        String mode = value.trim().toLowerCase(Locale.US);
        if ("cpu".equals(mode) || "npu".equals(mode) || "gpu".equals(mode)) return mode;
        return "auto";
    }

    private static int jniTarget(String target) {
        if (TARGET_NPU.equals(target)) return JNI_TARGET_NPU;
        if (TARGET_GPU.equals(target)) return JNI_TARGET_GPU;
        return JNI_TARGET_CPU;
    }

    private static String labelForTarget(String target) {
        if (TARGET_NPU.equals(target)) return "la NPU Hexagon";
        if (TARGET_GPU.equals(target)) return "la GPU Vulkan";
        return "la CPU";
    }

    // ---------------------------------------------------------------------
    // Utilidades
    // ---------------------------------------------------------------------

    private static int intOr(Integer value, int fallback) {
        return value == null ? fallback : value;
    }

    private static float floatOr(Double value, float fallback) {
        return value == null ? fallback : value.floatValue();
    }

    private static String sanitizeFileName(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty() || trimmed.length() > 160) return null;
        if (!trimmed.matches("[A-Za-z0-9._-]+")) return null;
        if (trimmed.startsWith(".")) return null;
        return trimmed;
    }

    private static boolean deleteQuietly(File file) {
        try {
            return !file.exists() || file.delete();
        } catch (Throwable error) {
            return false;
        }
    }

    private static void copyFile(File source, File destination) throws IOException {
        try (FileInputStream input = new FileInputStream(source);
             FileOutputStream output = new FileOutputStream(destination, false)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            output.flush();
        }
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[256 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        StringBuilder hex = new StringBuilder();
        for (byte value : digest.digest()) {
            hex.append(String.format(Locale.US, "%02x", value & 0xff));
        }
        return hex.toString();
    }

    private static String safeMessage(Throwable error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty()
                ? error.getClass().getSimpleName()
                : message;
    }
}
