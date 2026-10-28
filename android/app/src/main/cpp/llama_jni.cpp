// Puente JNI entre VerboVivo y llama.cpp nativo.
//
// Todo el estado de inferencia vive aquí, fuera del heap de Java: un GGUF de
// 1–5 GB no debe competir con el WebView ni provocar OutOfMemoryError. El
// hilo de inferencia lo controla LlamaNativePlugin; este archivo solo expone
// operaciones síncronas pequeñas (cargar, iniciar prompt, siguiente token).
//
// Reglas de honestidad:
// - Si falta el archivo, llama.cpp falla o el contexto no cabe, devolvemos el
//   error real. Nunca generamos texto de relleno.
// - La cancelación es cooperativa: `nativeAbort` marca el flag y tanto el
//   prompt como el bucle de tokens lo consultan.

#include <jni.h>
#include <android/dlext.h>
#include <android/log.h>
#include <dlfcn.h>
#include <sys/system_properties.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <mutex>
#include <string>
#include <vector>

#include "ggml-backend.h"
#include "llama.h"

namespace {

constexpr int32_t FINISH_NONE = 0;
constexpr int32_t FINISH_EOS = 1;
constexpr int32_t FINISH_LENGTH = 2;
constexpr int32_t FINISH_ABORT = 3;
constexpr int32_t FINISH_ERROR = 4;

llama_model *g_model = nullptr;
llama_context *g_ctx = nullptr;
llama_sampler *g_sampler = nullptr;

std::atomic<bool> g_abort{false};
std::atomic<bool> g_backend_ready{false};
// Se pone cuando el backend acelerado lanza una excepción de Vulkan durante el
// cálculo. Java lo consulta para poner ese acelerador en cuarentena y reintentar
// en CPU sin volver a tocar el driver.
std::atomic<bool> g_accel_failed{false};

int32_t g_prompt_tokens = 0;
int32_t g_generated_tokens = 0;
int32_t g_max_tokens = 0;
int32_t g_finish_reason = FINISH_NONE;

// Tokens cuyo KV sigue vivo en el contexto, en orden de posición. El chat
// crece al final (sistema, historial, turno nuevo), así que el prefijo común
// con el turno anterior se reutiliza y solo se decodifica la cola.
std::vector<llama_token> g_cached_tokens;
int32_t g_cache_reused_tokens = 0;
// Se pide desde Java al empezar una conversación nueva. Se aplica perezosamente
// en el siguiente prompt para no tocar el KV mientras hay una generación.
std::atomic<bool> g_cache_reset_requested{false};

// Estado de aceleración del último modelo cargado. Se informa a la interfaz
// para que no diga «GPU» o «NPU» cuando en realidad se reintentó en CPU.
int32_t g_gpu_layers = 0;
bool g_gpu_fallback = false;
std::string g_gpu_error;
std::string g_gpu_name;
bool g_npu_fallback = false;
std::string g_npu_error;
std::string g_npu_name;
int32_t g_npu_arch = 0;
std::string g_acceleration = "cpu";

std::string g_last_error;
std::mutex g_state_mutex;
// La información de aceleración se lee desde getInfo mientras un modelo puede
// estar cargándose (que mantiene g_state_mutex durante minutos). Este mutex
// independiente evita bloquear la interfaz.
std::mutex g_gpu_info_mutex;

std::once_flag g_backend_once;

// Definido más abajo: necesita leer propiedades del sistema.
void apply_vulkan_profile();

// Sin esto, los errores de carga de llama.cpp se pierden en stderr y solo
// vemos «no pudo cargar el GGUF». Los reenviamos a logcat para poder
// diagnosticar en un dispositivo real sin depender del emulador.
void log_to_logcat(enum ggml_log_level level, const char * text, void * /*user_data*/) {
    if (text == nullptr) return;
    int priority = ANDROID_LOG_INFO;
    switch (level) {
        case GGML_LOG_LEVEL_ERROR: priority = ANDROID_LOG_ERROR; break;
        case GGML_LOG_LEVEL_WARN: priority = ANDROID_LOG_WARN; break;
        case GGML_LOG_LEVEL_DEBUG: priority = ANDROID_LOG_DEBUG; break;
        default: priority = ANDROID_LOG_INFO; break;
    }
    __android_log_write(priority, "llama.cpp", text);
}

void backend_init_once() {
    std::call_once(g_backend_once, []() {
        llama_log_set(log_to_logcat, nullptr);
        // Debe ejecutarse antes de que el backend Vulkan enumere dispositivos
        // y compile sus pipelines.
        apply_vulkan_profile();
        llama_backend_init();
        g_backend_ready.store(true);
    });
}

// Todos los llamadores mantienen g_state_mutex; no volvemos a bloquearlo aquí
// (std::mutex no es recursivo).
void set_error(const std::string & message) {
    g_last_error = message;
}

void release_locked() {
    if (g_sampler) {
        llama_sampler_free(g_sampler);
        g_sampler = nullptr;
    }
    if (g_ctx) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
    g_prompt_tokens = 0;
    g_generated_tokens = 0;
    g_max_tokens = 0;
    g_finish_reason = FINISH_NONE;
    g_cached_tokens.clear();
    g_cache_reused_tokens = 0;
    g_cache_reset_requested.store(false);

    std::lock_guard<std::mutex> gpuLock(g_gpu_info_mutex);
    g_gpu_layers = 0;
    g_gpu_fallback = false;
    g_gpu_error.clear();
    g_gpu_name.clear();
    g_npu_fallback = false;
    g_npu_error.clear();
    g_npu_name.clear();
    g_npu_arch = 0;
    g_acceleration = "cpu";
}

std::string jstring_to_string(JNIEnv * env, jstring value) {
    if (value == nullptr) return {};
    const char * chars = env->GetStringUTFChars(value, nullptr);
    if (chars == nullptr) return {};
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

jstring string_to_jstring(JNIEnv * env, const std::string & value) {
    return env->NewStringUTF(value.c_str());
}

std::string lower_ascii(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return value;
}

bool contains_any(const std::string & haystack, const std::vector<std::string> & needles) {
    for (const std::string & needle : needles) {
        if (haystack.find(needle) != std::string::npos) return true;
    }
    return false;
}

std::string escape_json(const std::string & value) {
    std::string result;
    result.reserve(value.size() + 8);
    for (char c : value) {
        switch (c) {
            case '"': result += "\\\""; break;
            case '\\': result += "\\\\"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    // Los nombres de dispositivo no deberían traer controles,
                    // pero no rompemos el JSON si algún driver lo hace.
                    result += ' ';
                } else {
                    result += c;
                }
        }
    }
    return result;
}

struct GpuProbe {
    bool available = false;
    bool usable = false;
    bool software = false;
    std::string name;
    std::string description;
    std::string type;
    size_t memory_free = 0;
    size_t memory_total = 0;
    ggml_backend_dev_t device = nullptr;
};

struct NpuProbe {
    bool runtime_present = false;
    bool available = false;
    bool usable = false;
    std::string vendor;
    std::string soc;
    std::string name;
    std::string description;
    std::string reason;
    /** Diagnóstico técnico completo; la UI muestra `reason`, no esto. */
    std::string detail;
    int arch = 0;
    size_t memory_free = 0;
    size_t memory_total = 0;
    ggml_backend_dev_t device = nullptr;
};

const char * backend_type_name(enum ggml_backend_dev_type type) {
    switch (type) {
        case GGML_BACKEND_DEVICE_TYPE_GPU: return "gpu";
        case GGML_BACKEND_DEVICE_TYPE_IGPU: return "igpu";
        case GGML_BACKEND_DEVICE_TYPE_CPU: return "cpu";
        case GGML_BACKEND_DEVICE_TYPE_ACCEL: return "accel";
        case GGML_BACKEND_DEVICE_TYPE_META: return "meta";
        default: return "desconocido";
    }
}

std::string read_property(const char * key) {
    char value[PROP_VALUE_MAX] = {0};
    __system_property_get(key, value);
    return std::string(value);
}

// En este firmware logcat no es legible, así que los motivos de retroceso de
// los aceleradores se anexan al mismo archivo que usa el rastro de pipelines.
void trace_note(const char * fmt, ...) {
    const char * path = getenv("GGML_VK_TRACE_FILE");
    if (path == nullptr || path[0] == '\0') return;
    FILE * file = fopen(path, "a");
    if (file == nullptr) return;
    va_list args;
    va_start(args, fmt);
    vfprintf(file, fmt, args);
    va_end(args);
    fputc('\n', file);
    fclose(file);
}

// Perfil de compatibilidad Vulkan aplicado antes de llama_backend_init().
// El driver Adreno aborta en vkCreateComputePipelines con ciertas rutas de
// shader (cooperative matrix, f16, fusión de operadores). Estos interruptores
// de ggml permiten desactivarlas sin recompilar el backend.
//
// Se controla con `debug.verbovivo.vk_profile` (requiere reiniciar la app,
// porque el backend se inicializa una sola vez):
//   none | safe | no-coopmat | no-f16 | no-fusion | no-async
//   o una lista separada por comas: "coopmat,dot2,multi-add"
std::string g_vk_profile = "none";

struct VkFeatureToggle {
    const char * token;
    const char * env;
};

const VkFeatureToggle kVkFeatureToggles[] = {
    {"coopmat", "GGML_VK_DISABLE_COOPMAT"},
    {"coopmat2", "GGML_VK_DISABLE_COOPMAT2"},
    {"coopmat2-vector", "GGML_VK_DISABLE_COOPMAT2_DECODE_VECTOR"},
    {"f16", "GGML_VK_DISABLE_F16"},
    {"bfloat16", "GGML_VK_DISABLE_BFLOAT16"},
    {"int-dot", "GGML_VK_DISABLE_INTEGER_DOT_PRODUCT"},
    {"dot2", "GGML_VK_DISABLE_DOT2"},
    {"multi-add", "GGML_VK_DISABLE_MULTI_ADD"},
    {"fusion", "GGML_VK_DISABLE_FUSION"},
    {"graph-opt", "GGML_VK_DISABLE_GRAPH_OPTIMIZE"},
    {"async", "GGML_VK_DISABLE_ASYNC"},
    {"descriptor-reuse", "GGML_VK_DISABLE_DESCRIPTOR_REUSE"},
    {"mmvq", "GGML_VK_DISABLE_MMVQ"},
};

const char * const kSafeVulkanProfile =
    "coopmat,coopmat2,coopmat2-vector,f16,bfloat16,int-dot,dot2,multi-add,"
    "fusion,graph-opt,async,descriptor-reuse,mmvq";
const char * const kMinimalVulkanProfile =
    "coopmat,coopmat2,coopmat2-vector,fusion,graph-opt,async,descriptor-reuse";

std::string resolve_vulkan_profile(std::string value) {
    value = lower_ascii(value);
    if (value.empty() || value == "none" || value == "off" || value == "auto") return "none";
    if (value == "safe") return kSafeVulkanProfile;
    if (value == "minimal") return kMinimalVulkanProfile;
    if (value == "no-coopmat") return "coopmat,coopmat2,coopmat2-vector";
    if (value == "no-f16") return "f16,bfloat16,int-dot,dot2,multi-add";
    if (value == "no-fusion") return "fusion,graph-opt";
    if (value == "no-async") return "async,descriptor-reuse";
    return value;
}

bool profile_has_token(const std::string & profile, const char * token) {
    size_t start = 0;
    const std::string needle(token);
    while (start <= profile.size()) {
        const size_t end = profile.find(',', start);
        const std::string item = profile.substr(
            start, end == std::string::npos ? std::string::npos : end - start);
        if (item == needle) return true;
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return false;
}

void apply_vulkan_profile() {
    const std::string requested = resolve_vulkan_profile(
        read_property("debug.verbovivo.vk_profile"));
    g_vk_profile = requested;

    if (requested == "none") {
        __android_log_print(ANDROID_LOG_INFO, "VerboVivoJNI",
                            "Perfil Vulkan: none (valores por defecto de ggml)");
        return;
    }

    std::string applied;
    for (const VkFeatureToggle & toggle : kVkFeatureToggles) {
        if (!profile_has_token(requested, toggle.token)) continue;
        setenv(toggle.env, "1", 1);
        if (!applied.empty()) applied += ",";
        applied += toggle.token;
    }

    __android_log_print(ANDROID_LOG_INFO, "VerboVivoJNI",
                        "Perfil Vulkan: %s (interruptores: %s)",
                        g_vk_profile.c_str(),
                        applied.empty() ? "ninguno" : applied.c_str());
}

const char * effective_vulkan_profile() {
    return g_vk_profile.c_str();
}

struct SocInfo {
    std::string manufacturer;
    std::string model;
    std::string board;
};

SocInfo read_soc() {
    SocInfo info;
    info.manufacturer = read_property("ro.soc.manufacturer");
    info.model = read_property("ro.soc.model");
    info.board = read_property("ro.board.platform");

    if (info.manufacturer.empty()) {
        const std::string hardware = lower_ascii(read_property("ro.hardware"));
        const std::string board = lower_ascii(info.board);
        if (hardware == "qcom" || hardware == "qualcomm" || board == "qcom") {
            info.manufacturer = "Qualcomm";
        }
    }
    return info;
}

// Versión de Hexagon esperada para los Snapdragon que llama.cpp soporta.
// El backend consulta la versión real en el DSP; este mapa es solo para
// decidir si merece la pena cargarlo y para explicarlo en la interfaz.
int hexagon_arch_for_soc(const SocInfo & soc) {
    const std::string model = lower_ascii(soc.model);
    const std::string board = lower_ascii(soc.board);

    const auto has = [](const std::string & haystack, const char * needle) {
        return haystack.find(needle) != std::string::npos;
    };

    if (has(model, "sm8850") || has(board, "volcano")) return 81;
    if (has(model, "sm8750") || has(board, "sun")) return 79;
    if (has(model, "sm8650") || has(board, "pineapple")) return 75;
    if (has(model, "sm8635") || has(model, "sm7675") || has(model, "sm7635")) return 75;
    if (has(model, "sm8550") || has(board, "kalama") || has(board, "cape")) return 73;
    if (has(model, "qcs8550") || has(model, "qcm8550")) return 73;
    if (has(model, "sm8450") || has(board, "taro")) return 69; // anterior a v73
    return 0;
}

// htpdrv_init() devuelve un código opaco cuando no logra cargar FastRPC.
// En algunos firmware (RedMagic 9 Pro, Android 16) el enlazador no resuelve
// `libcdsprpc.so` por nombre aunque esté en /vendor/lib64 y en
// public.libraries.txt. Probamos también la ruta absoluta, guardamos cada
// error y dejamos la biblioteca cargada para que el backend la reutilice.
struct FastRpcLoad {
    void * handle = nullptr;
    bool by_name = false;
    bool via_namespace = false;
    std::string error;
};

const FastRpcLoad & load_fastrpc() {
#if defined(__aarch64__)
    static FastRpcLoad result;
    static std::once_flag once;
    std::call_once(once, []() {
        static const char * const candidates[] = {
            "libcdsprpc.so",
            "/vendor/lib64/libcdsprpc.so",
            "/vendor/lib/libcdsprpc.so",
        };
        for (size_t i = 0; i < sizeof(candidates) / sizeof(candidates[0]); ++i) {
            dlerror();
            result.handle = dlopen(candidates[i], RTLD_NOW | RTLD_LOCAL);
            if (result.handle != nullptr) {
                result.by_name = i == 0;
                result.error.clear();
                return;
            }
            const char * error = dlerror();
            result.error += std::string(candidates[i]) + " → " +
                            (error != nullptr ? error : "error desconocido") + "; ";
        }

        // Android 16 bloquea las bibliotecas de /vendor que no pertenecen al
        // espacio de nombres de la app. `android_get_exported_namespace` es una
        // API privada del enlazador; si existe, podemos pedir el namespace
        // «vendor» y cargar FastRPC dentro de él sin empaquetar código
        // propietario. Es un intento legítimo: si el firmware no lo permite,
        // se informa y la app sigue en CPU.
        using get_exported_namespace_fn = void * (*)(const char *);
        get_exported_namespace_fn get_namespace = nullptr;
        void * linker = dlopen("libdl.so", RTLD_NOW | RTLD_LOCAL);
        if (linker != nullptr) {
            get_namespace = reinterpret_cast<get_exported_namespace_fn>(
                dlsym(linker, "android_get_exported_namespace"));
        }
        if (get_namespace == nullptr) {
            get_namespace = reinterpret_cast<get_exported_namespace_fn>(
                dlsym(RTLD_DEFAULT, "android_get_exported_namespace"));
        }

        if (get_namespace == nullptr) {
            result.error += "android_get_exported_namespace no está expuesta; ";
            return;
        }

        void * vendor_namespace = get_namespace("vendor");
        if (vendor_namespace == nullptr) {
            result.error += "android_get_exported_namespace(\"vendor\") → null; ";
            return;
        }

        android_dlextinfo ext_info{};
        ext_info.flags = ANDROID_DLEXT_USE_NAMESPACE;
        ext_info.library_namespace =
            reinterpret_cast<android_namespace_t *>(vendor_namespace);

        dlerror();
        result.handle = android_dlopen_ext(
            "/vendor/lib64/libcdsprpc.so", RTLD_NOW | RTLD_LOCAL, &ext_info);
        if (result.handle != nullptr) {
            result.via_namespace = true;
            result.error.clear();
            return;
        }

        const char * error = dlerror();
        result.error += "/vendor/lib64/libcdsprpc.so (namespace vendor) → " +
                        std::string(error != nullptr ? error : "error desconocido") + "; ";
    });
    return result;
#else
    static FastRpcLoad result;
    return result;
#endif
}

std::string describe_fastrpc_detail() {
#if defined(__aarch64__)
    const FastRpcLoad & rpc = load_fastrpc();
    if (rpc.handle == nullptr) {
        return "FastRPC no se pudo abrir: " + rpc.error;
    }
    const std::string note = rpc.via_namespace
        ? "FastRPC se cargó en el espacio de nombres vendor. "
        : rpc.by_name
            ? std::string()
            : "FastRPC solo se cargó por ruta absoluta porque el enlazador no resuelve libcdsprpc.so por nombre. ";

    static const char * const required[] = {
        "rpcmem_alloc", "rpcmem_free", "rpcmem_to_fd",
        "fastrpc_mmap", "fastrpc_munmap",
        "dspqueue_create", "dspqueue_close", "dspqueue_export",
        "dspqueue_write", "dspqueue_read", "dspqueue_read_noblock",
        "remote_handle64_open", "remote_handle64_invoke",
        "remote_handle_control", "remote_handle64_control",
        "remote_session_control", "remote_handle64_close",
    };

    std::string missing;
    for (const char * symbol : required) {
        dlerror();
        if (dlsym(rpc.handle, symbol) == nullptr) {
            if (!missing.empty()) missing += ", ";
            missing += symbol;
        }
    }
    // No se cierra el handle: htpdrv_init() lo reutiliza por soname.

    if (!missing.empty()) {
        return note + "FastRPC no expone: " + missing;
    }
    return note + "FastRPC abre y exporta sus símbolos, pero el DSP rechazó la sesión Hexagon (firmware, SELinux o NPU no disponible para esta app).";
#else
    return "La NPU Hexagon solo está disponible en ARM64.";
#endif
}

// Traduce el diagnóstico a una frase apta para la interfaz. El detalle
// completo se expone aparte para soporte y para el registro de pruebas.
std::string describe_fastrpc_reason(const std::string & detail) {
    if (detail.find("not accessible for the namespace") != std::string::npos) {
        return "El firmware bloquea libcdsprpc.so para aplicaciones (espacio de nombres del enlazador); la NPU no es accesible desde esta app.";
    }
    if (detail.find("android_get_exported_namespace") != std::string::npos ||
        detail.find("namespace vendor") != std::string::npos) {
        return "El firmware bloquea FastRPC y no permite abrir el espacio de nombres vendor; la NPU no es accesible desde esta app.";
    }
    if (detail.find("no se pudo abrir") != std::string::npos) {
        return "FastRPC no se pudo abrir; la NPU no está disponible para esta app.";
    }
    if (detail.find("no expone") != std::string::npos) {
        return "FastRPC no expone las funciones que necesita llama.cpp.";
    }
    return "FastRPC se abrió, pero el DSP rechazó la sesión Hexagon (firmware, SELinux o NPU no disponible).";
}

// Carga el backend Hexagon solo cuando el SoC es Qualcomm. Así los equipos
// con Exynos, Tensor o MediaTek no pagan el coste ni el riesgo de abrir una
// sesión FastRPC que no existe. El registro es idempotente.
NpuProbe probe_npu() {
    backend_init_once();

    static NpuProbe cached;
    static std::once_flag once;
    std::call_once(once, []() {
        const SocInfo soc = read_soc();
        cached.vendor = soc.manufacturer;
        cached.soc = soc.model.empty() ? soc.board : soc.model;
        cached.arch = hexagon_arch_for_soc(soc);

        const std::string vendor = lower_ascii(soc.manufacturer);
        const bool qualcomm_vendor =
            vendor.find("qualcomm") != std::string::npos ||
            vendor.find("qti") != std::string::npos ||
            vendor.find("qcom") != std::string::npos;
        // Varios firmware publican `ro.soc.manufacturer=QTI` (Qualcomm
        // Technologies, Inc.), no la cadena «Qualcomm». Si el modelo o el board
        // ya identifican un Snapdragon conocido (`arch > 0`), no exigimos que
        // el fabricante use el nombre largo: en el RedMagic 9 Pro eso impedía
        // siquiera intentar cargar Hexagon v75.
        if (!qualcomm_vendor && cached.arch == 0) {
            cached.reason = soc.manufacturer.empty()
                ? "No se pudo identificar el SoC; solo los Snapdragon con Hexagon v73 o superior tienen NPU compatible con llama.cpp."
                : "Este SoC (" + soc.manufacturer + ") no expone Hexagon; se usará GPU o CPU.";
            return;
        }

        if (cached.arch > 0 && cached.arch < 73) {
            cached.reason =
                "Hexagon v" + std::to_string(cached.arch) +
                " es anterior a v73; llama.cpp no ofrece backend NPU para este SoC.";
            return;
        }

#if defined(__aarch64__)
        // La biblioteca no se enlaza en el JNI a propósito: se carga aquí para
        // que un equipo no Qualcomm nunca ejecute la inicialización FastRPC.
        void * handle = dlopen("libggml-hexagon.so", RTLD_NOW | RTLD_LOCAL);
        if (handle == nullptr) {
            const char * load_error = dlerror();
            cached.reason = std::string("No se pudo cargar el backend Hexagon: ") +
                            (load_error != nullptr ? load_error : "error desconocido");
            return;
        }
        cached.runtime_present = true;

        using hexagon_reg_fn = ggml_backend_reg_t (*)();
        auto reg_fn = reinterpret_cast<hexagon_reg_fn>(
            dlsym(handle, "ggml_backend_hexagon_reg"));
        if (reg_fn == nullptr) {
            cached.reason = "La biblioteca Hexagon no expone ggml_backend_hexagon_reg.";
            return;
        }

        // En firmware que no resuelven la biblioteca pública por nombre,
        // cargarla con ruta absoluta antes de inicializar el backend permite
        // que htpdrv_init() la reutilice por su soname.
        load_fastrpc();

        // El backend puede lanzar excepciones de C++ si FastRPC o el DSP fallan;
        // ninguna debe cruzar el límite JNI (provocaría un abort del proceso).
        try {
            ggml_backend_reg_t reg = reg_fn();
            if (reg == nullptr) {
                cached.detail = describe_fastrpc_detail();
                cached.reason = "El backend Hexagon no pudo inicializarse. " +
                                describe_fastrpc_reason(cached.detail);
                return;
            }
            ggml_backend_register(reg);

            for (size_t i = 0; i < ggml_backend_dev_count(); ++i) {
                ggml_backend_dev_t dev = ggml_backend_dev_get(i);
                if (dev == nullptr) continue;
                ggml_backend_reg_t dev_reg = ggml_backend_dev_backend_reg(dev);
                const char * reg_name = dev_reg != nullptr ? ggml_backend_reg_name(dev_reg) : nullptr;
                if (reg_name == nullptr || std::string(reg_name) != "HTP") continue;

                ggml_backend_dev_props props{};
                ggml_backend_dev_get_props(dev, &props);
                cached.device = dev;
                cached.name = props.name != nullptr ? props.name : "HTP0";
                cached.description = props.description != nullptr ? props.description : "Hexagon";
                cached.memory_free = props.memory_free;
                cached.memory_total = props.memory_total;
                break;
            }
        } catch (const std::exception & error) {
            cached.device = nullptr;
            cached.available = false;
            cached.usable = false;
            cached.reason = std::string("La NPU Hexagon falló al inicializarse: ") +
                            (error.what() != nullptr ? error.what() : "error desconocido");
            return;
        } catch (...) {
            cached.device = nullptr;
            cached.available = false;
            cached.usable = false;
            cached.reason = "La NPU Hexagon falló al inicializarse con un error desconocido.";
            return;
        }

        if (cached.device == nullptr) {
            cached.reason = "El backend Hexagon se cargó, pero no enumeró ninguna sesión HTP.";
            return;
        }

        cached.available = true;

        if (cached.arch == 0) {
            // La versión real la consulta el DSP al abrir la sesión, pero sin
            // un mapa fiable no activamos la NPU automáticamente: preferimos
            // Vulkan/CPU antes que arriesgar un cuelgue en un SoC desconocido.
            cached.reason =
                "NPU Hexagon detectada, pero no se pudo determinar su versión; "
                "no se activa automáticamente.";
            return;
        }
        if (cached.arch < 73 || cached.arch > 85) {
            cached.reason = "Hexagon v" + std::to_string(cached.arch) + " está fuera del rango soportado (v73-v85).";
            return;
        }

        cached.usable = true;
#else
        cached.reason = "La NPU Hexagon solo está disponible en arm64-v8a.";
#endif
    });

    return cached;
}

std::string npu_probe_json(const NpuProbe & probe) {
    const size_t free_mb = probe.memory_free / (1024u * 1024u);
    const size_t total_mb = probe.memory_total / (1024u * 1024u);

    std::string json = "{";
    json += "\"runtimePresent\":" + std::string(probe.runtime_present ? "true" : "false");
    json += ",\"available\":" + std::string(probe.available ? "true" : "false");
    json += ",\"usable\":" + std::string(probe.usable ? "true" : "false");
    json += ",\"vendor\":\"" + escape_json(probe.vendor) + "\"";
    json += ",\"soc\":\"" + escape_json(probe.soc) + "\"";
    json += ",\"arch\":" + std::to_string(probe.arch);
    json += ",\"name\":\"" + escape_json(probe.name) + "\"";
    json += ",\"description\":\"" + escape_json(probe.description) + "\"";
    json += ",\"memoryFreeMb\":" + std::to_string(free_mb);
    json += ",\"memoryTotalMb\":" + std::to_string(total_mb);
    json += ",\"reason\":\"" + escape_json(probe.reason) + "\"";
    json += ",\"detail\":\"" + escape_json(probe.detail) + "\"";
    json += "}";
    return json;
}

// Detecta el backend Vulkan y distingue una GPU real de un rasterizador de
// software (SwiftShader/llvmpipe), que reporta «GPU» pero no acelera nada.
// Se excluye explícitamente HTP: la NPU también se presenta como «GPU» ante
// llama.cpp, y confundirlas haría que la interfaz anunciara Vulkan sin serlo.
GpuProbe probe_gpu() {
    backend_init_once();

    GpuProbe probe;
    ggml_backend_dev_t device = nullptr;
    ggml_backend_dev_t integrated = nullptr;

    for (size_t i = 0; i < ggml_backend_dev_count(); ++i) {
        ggml_backend_dev_t candidate = ggml_backend_dev_get(i);
        if (candidate == nullptr) continue;

        ggml_backend_reg_t reg = ggml_backend_dev_backend_reg(candidate);
        const char * reg_name = reg != nullptr ? ggml_backend_reg_name(reg) : nullptr;
        if (reg_name != nullptr && std::string(reg_name) == "HTP") continue;

        const enum ggml_backend_dev_type type = ggml_backend_dev_type(candidate);
        if (type == GGML_BACKEND_DEVICE_TYPE_GPU) {
            device = candidate;
            break;
        }
        if (type == GGML_BACKEND_DEVICE_TYPE_IGPU && integrated == nullptr) {
            integrated = candidate;
        }
    }
    if (device == nullptr) device = integrated;
    if (device == nullptr) return probe;

    ggml_backend_dev_props props{};
    ggml_backend_dev_get_props(device, &props);

    probe.available = true;
    probe.device = device;
    probe.name = props.name != nullptr ? props.name : "GPU";
    probe.description = props.description != nullptr ? props.description : "";
    probe.type = backend_type_name(props.type);
    probe.memory_free = props.memory_free;
    probe.memory_total = props.memory_total;

    const std::string haystack = lower_ascii(probe.name + " " + probe.description);
    probe.software = contains_any(haystack, {
        "swiftshader", "llvmpipe", "lavapipe", "software rasterizer", "softpipe",
    });
    probe.usable = !probe.software && llama_supports_gpu_offload();
    return probe;
}

std::string gpu_probe_json(const GpuProbe & probe) {
    const size_t free_mb = probe.memory_free / (1024u * 1024u);
    const size_t total_mb = probe.memory_total / (1024u * 1024u);

    std::string json = "{";
    json += "\"available\":" + std::string(probe.available ? "true" : "false");
    json += ",\"usable\":" + std::string(probe.usable ? "true" : "false");
    json += ",\"software\":" + std::string(probe.software ? "true" : "false");
    json += ",\"name\":\"" + escape_json(probe.name) + "\"";
    json += ",\"description\":\"" + escape_json(probe.description) + "\"";
    json += ",\"type\":\"" + escape_json(probe.type) + "\"";
    json += ",\"memoryFreeMb\":" + std::to_string(free_mb);
    json += ",\"memoryTotalMb\":" + std::to_string(total_mb);
    json += ",\"supportsOffload\":" +
            std::string(llama_supports_gpu_offload() ? "true" : "false");
    json += ",\"vulkanProfile\":\"" + escape_json(effective_vulkan_profile()) + "\"";
    json += "}";
    return json;
}

// Firma de llama_decode: se aborta en cuanto el usuario cancela.
bool decode_abort_callback(void * /*data*/) {
    return g_abort.load();
}

std::vector<llama_token> tokenize_prompt(const std::string & prompt, bool add_special) {
    const llama_vocab * vocab = llama_model_get_vocab(g_model);

    int32_t needed = llama_tokenize(
        vocab, prompt.data(), static_cast<int32_t>(prompt.size()), nullptr, 0, add_special, true);

    if (needed < 0) {
        needed = -needed;
    }
    if (needed <= 0) return {};

    std::vector<llama_token> tokens(static_cast<size_t>(needed));
    int32_t written = llama_tokenize(
        vocab,
        prompt.data(),
        static_cast<int32_t>(prompt.size()),
        tokens.data(),
        needed,
        add_special,
        true);

    if (written < 0) {
        set_error("No se pudo tokenizar el prompt del modelo.");
        return {};
    }

    tokens.resize(static_cast<size_t>(written));
    return tokens;
}

int32_t common_prefix_length(
    const std::vector<llama_token> & a,
    const std::vector<llama_token> & b) {
    const size_t limit = std::min(a.size(), b.size());
    size_t index = 0;
    while (index < limit && a[index] == b[index]) {
        index++;
    }
    return static_cast<int32_t>(index);
}

std::string token_to_piece(llama_token token) {
    const llama_vocab * vocab = llama_model_get_vocab(g_model);

    std::vector<char> buffer(256);
    int32_t written = llama_token_to_piece(
        vocab, token, buffer.data(), static_cast<int32_t>(buffer.size()), 0, false);

    if (written < 0) {
        buffer.resize(static_cast<size_t>(-written) + 1);
        written = llama_token_to_piece(
            vocab, token, buffer.data(), static_cast<int32_t>(buffer.size()), 0, false);
    }

    if (written <= 0) return {};
    return std::string(buffer.data(), static_cast<size_t>(written));
}

std::vector<std::string> read_string_array(JNIEnv * env, jobjectArray array) {
    std::vector<std::string> values;
    if (array == nullptr) return values;

    const jsize count = env->GetArrayLength(array);
    values.reserve(static_cast<size_t>(count));

    for (jsize index = 0; index < count; ++index) {
        auto * item = static_cast<jstring>(env->GetObjectArrayElement(array, index));
        values.push_back(jstring_to_string(env, item));
        if (item != nullptr) env->DeleteLocalRef(item);
    }

    return values;
}

}  // namespace

extern "C" {

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeSystemInfo(JNIEnv * env, jclass /*clazz*/) {
    backend_init_once();
    const char * info = llama_print_system_info();
    return string_to_jstring(env, info == nullptr ? "llama.cpp" : info);
}

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeLoad(
    JNIEnv * env,
    jclass /*clazz*/,
    jstring path,
    jint n_ctx,
    jint n_threads,
    jint n_batch,
    jint n_gpu_layers,
    jint accelerator) {
    const std::string model_path = jstring_to_string(env, path);
    if (model_path.empty()) {
        return string_to_jstring(env, "Ruta de modelo vacía.");
    }

    // Diagnóstico del backend Vulkan: en este firmware logcat no es legible,
    // así que el rastro de creación de pipelines va junto a los modelos.
    if (read_property("debug.verbovivo.vk_trace") == "1") {
        const size_t slash = model_path.find_last_of('/');
        if (slash != std::string::npos) {
            const std::string trace_path = model_path.substr(0, slash) + "/vk-trace.txt";
            setenv("GGML_VK_TRACE_FILE", trace_path.c_str(), 1);
        }
    }
    // Permite desactivar el respaldo por memoria compartida de Adreno 750 para
    // comparar resultados con la reducción por subgrupo del driver.
    if (read_property("debug.verbovivo.vk_adreno_subgroups") == "1") {
        setenv("GGML_VK_ADRENO_750_SHMEM", "0", 1);
    }

    backend_init_once();

    std::lock_guard<std::mutex> lock(g_state_mutex);
    release_locked();
    g_abort.store(false);
    g_finish_reason = FINISH_NONE;
    g_last_error.clear();

    const NpuProbe npu = probe_npu();
    const GpuProbe gpu = probe_gpu();

    enum class AccelTarget { Npu, Gpu, Cpu };
    struct Attempt {
        AccelTarget target;
        ggml_backend_dev_t device;
        const char * label;
    };

    // Java decide el orden y la cuarentena (un cierre nativo no se puede
    // capturar aquí). Esta función carga un solo objetivo: con -1 mantiene el
    // orden automático NPU → GPU → CPU; con un valor explícito solo intenta el
    // acelerador pedido y devuelve el error real, para que Java pueda
    // reintentar en CPU y dejar constancia del motivo.

    std::vector<Attempt> attempts;
    // Segunda defensa, además de la decisión de Java: en modo automático el
    // driver Adreno no debe recibir el modelo ni una sola operación.
    const bool gpu_adreno = contains_any(
        lower_ascii(gpu.name + " " + gpu.description), {"adreno"});
    if (accelerator < 0) {
        if (npu.usable && npu.device != nullptr) {
            attempts.push_back({AccelTarget::Npu, npu.device, "La NPU Hexagon"});
        }
        if (gpu.usable && gpu.device != nullptr && !gpu_adreno) {
            attempts.push_back({AccelTarget::Gpu, gpu.device, "Vulkan"});
        }
        attempts.push_back({AccelTarget::Cpu, nullptr, "CPU"});
    } else if (accelerator == 1) {
        // Objetivo explícito: Java ya eligió y es quien decide el retroceso y
        // la cuarentena. Aquí no se oculta un fallo cayendo a la CPU, porque
        // eso haría creer a la interfaz que la NPU cargó el modelo.
        if (npu.usable && npu.device != nullptr) {
            attempts.push_back({AccelTarget::Npu, npu.device, "La NPU Hexagon"});
        }
    } else if (accelerator == 2) {
        if (gpu.usable && gpu.device != nullptr) {
            attempts.push_back({AccelTarget::Gpu, gpu.device, "Vulkan"});
        }
    } else {
        attempts.push_back({AccelTarget::Cpu, nullptr, "CPU"});
    }

    if (attempts.empty()) {
        std::string error;
        if (accelerator == 1) {
            error = "La NPU Hexagon no está disponible para cargar el modelo." +
                    (npu.reason.empty() ? std::string() : " " + npu.reason);
        } else if (accelerator == 2) {
            error = "Vulkan no está disponible para cargar el modelo en este dispositivo.";
        } else {
            error = "No hay un acelerador disponible para cargar el modelo.";
        }
        set_error(error);
        return string_to_jstring(env, error);
    }

    // Sin acelerador utilizable no pedimos offload: aunque llama.cpp acepte el
    // valor y deje las capas en CPU, nativeLoadInfo anunciaría una GPU/NPU que
    // no existe. La UI y el adaptador ya envían 0 en ese caso; esto es la
    // última defensa.
    const int32_t requested_gpu_layers =
        (n_gpu_layers > 0 && (npu.usable || gpu.usable)) ? n_gpu_layers : 0;

    const int32_t context = n_ctx > 0 ? n_ctx : 2048;
    const int32_t threads = n_threads > 0 ? n_threads : 4;

    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = static_cast<uint32_t>(context);
    // Se respeta el lote pedido por Java. Es importante en Vulkan/Adreno: con
    // más de 8 columnas el planificador usa el matmul cuantizado (mul_mm), que
    // el compilador de este driver rechaza con vk::Device::createComputePipeline:
    // ErrorUnknown; con 8 o menos usa mul_mat_vec, que sí compila.
    const uint32_t requested_batch =
        n_batch > 0
            ? static_cast<uint32_t>(n_batch < context ? n_batch : context)
            : static_cast<uint32_t>(context < 512 ? context : 512);
    // En Adreno 750 el matmul cuantizado del prefill (mul_mm) no compila, así
    // que cualquier lote mayor de 8 haría fallar el primer decode. Se recorta
    // aquí aunque quien llame pida más: es la diferencia entre acelerar y
    // devolver un error. Solo aplica cuando el objetivo es la GPU.
    const bool adreno_750 =
        lower_ascii(gpu.name + " " + gpu.description).find("adreno (tm) 750") != std::string::npos;
    const uint32_t batch_tokens =
        (accelerator == 2 && adreno_750) ? std::min<uint32_t>(requested_batch, 8) : requested_batch;
    ctx_params.n_batch = batch_tokens;
    ctx_params.n_ubatch = static_cast<uint32_t>(batch_tokens < 128 ? batch_tokens : 128);
    // Diagnóstico: algunos drivers Adreno compilan la atención flash pero
    // devuelven resultados incorrectos. Con esta propiedad se fuerza la
    // atención por multiplicación normal para aislar el problema.
    if (read_property("debug.verbovivo.vk_no_flash") == "1") {
        ctx_params.flash_attn_type = LLAMA_FLASH_ATTN_TYPE_DISABLED;
    }
    ctx_params.n_threads = threads;
    ctx_params.n_threads_batch = threads;
    ctx_params.abort_callback = decode_abort_callback;
    ctx_params.abort_callback_data = nullptr;
    ctx_params.no_perf = false;

    AccelTarget used = AccelTarget::Cpu;
    std::string accel_error;
    ggml_backend_dev_t devices[2] = {nullptr, nullptr};
    // Lista vacía y terminada en null. Sin esto, llama.cpp toma por su cuenta
    // todas las GPU registradas (Vulkan incluido) incluso con n_gpu_layers=0;
    // el planificador puede asignarle operaciones al driver y Adreno aborta en
    // vkCreateComputePipelines. Para CPU pura no debe existir ningún device GPU.
    ggml_backend_dev_t no_gpu_devices[1] = {nullptr};

    // Orden honesto: NPU Hexagon → GPU Vulkan → CPU. Se prueba de verdad; si
    // el acelerador no puede cargar el GGUF o reservar el contexto KV, se
    // libera y se pasa al siguiente, reportando el motivo.
    for (const Attempt & attempt : attempts) {
        const bool offload =
            requested_gpu_layers > 0 && attempt.target != AccelTarget::Cpu;

        llama_model_params model_params = llama_model_default_params();
        model_params.n_gpu_layers = offload ? requested_gpu_layers : 0;
        if (offload && attempt.device != nullptr) {
            devices[0] = attempt.device;
            devices[1] = nullptr;
            model_params.devices = devices;
        } else {
            model_params.devices = no_gpu_devices;
        }

        llama_context_params attempt_ctx = ctx_params;
        if (attempt.target == AccelTarget::Cpu) {
            // Sin offload ni siquiera de operaciones sueltas: CPU significa CPU.
            attempt_ctx.offload_kqv = false;
            attempt_ctx.op_offload = false;
        }

        __android_log_print(
            ANDROID_LOG_INFO, "VerboVivoJNI",
            "Cargando modelo con %s (n_gpu_layers=%d, devices=%s)",
            attempt.label,
            static_cast<int>(model_params.n_gpu_layers),
            offload ? "acelerador" : "solo CPU");

        g_model = llama_model_load_from_file(model_path.c_str(), model_params);
        if (g_model == nullptr) {
            trace_note("LOAD_FAILED %s n_gpu_layers=%d", attempt.label,
                       static_cast<int>(model_params.n_gpu_layers));
            if (offload) {
                accel_error += std::string(attempt.label) +
                               " no pudo cargar el modelo; ";
            }
            continue;
        }

        g_ctx = llama_init_from_model(g_model, attempt_ctx);
        if (g_ctx == nullptr) {
            llama_model_free(g_model);
            g_model = nullptr;
            trace_note("CONTEXT_FAILED %s n_gpu_layers=%d n_ctx=%u n_batch=%u n_ubatch=%u",
                       attempt.label,
                       static_cast<int>(model_params.n_gpu_layers),
                       attempt_ctx.n_ctx, attempt_ctx.n_batch, attempt_ctx.n_ubatch);
            if (offload) {
                accel_error += std::string(attempt.label) +
                               " cargó el modelo pero no pudo crear el contexto; ";
            }
            continue;
        }

        trace_note("LOAD_OK %s n_gpu_layers=%d", attempt.label,
                   static_cast<int>(model_params.n_gpu_layers));
        used = attempt.target;
        break;
    }

    if (g_model == nullptr) {
        const std::string error =
            "llama.cpp no pudo cargar el GGUF. Verifica que el archivo esté completo y "
            "que el dispositivo tenga RAM libre suficiente." +
            (accel_error.empty() ? std::string() : " " + accel_error);
        set_error(error);
        return string_to_jstring(env, error);
    }

    if (g_ctx == nullptr) {
        release_locked();
        const std::string error =
            "llama.cpp cargó el archivo pero no pudo crear el contexto. "
            "Prueba un contexto menor o un modelo más pequeño." +
            (accel_error.empty() ? std::string() : " " + accel_error);
        set_error(error);
        return string_to_jstring(env, error);
    }

    // Solo hay retroceso dentro de esta llamada cuando se pidió el modo
    // automático (-1). Con objetivos explícitos el reintento y su motivo los
    // gestiona Java, que es quien puede persistir la cuarentena.
    const bool npu_fallback =
        accelerator < 0 && npu.usable && used != AccelTarget::Npu;
    const bool gpu_fallback =
        accelerator < 0 && gpu.usable && used == AccelTarget::Cpu;
    const int32_t used_layers =
        used == AccelTarget::Cpu ? 0 : requested_gpu_layers;

    {
        std::lock_guard<std::mutex> gpuLock(g_gpu_info_mutex);
        g_gpu_layers = used_layers;
        g_gpu_fallback = gpu_fallback;
        g_gpu_error = gpu_fallback ? accel_error : "";
        g_gpu_name = gpu.name;
        g_npu_fallback = npu_fallback;
        g_npu_error = npu_fallback ? accel_error : "";
        g_npu_name = npu.name;
        g_npu_arch = npu.arch;
        g_acceleration =
            used == AccelTarget::Npu ? "npu" : used == AccelTarget::Gpu ? "gpu" : "cpu";
    }
    return nullptr;  // null = éxito
}

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeGpuInfo(JNIEnv * env, jclass /*clazz*/) {
    const GpuProbe probe = probe_gpu();
    return string_to_jstring(env, gpu_probe_json(probe));
}

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeNpuInfo(JNIEnv * env, jclass /*clazz*/) {
    const NpuProbe probe = probe_npu();
    return string_to_jstring(env, npu_probe_json(probe));
}

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeLoadInfo(JNIEnv * env, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_gpu_info_mutex);

    std::string json = "{";
    json += "\"gpuLayers\":" + std::to_string(g_gpu_layers);
    json += ",\"gpuFallback\":" + std::string(g_gpu_fallback ? "true" : "false");
    json += ",\"gpuError\":\"" + escape_json(g_gpu_error) + "\"";
    json += ",\"gpuName\":\"" + escape_json(g_gpu_name) + "\"";
    json += ",\"npuFallback\":" + std::string(g_npu_fallback ? "true" : "false");
    json += ",\"npuError\":\"" + escape_json(g_npu_error) + "\"";
    json += ",\"npuName\":\"" + escape_json(g_npu_name) + "\"";
    json += ",\"npuArch\":" + std::to_string(g_npu_arch);
    json += ",\"acceleration\":\"" + escape_json(g_acceleration) + "\"";
    json += "}";
    return string_to_jstring(env, json);
}

JNIEXPORT jint JNICALL
Java_org_verbovivo_app_LlamaJni_nativeContextSize(JNIEnv * /*env*/, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_state_mutex);
    return g_ctx == nullptr ? 0 : static_cast<jint>(llama_n_ctx(g_ctx));
}

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeFormatChat(
    JNIEnv * env,
    jclass /*clazz*/,
    jobjectArray roles,
    jobjectArray contents) {
    std::lock_guard<std::mutex> lock(g_state_mutex);

    if (g_model == nullptr) {
        return string_to_jstring(env, "");
    }

    const std::vector<std::string> role_values = read_string_array(env, roles);
    const std::vector<std::string> content_values = read_string_array(env, contents);

    if (role_values.empty() || role_values.size() != content_values.size()) {
        return string_to_jstring(env, "");
    }

    std::vector<llama_chat_message> messages;
    messages.reserve(role_values.size());
    size_t total_chars = 0;

    for (size_t index = 0; index < role_values.size(); ++index) {
        messages.push_back({role_values[index].c_str(), content_values[index].c_str()});
        total_chars += role_values[index].size() + content_values[index].size();
    }

    const char * tmpl = llama_model_chat_template(g_model, nullptr);
    if (tmpl == nullptr || tmpl[0] == '\0') {
        tmpl = "chatml";
    }

    std::vector<char> buffer(total_chars * 2 + 2048);
    int32_t written = llama_chat_apply_template(
        tmpl, messages.data(), messages.size(), true, buffer.data(),
        static_cast<int32_t>(buffer.size()));

    if (written > static_cast<int32_t>(buffer.size())) {
        buffer.resize(static_cast<size_t>(written) + 1);
        written = llama_chat_apply_template(
            tmpl, messages.data(), messages.size(), true, buffer.data(),
            static_cast<int32_t>(buffer.size()));
    }

    if (written <= 0) {
        return string_to_jstring(env, "");
    }

    return env->NewStringUTF(std::string(buffer.data(), static_cast<size_t>(written)).c_str());
}

JNIEXPORT void JNICALL
Java_org_verbovivo_app_LlamaJni_nativeSetSampling(
    JNIEnv * /*env*/,
    jclass /*clazz*/,
    jfloat temperature,
    jfloat top_p,
    jint top_k,
    jfloat min_p,
    jfloat repeat_penalty,
    jfloat frequency_penalty,
    jfloat presence_penalty,
    jint penalty_last_n,
    jint seed) {
    std::lock_guard<std::mutex> lock(g_state_mutex);

    if (g_sampler) {
        llama_sampler_free(g_sampler);
        g_sampler = nullptr;
    }
    if (g_ctx == nullptr || g_model == nullptr) return;

    const llama_vocab * vocab = llama_model_get_vocab(g_model);
    const int32_t vocab_size = llama_vocab_n_tokens(vocab);

    llama_sampler_chain_params chain_params = llama_sampler_chain_default_params();
    g_sampler = llama_sampler_chain_init(chain_params);

    if (penalty_last_n > 0 && repeat_penalty > 0.0f) {
        llama_sampler_chain_add(
            g_sampler,
            llama_sampler_init_penalties(
                vocab_size, penalty_last_n, repeat_penalty, frequency_penalty, presence_penalty));
    }
    if (top_k > 0) {
        llama_sampler_chain_add(g_sampler, llama_sampler_init_top_k(top_k));
    }
    llama_sampler_chain_add(g_sampler, llama_sampler_init_top_p(top_p, 1));
    if (min_p > 0.0f) {
        llama_sampler_chain_add(g_sampler, llama_sampler_init_min_p(min_p, 1));
    }
    llama_sampler_chain_add(
        g_sampler, llama_sampler_init_temp(temperature > 0.0f ? temperature : 0.1f));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_dist(static_cast<uint32_t>(seed)));
}

JNIEXPORT jint JNICALL
Java_org_verbovivo_app_LlamaJni_nativeStartPrompt(
    JNIEnv * env,
    jclass /*clazz*/,
    jstring prompt,
    jint max_tokens,
    jboolean add_special) {
    std::lock_guard<std::mutex> lock(g_state_mutex);

    g_abort.store(false);
    g_accel_failed.store(false);
    g_generated_tokens = 0;
    g_finish_reason = FINISH_NONE;
    g_last_error.clear();

    if (g_ctx == nullptr || g_model == nullptr) {
        set_error("No hay un modelo cargado.");
        g_finish_reason = FINISH_ERROR;
        return -10;
    }

    const std::string prompt_text = jstring_to_string(env, prompt);
    if (prompt_text.empty()) {
        set_error("El prompt está vacío.");
        g_finish_reason = FINISH_ERROR;
        return -11;
    }

    std::vector<llama_token> tokens = tokenize_prompt(prompt_text, add_special == JNI_TRUE);
    if (tokens.empty()) {
        if (g_last_error.empty()) set_error("La tokenización devolvió cero tokens.");
        g_finish_reason = FINISH_ERROR;
        return -12;
    }

    const int32_t context = static_cast<int32_t>(llama_n_ctx(g_ctx));
    const int32_t reserve = max_tokens > 0 ? max_tokens : 256;
    const int32_t available = context - reserve - 8;

    if (available <= 0) {
        set_error("El contexto del modelo es demasiado pequeño para la salida solicitada.");
        g_finish_reason = FINISH_ERROR;
        return -13;
    }

    int32_t reused = 0;
    const bool reset_requested = g_cache_reset_requested.exchange(false);
    const bool dropped_head = static_cast<int32_t>(tokens.size()) > available;
    if (dropped_head) {
        // El adaptador ya recorta el prompt; esto es la última red de
        // seguridad. Conservamos el final (turno actual) y avisamos arriba.
        // Las posiciones ya no corresponden a la caché: se descarta.
        tokens.erase(tokens.begin(), tokens.end() - available);
    }

    llama_memory_t memory = llama_get_memory(g_ctx);

    if (!reset_requested && !dropped_head && !g_cached_tokens.empty()) {
        const llama_pos cached_max = llama_memory_seq_pos_max(memory, 0);
        const bool cache_matches =
            cached_max + 1 == static_cast<llama_pos>(g_cached_tokens.size());
        if (cache_matches) {
            reused = common_prefix_length(g_cached_tokens, tokens);
            // Siempre se decodifica el último token del prompt: el muestreador
            // necesita su logit.
            if (reused >= static_cast<int32_t>(tokens.size())) {
                reused = static_cast<int32_t>(tokens.size()) - 1;
            }
            if (reused > 0 && !llama_memory_seq_rm(memory, 0, reused, -1)) {
                // Algunos modelos (ventana deslizante) no admiten recorte
                // parcial; se empieza de cero antes que arriesgar el cálculo.
                reused = 0;
            }
        }
    }

    if (reused == 0) {
        llama_memory_clear(memory, true);
        g_cached_tokens.clear();
    } else {
        g_cached_tokens.resize(static_cast<size_t>(reused));
        __android_log_print(
            ANDROID_LOG_INFO,
            "verbovivo",
            "KV reutilizado: %d de %d tokens del prompt",
            reused,
            static_cast<int32_t>(tokens.size()));
    }
    g_cache_reused_tokens = reused;

    if (g_sampler) llama_sampler_reset(g_sampler);

    const int32_t batch_capacity = static_cast<int32_t>(llama_n_batch(g_ctx));
    int32_t offset = reused;

    while (offset < static_cast<int32_t>(tokens.size())) {
        if (g_abort.load()) {
            g_finish_reason = FINISH_ABORT;
            return -14;
        }

        int32_t chunk = static_cast<int32_t>(tokens.size()) - offset;
        if (chunk > batch_capacity) chunk = batch_capacity;

        int32_t result = 0;
        try {
            llama_batch batch = llama_batch_get_one(tokens.data() + offset, chunk);
            result = llama_decode(g_ctx, batch);
        } catch (const std::exception & error) {
            // El backend Vulkan propietario puede lanzar vk::UnknownError desde
            // la creación de un pipeline. Sin esta captura, std::terminate
            // cierra la app; así se informa y Java puede volver a CPU.
            g_accel_failed.store(true);
            g_finish_reason = FINISH_ERROR;
            set_error(std::string("El acelerador rechazó el cálculo del prompt: ") + error.what());
            return -16;
        }

        if (result != 0) {
            if (g_abort.load()) {
                g_finish_reason = FINISH_ABORT;
            } else {
                g_finish_reason = FINISH_ERROR;
                set_error(
                    result == 1
                        ? "El contexto se llenó durante el prefill. Acorta el historial o usa más contexto."
                        : "llama.cpp falló al procesar el prompt.");
            }
            return -15;
        }

        offset += chunk;
    }

    g_cached_tokens.insert(g_cached_tokens.end(), tokens.begin() + reused, tokens.end());
    g_prompt_tokens = static_cast<int32_t>(tokens.size());
    g_max_tokens = reserve;
    return g_prompt_tokens;
}

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeNextToken(JNIEnv * env, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_state_mutex);

    if (g_ctx == nullptr || g_model == nullptr || g_sampler == nullptr) {
        g_finish_reason = FINISH_ERROR;
        set_error("No hay un modelo o sampler listo.");
        return nullptr;
    }

    if (g_abort.load()) {
        g_finish_reason = FINISH_ABORT;
        return nullptr;
    }

    if (g_generated_tokens >= g_max_tokens) {
        g_finish_reason = FINISH_LENGTH;
        return nullptr;
    }

    const llama_vocab * vocab = llama_model_get_vocab(g_model);
    llama_token token = 0;
    try {
        token = llama_sampler_sample(g_sampler, g_ctx, -1);
        llama_sampler_accept(g_sampler, token);
    } catch (const std::exception & error) {
        g_accel_failed.store(true);
        g_finish_reason = FINISH_ERROR;
        set_error(std::string("El acelerador falló al muestrear el siguiente token: ") + error.what());
        return nullptr;
    }

    if (llama_vocab_is_eog(vocab, token)) {
        g_finish_reason = FINISH_EOS;
        return nullptr;
    }

    const std::string piece = token_to_piece(token);
    if (piece.empty()) {
        // Token de control sin representación textual: se consume pero no se
        // entrega. El bucle de Java vuelve a pedir el siguiente.
        g_generated_tokens++;
        if (g_generated_tokens >= g_max_tokens) g_finish_reason = FINISH_LENGTH;
        return env->NewStringUTF("");
    }

    llama_token next = token;
    int32_t result = 0;
    try {
        llama_batch batch = llama_batch_get_one(&next, 1);
        result = llama_decode(g_ctx, batch);
    } catch (const std::exception & error) {
        g_accel_failed.store(true);
        g_finish_reason = FINISH_ERROR;
        set_error(std::string("El acelerador rechazó el siguiente token: ") + error.what());
        return nullptr;
    }

    if (result != 0) {
        if (g_abort.load()) {
            g_finish_reason = FINISH_ABORT;
        } else {
            g_finish_reason = FINISH_ERROR;
            set_error("llama.cpp falló al generar el siguiente token.");
        }
        return nullptr;
    }

    g_generated_tokens++;
    // El token decodificado ya forma parte del KV del contexto; el siguiente
    // turno lo puede reutilizar si aparece igual en el historial.
    g_cached_tokens.push_back(next);
    if (g_generated_tokens >= g_max_tokens) {
        g_finish_reason = FINISH_LENGTH;
    }

    return env->NewStringUTF(piece.c_str());
}

JNIEXPORT jint JNICALL
Java_org_verbovivo_app_LlamaJni_nativeCacheReusedTokens(JNIEnv * /*env*/, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_state_mutex);
    return g_cache_reused_tokens;
}

/**
 * Marca el KV para descartarse antes del próximo prompt. No toca la memoria
 * ahora: si hay una generación en curso, se aplicaría en medio del cálculo.
 */
JNIEXPORT void JNICALL
Java_org_verbovivo_app_LlamaJni_nativeResetCache(JNIEnv * /*env*/, jclass /*clazz*/) {
    g_cache_reset_requested.store(true);
}

JNIEXPORT jint JNICALL
Java_org_verbovivo_app_LlamaJni_nativeFinishReason(JNIEnv * /*env*/, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_state_mutex);
    return g_finish_reason;
}

JNIEXPORT jint JNICALL
Java_org_verbovivo_app_LlamaJni_nativePromptTokens(JNIEnv * /*env*/, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_state_mutex);
    return g_prompt_tokens;
}

JNIEXPORT jint JNICALL
Java_org_verbovivo_app_LlamaJni_nativeGeneratedTokens(JNIEnv * /*env*/, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_state_mutex);
    return g_generated_tokens;
}

JNIEXPORT jstring JNICALL
Java_org_verbovivo_app_LlamaJni_nativeLastError(JNIEnv * env, jclass /*clazz*/) {
    std::lock_guard<std::mutex> lock(g_state_mutex);
    return string_to_jstring(env, g_last_error);
}

JNIEXPORT void JNICALL
Java_org_verbovivo_app_LlamaJni_nativeAbort(JNIEnv * /*env*/, jclass /*clazz*/) {
    g_abort.store(true);
}

JNIEXPORT void JNICALL
Java_org_verbovivo_app_LlamaJni_nativeRelease(JNIEnv * /*env*/, jclass /*clazz*/) {
    g_abort.store(false);
    g_accel_failed.store(false);
    std::lock_guard<std::mutex> lock(g_state_mutex);
    release_locked();
    g_last_error.clear();
}

JNIEXPORT jboolean JNICALL
Java_org_verbovivo_app_LlamaJni_nativeAccelerationFailed(JNIEnv * /*env*/, jclass /*clazz*/) {
    return g_accel_failed.load() ? JNI_TRUE : JNI_FALSE;
}

}  // extern "C"
