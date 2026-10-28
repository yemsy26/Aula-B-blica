package org.verbovivo.app;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Puente mínimo con llama.cpp nativo.
 *
 * La biblioteca se carga una sola vez. Si el ABI no tiene binarios (o el
 * emulador no los admite), AVAILABLE queda en false y la app usa wllama/WASM
 * como respaldo, sin fingir que el motor nativo existe.
 */
final class LlamaJni {
    static final boolean AVAILABLE;
    private static final AtomicBoolean LOADED = new AtomicBoolean(false);

    static {
        boolean available = false;
        try {
            System.loadLibrary("verbovivo_llama_jni");
            available = true;
        } catch (Throwable error) {
            // UnsatisfiedLinkError en ABIs no empaquetados o APK antiguo.
            available = false;
        }
        AVAILABLE = available;
    }

    private LlamaJni() {}

    static native String nativeSystemInfo();

    /**
     * Carga un único objetivo: 0 = CPU, 1 = NPU Hexagon, 2 = GPU Vulkan.
     * El llamador (LlamaNativePlugin) decide el orden y cuarentena; así un
     * cierre nativo del driver queda registrado antes de intentarlo.
     */
    static native String nativeLoad(
            String path,
            int contextTokens,
            int threads,
            int batchTokens,
            int gpuLayers,
            int accelerator);

    /** JSON con el dispositivo Vulkan detectado (o available=false). */
    static native String nativeGpuInfo();

    /** JSON con la NPU Hexagon detectada, su versión y si es utilizable. */
    static native String nativeNpuInfo();

    /** JSON con las capas realmente aceleradas y si hubo reintento en CPU. */
    static native String nativeLoadInfo();

    static native int nativeContextSize();

    static native String nativeFormatChat(String[] roles, String[] contents);

    static native void nativeSetSampling(
            float temperature,
            float topP,
            int topK,
            float minP,
            float repeatPenalty,
            float frequencyPenalty,
            float presencePenalty,
            int penaltyLastN,
            int seed);

    static native int nativeStartPrompt(String prompt, int maxTokens, boolean addSpecial);

    static native String nativeNextToken();

    static native int nativeFinishReason();

    static native int nativePromptTokens();

    static native int nativeGeneratedTokens();

    /** Tokens del prompt que ya estaban en la caché KV del turno anterior. */
    static native int nativeCacheReusedTokens();

    /**
     * Descarta la caché KV antes del próximo prompt (conversación nueva). No
     * libera el modelo: la carga de varios segundos se conserva.
     */
    static native void nativeResetCache();

    static native String nativeLastError();

    /**
     * true si el último cálculo lo rechazó el backend acelerado (por ejemplo
     * Vulkan lanzó vk::UnknownError). Se captura en C++ para no cerrar la app;
     * Java cuarentena el acelerador y sigue en CPU.
     */
    static native boolean nativeAccelerationFailed();

    static native void nativeAbort();

    static native void nativeRelease();

    static void markLoaded() {
        LOADED.set(true);
    }

    static boolean isLoaded() {
        return LOADED.get();
    }
}
