# Capa nativa de Android

VerboVivo ejecuta GGUF con llama.cpp dentro de la app. El proyecto Gradle, el puente JNI y las bibliotecas precompiladas viven en `android/` y se versionan en el repositorio; el árbol completo de llama.cpp y los directorios de compilación quedan fuera de git para no inflar el historial.

## Componentes

| Ruta | Contenido |
| :--- | :--- |
| `app/src/main/java/org/verbovivo/app/` | Plugin de Capacitor (`LlamaNativePlugin`), puente JNI (`LlamaJni`) y actividad principal. |
| `app/src/main/cpp/llama_jni.cpp` | Carga del modelo, prefill por lotes, muestreo, caché KV y detección de aceleradores. |
| `app/src/main/cpp/CMakeLists.txt` | Compila solo el puente JNI y enlaza contra las bibliotecas de `jniLibs`. |
| `app/src/main/jniLibs/arm64-v8a/` | Bibliotecas para teléfonos: CPU, Vulkan y Hexagon (skels DSP). |
| `app/src/main/jniLibs/x86_64/` | Bibliotecas para el emulador; sin Hexagon. |
| `native/llama-headers/` | Cabeceras públicas y licencia del llama.cpp con el que se generaron las `.so`. |

## Origen de las bibliotecas

Las `.so` se compilaron con el NDK 27.0.12077973 a partir de llama.cpp en el commit `27b7a8a` (27 de octubre de 2026), con línea base `armv8-a` para no provocar SIGILL en teléfonos antiguos. El puente JNI se compila en cada build; llama.cpp no.

Si se actualiza llama.cpp hay que recompilar las bibliotecas de ambos ABI, copiarlas a `jniLibs/<abi>/` y sustituir `native/llama-headers` por las cabeceras del mismo commit. Una cabecera y una biblioteca de versiones distintas pueden compilar y fallar en tiempo de ejecución.

## Backends

- **CPU:** siempre disponible y el único camino estable en todos los dispositivos.
- **Vulkan:** se usa solo cuando el perfil lo pide y el driver lo admite. En Adreno 750 la única combinación verificada es Qwen2.5-0.5B Q4_0; los K-quant no crean pipelines en ese driver.
- **Hexagon:** el backend va empaquetado, pero en el firmware probado (RedMagic 9 Pro, Android 16) el enlazador no permite a la app abrir `libcdsprpc.so`. La app lo informa como «NPU presente pero no utilizable» y continúa en CPU o Vulkan. No se empaquetan bibliotecas propietarias de Qualcomm para forzarlo.

## Compilación

```bash
npm run build
npx cap copy android
cd android
./gradlew assembleDebug
```

Salida: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Firma

`android/keystore.properties` y el keystore están ignorados por git. Para firmar un release, copia `android/keystore.properties.example`, ajusta las credenciales y coloca el archivo `.keystore` en la ruta indicada. Sin ese archivo, las compilaciones usan la firma de depuración estándar.

## Pendiente conocido

La alineación de páginas de 16 KB: las `.so` actuales, salvo la de Hexagon, declaran `align=0x1000`. No afecta a dispositivos de 4 KB como el RedMagic 9 Pro, pero es un requisito para publicar en Play Store en dispositivos con páginas de 16 KB.
