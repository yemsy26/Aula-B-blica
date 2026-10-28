cmake_minimum_required(VERSION 3.22)
project(verbovivo_llama_jni CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# llama.cpp se compila una vez con el NDK y se empaqueta en jniLibs. Aquí solo
# compilamos el puente JNI, para que cada build de la app tarde segundos y no
# recompile los ~15 MB de ggml en cada cambio de WebView.
# Las cabeceras públicas se versionan en android/native/llama-headers, que debe
# coincidir con el commit de llama.cpp con el que se generaron las .so.
set(LLAMA_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../../native/llama-headers")
set(JNI_LIBS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}")

if(NOT EXISTS "${LLAMA_ROOT}/include/llama.h")
    message(FATAL_ERROR "No se encontró llama.cpp en ${LLAMA_ROOT}")
endif()
if(NOT EXISTS "${JNI_LIBS_DIR}/libllama.so")
    message(FATAL_ERROR "Faltan las librerías nativas en ${JNI_LIBS_DIR}")
endif()
# Vulkan es opcional: si el build no lo incluye, la app funciona en CPU y el
# plugin informa gpu.available=false. No bloqueamos la compilación por eso.
set(HAS_VULKAN FALSE)
if(EXISTS "${JNI_LIBS_DIR}/libggml-vulkan.so")
    set(HAS_VULKAN TRUE)
endif()

add_library(llama SHARED IMPORTED)
set_target_properties(llama PROPERTIES
    IMPORTED_LOCATION "${JNI_LIBS_DIR}/libllama.so"
    INTERFACE_INCLUDE_DIRECTORIES "${LLAMA_ROOT}/include"
)

add_library(ggml SHARED IMPORTED)
set_target_properties(ggml PROPERTIES
    IMPORTED_LOCATION "${JNI_LIBS_DIR}/libggml.so"
    INTERFACE_INCLUDE_DIRECTORIES "${LLAMA_ROOT}/ggml/include"
)

add_library(ggml-base SHARED IMPORTED)
set_target_properties(ggml-base PROPERTIES
    IMPORTED_LOCATION "${JNI_LIBS_DIR}/libggml-base.so"
)

add_library(ggml-cpu SHARED IMPORTED)
set_target_properties(ggml-cpu PROPERTIES
    IMPORTED_LOCATION "${JNI_LIBS_DIR}/libggml-cpu.so"
)

if(HAS_VULKAN)
    add_library(ggml-vulkan SHARED IMPORTED)
    set_target_properties(ggml-vulkan PROPERTIES
        IMPORTED_LOCATION "${JNI_LIBS_DIR}/libggml-vulkan.so"
    )
endif()

add_library(verbovivo_llama_jni SHARED llama_jni.cpp)

target_include_directories(verbovivo_llama_jni PRIVATE
    "${LLAMA_ROOT}/include"
    "${LLAMA_ROOT}/ggml/include"
)

target_link_libraries(verbovivo_llama_jni
    llama
    ggml
    ggml-base
    ggml-cpu
    dl
    log
)

if(HAS_VULKAN)
    target_link_libraries(verbovivo_llama_jni ggml-vulkan)
endif()
