# Inferencia LLM en móvil: estado del arte y decisión para VerboVivo

**Fecha:** 2026-10-27  
**Alcance:** cómo ejecutan modelos las herramientas móviles modernas, por qué VerboVivo filtra el catálogo GGUF, cómo se implementó llama.cpp nativo en Android (CPU, Vulkan y Hexagon NPU) y qué límites quedan.

**Estado:** el APK usa llama.cpp con CPU y Vulkan. La CPU está estable y verificada. Vulkan está verificado en el RedMagic 9 Pro (Adreno 750) solo con un 0.5B Q4_0: todas las capas en GPU, texto coherente y ~2,4× frente a CPU; los K-quant del catálogo no pueden usar la GPU en ese driver y el 1.5B Q4_0 produce resultados incorrectos (ver 4.2). La **NPU Hexagon** está implementada y empaquetada, pero el firmware del RedMagic bloquea `libcdsprpc.so` para aplicaciones: no es accesible desde la app (ver 4.3). Cualquier acelerador que tumbe el proceso queda en cuarentena (ver 4.4).

## 1. Qué hace la industria

| Enfoque | Cómo ejecuta el modelo | Ventajas | Coste para VerboVivo |
| :--- | :--- | :--- | :--- |
| **llama.cpp nativo (NDK/JNI)** | Compila llama.cpp para `arm64-v8a`/`x86_64`, usa NEON, dotprod/i8mm y varios hilos; puede usar GPU/NPU con backends adicionales. | Es la vía más rápida en Android y la que usan la mayoría de apps de LLM local. | Hay que empaquetar `.so` por ABI, puentear JNI, copiar el GGUF desde OPFS a un path nativo y verificar streaming. Aumenta el APK. |
| **MediaPipe LLM Inference / LiteRT-LM** | Ejecuta modelos convertidos (`.task`, `.litertlm`) con delegado de CPU/GPU. | API Android/iOS/web, GPU opcional, integración sencilla. | No carga GGUF: exige convertir el modelo y cambiar el formato del catálogo. |
| **MLC LLM** | Compila el modelo a un artefacto propio y lo ejecuta con WebGPU/Vulkan. | Buen rendimiento gráfico y despliegue web. | No es compatible con GGUF; requiere compilar por modelo y mantener otro runtime. |
| **ONNX Runtime GenAI** | Modelos ONNX con ejecución CPU/GPU. | Ecosistema amplio y multiplataforma. | Conversión de modelo y otro runtime; el catálogo actual no sirve tal cual. |
| **Qualcomm Genie / QAIRT** | Aprovecha la NPU de Snapdragon con binarios específicos. | Rendimiento energético superior en devices compatibles. | Muy dependiente del chip; no cubre toda la gama Android. |
| **WebGPU en navegador** | Acelera operaciones en GPU desde el navegador. | Sin binarios nativos. | No está disponible en el WebView de Android que usa la app; además exigiría un runtime distinto a wllama. |
| **WASM + WebView (actual)** | llama.cpp compilado a WebAssembly dentro del WebView. | Cero instalación, mismo código en PC y Android, funciona offline. | En Android no hay `SharedArrayBuffer`: un solo hilo. El prefill y la generación son lentos. |

## 2. Por qué Android queda en un hilo

La app necesita `crossOriginIsolated` y `SharedArrayBuffer` para que wllama reparta el trabajo entre hilos. En el WebView de Android usado por Capacitor:

- `crossOriginIsolated` es `false` y `SharedArrayBuffer` no está expuesto.
- Inyectar `COOP`/`COEP` no cambia esa limitación y rompía el worker de wllama.
- El resultado medido en el emulador: 0.5B cargó y respondió, pero una respuesta breve tardó alrededor de 3 minutos; la autoprueba mínima («amén») tardó 8,7 s.

No es un problema de RAM: un teléfono de 8 GB sigue ejecutando el modelo en un solo hilo. Por eso ofrecer 1.5B, 3B o 7B allí sería vender una opción que el usuario no puede usar.

## 3. Decisión implementada: filtro + motor nativo

`buildDeviceCatalog()` en `src/core/inference/modelRegistry.ts` clasifica cada perfil como usable o no usable según:

1. **Plataforma y runtime:** Android con llama.cpp nativo → según RAM y ABI reales. Android sin JNI → solo 0.5B. PC sin `COOP/COEP` → hasta 1.5B. PC aislado → según RAM. Tauri/nativo con RAM real → el mayor que quepa.
2. **RAM:** con motor nativo los mínimos son 2 GB (0.5B), 4 GB (1.5B), 6 GB (3B) y 12 GB (7B). La recomendación automática en un teléfono es siempre 1.5B desde 4 GB: 3B y 7B caben en equipos grandes, pero se ofrecen como elección manual con advertencia porque el primero es más lento y consume más batería y el segundo no es un cerebro diario de teléfono. Si el navegador informa exactamente 8 GB, se advierte que puede ser un tope de medición.
3. **Espacio:** si el espacio libre es menor que el archivo, la descarga se bloquea; si es menor que el doble, se advierte.
4. **Archivos ya descargados:** un 7B heredado en un teléfono sigue visible con «No viable aquí» y su motivo, para que el usuario sepa qué ocupa espacio, pero no se puede activar.

La UI (`ModelManagerModal.tsx`) solo pinta `visibleEntries` (usables o ya instalados), deshabilita descarga/activación de lo inviable y muestra el motivo. Si el cerebro activo dejó de ser viable, la cabecera ofrece cambiar al óptimo.

El adaptador `OnDeviceAdapter` elige una sola vez por instancia:

- **Android con el plugin nativo disponible:** `NativeLlamaAdapter` (JNI + `libllama.so`).
- **PC/web, ABI no incluida o APK antiguo:** `WllamaAdapter` (WASM), sin fingir que hay motor nativo.

## 4. Salto nativo implementado

El APK de Android incluye llama.cpp compilado con el NDK 27:

1. `libllama.so`, `libggml.so`, `libggml-base.so`, `libggml-cpu.so` y `libggml-vulkan.so` para `arm64-v8a` y `x86_64`.
2. Puente JNI (`llama_jni.cpp`) con carga del modelo, formato de chat, muestreo, prefill por lotes, generación token a token, cancelación cooperativa y liberación de memoria.
3. Plugin Capacitor `LlamaNative` que mantiene el estado en memoria nativa, descarga los GGUF con OkHttp a `filesDir/models` (con `Range`, pausa, reanudación y progreso) y emite eventos `llamaToken` / `llamaActivity`.
4. `NativeLlamaAdapter` y `OnDeviceAdapter` en TypeScript; el segundo cae a wllama cuando el binario no está disponible.
5. La compilación ARM64 usa línea base `armv8-a` (sin exigir dotprod) para evitar SIGILL en teléfonos ARM64 antiguos.
6. Hilos: el plugin reserva `cores - 1` (mínimo 2, máximo 6), dejando un núcleo para la interfaz y la síntesis de voz.

### 4.1 Verificación en emulador (x86_64)

- `getInfo` reporta motor disponible, ABI `x86_64`, 3,9 GB de RAM real y 3 hilos recomendados en un emulador de 4 núcleos.
- Descarga nativa del 0.5B Q4_K_M: 491.400.032 bytes; pausa a 428.564.588 bytes y reanudación con `Range` hasta completar. Sin hash en el catálogo, la app informa `sha256Verified: false`.
- Carga del GGUF: ~0,2–0,5 s.
- Autoprueba desde el gestor («Cargar y probar»): respuesta «amén» en ~1,2 s, 13,5 tokens/s.
- Chat real por la app: prompt de 426 tokens, 55 s de prefill y ~2,5 tokens/s con el WebView renderizando en el emulador. Sin render de interfaz, el mismo equipo midió 13,1 s de prefill para 284 tokens y 14,4 tokens/s de generación.
- Cancelación: `finishReason: "abort"` en menos de un segundo tras `cancelGeneration`.

Las cifras con y sin interfaz muestran que el emulador por software es el cuello de botella, no el puente nativo. En el RedMagic 9 Pro (ARM64 físico) la app ya carga y responde con el 1.5B tras el arreglo de dispositivos de CPU; falta medir tokens/s, temperatura y batería en ese equipo.

**Respuestas largas:** el corte a 640 tokens del perfil 1.5B era un límite del adaptador, no del modelo. El motor nativo usa ahora 1024 tokens por bloque y, si el modelo agota el bloque, continúa automáticamente hasta el presupuesto del turno (máximo dos continuaciones), deduplica el solape y solo avisa si aun así queda cortado. En el 3B el bloque es 1200 y en el 7B 1800; el 0.5B se queda en 512 para no disparar el tiempo de espera.

### 4.2 GPU Vulkan en Android

El backend `ggml-vulkan` se compila como biblioteca compartida y se empaqueta por ABI. La app no supone que exista: lo detecta, comprueba que sea una GPU real y solo entonces pide el offload.

**Detección y honestidad**

- `probe_gpu()` consulta los dispositivos `GPU`/`IGPU` de ggml, lee nombre, descripción y memoria, y marca como software los rasterizadores conocidos (`SwiftShader`, `llvmpipe`, `lavapipe`, `softpipe`).
- `usable` exige que no sea software y que `llama_supports_gpu_offload()` sea verdadero.
- Con GPU usable se cargan todas las capas (999); sin acelerador viable, 0. En modo automático, un `gpuLayers > 0` sin acelerador utilizable se degrada a 0 para no anunciar una aceleración inexistente. Si se pide un objetivo explícito (`npu`/`gpu`) y falla, el JNI **no** cae en silencio a la CPU: devuelve el error real y Java decide la cuarentena y el reintento. Si hay NPU Hexagon, se intenta antes que la GPU (ver 4.3).
- Si la carga o la reserva del contexto fallan con GPU, se libera, se reintenta en el siguiente objetivo y la respuesta incluye `gpuFallback` con el motivo. La interfaz muestra «CPU» o el fallback, nunca «GPU» a medias.
- **Fallo en tiempo de ejecución:** si el backend aborta durante el cálculo, el plugin rechaza con el código `ACCELERATION_FAILED`, libera la sesión rota y pone el acelerador en cuarentena. El adaptador de TypeScript recarga el modelo en CPU y repite el bloque automáticamente, sin que el usuario reenvíe el mensaje. Si ya se habían mostrado tokens de ese bloque, no repite para no duplicar texto: explica que el motor quedó en CPU y pide reenviar.
- **Adreno y cierres del driver:** en Adreno 660/710/750/830 hay reportes de SIGSEGV o aborto dentro del driver Vulkan al crear pipelines de cómputo (por ejemplo, `vkCreateComputePipelines` en Galaxy S24 con Adreno 750, y falta de `libllvm-qgl.so` en Adreno 830). Ese fallo ocurre en código nativo y no se puede capturar con `try/catch`: mata el proceso. Por eso el modo automático **no intenta Vulkan en Adreno**; usa NPU Hexagon o CPU. Qualcomm recomienda además el backend OpenCL para Adreno, que no está integrado en este APK.
- **Reproducido y corregido en RedMagic 9 Pro** (NX769J, Snapdragon 8 Gen 3 / SM8650, Android 16, páginas de 4 KB). Todas las cargas abortaban con `terminating due to uncaught exception of type vk::UnknownError: vk::Device::createComputePipeline: ErrorUnknown` dentro de `libggml-vulkan.so`, invocado desde `llama_decode` y `nativeStartPrompt`. `ApplicationExitInfo` lo registraba como `APP CRASH(NATIVE)` (`reason=5`). El objetivo elegido por Java no era la causa: en el intento de CPU el JNI dejaba `model_params.devices` en `null` y llama.cpp añadía por su cuenta **todas** las GPU registradas; el planificador ejecutaba operaciones en Vulkan aunque `n_gpu_layers=0`, y el driver abortaba. Se corrigió pasando para CPU una lista de dispositivos vacía terminada en `null` (`{nullptr}`) y desactivando `offload_kqv`/`op_offload`. Además, el JNI descarta Vulkan en modo automático si el nombre del dispositivo contiene «Adreno», y la política Java lo omite también cuando el SoC es Qualcomm aunque el nombre no lo diga.

**Compilación**

- Se usa el NDK 27 y los encabezados oficiales de Vulkan/SPIRV-Headers, porque el NDK solo trae los encabezados C y `glslc` es más antiguo que el Vulkan SDK.
- El generador de shaders se compila para el host con MinGW (`HOST_C_COMPILER`/`HOST_CXX_COMPILER`), ya que el clang del NDK no enlaza las utilidades de Windows.
- Se añadió un shim `vulkan-compat.cpp` para `vkGetPhysicalDeviceFeatures2` en API < 28 (el stub del NDK no lo exporta y las bibliotecas se enlazan con `BIND_NOW`). Si el loader no ofrece la función, el shim devuelve las features de Vulkan 1.0; el dispositivo queda como no utilizable y se usa CPU.
- Se parcheó el respaldo de `ggml_vk_instance_init()` para aplicar `ggml_vk_device_is_supported()` también al primer dispositivo no-CPU. Sin ese filtro, un Vulkan de software sin `storageBuffer16BitAccess` quedaba registrado y **toda** carga de modelo fallaba con `Unsupported device`, incluso pidiendo 0 capas de GPU.

**Límites y verificación**

- La GPU acelera el cálculo; no añade RAM. En un teléfono, el modelo, el contexto y el sistema comparten memoria, así que los mínimos del catálogo no bajan por tener Vulkan.
- En el emulador x86_64, Vulkan existe pero es `Goldfish GFXStream (SwiftShader)` y no soporta 16-bit storage: la app lo excluye, informa «CPU» y el 0.5B vuelve a cargar correctamente. Esa cifra no representa a una GPU física.
- **Límites del Adreno 750 (SM8650) medidos con `test-backend-ops` en el RedMagic 9 Pro:** `uma:1 fp16:1 bf16:0 fp4:0 warp size:64 shared memory:32768 int dot:0 matrix cores:none`. De ahí salen tres restricciones concretas:
  1. **El matmul cuantizado del prefill no compila.** Con más de 8 columnas el planificador de ggml usa `mul_mat` por lotes y `vkCreateComputePipelines` devuelve `ErrorUnknown`; con 8 o menos usa `mul_mat_vec`, que sí compila. El JNI recorta `n_batch` a 8 cuando el objetivo es la GPU en un Adreno 750, de modo que el primer decode no falle aunque Java pida 512.
  2. **Los K-quant no pueden usar la GPU.** Los pipelines dmmv de `q4_k`/`q6_k` fallan al crearse. Todo el catálogo actual es Q4_K_M, así que ningún perfil descargable puede acelerarse por Vulkan en este driver.
  3. **La ruta de subgrupos mata el driver.** Con `rfs=1 subgroup=64` el proceso muere con SIGSEGV/SIGABRT. Por eso en Adreno se usa la ruta de memoria compartida y la variable `GGML_VK_ADRENO_750_SHMEM` existe solo como diagnóstico.
- **Precisión numérica del shmem:** con Q4_0 la ruta de memoria compartida es correcta en las formas del 0.5B (K=896) y **incorrecta** en las del 1.5B (K=1536): con una sola capa offload el texto es coherente, con dos o más se convierte en basura (`16(-5<IB4OH?G8V;`). Desactivar la atención flash no cambia el resultado, así que el error está en el dmmv y no en la atención.
- **Cifra real verificada:** Qwen2.5-0.5B Q4_0 con todas las capas en Vulkan (lote ≤ 8, shmem) genera texto coherente a **~11,9 tok/s** frente a **~4,95 tok/s** en CPU con el mismo archivo: unas 2,4× en la generación. El 1.5B Q4_0 no es viable en GPU por el error numérico anterior. Ningún modelo Q4_K_M del catálogo es viable en GPU por el punto 2.
- **Perfil opcional «Modo rápido» (`ULTRALIGHT_GPU`):** el catálogo incluye ahora el 0.5B Q4_0 (`verbovivo_0.5b_q4_0.gguf`, 429 MB) para que la GPU acelere algo real. Solo se muestra en Android nativo con Adreno 750 (o si ya está descargado); el adaptador pide Vulkan explícito con todas las capas y, si la carga o el cálculo fallan, recarga en CPU sin sacar al usuario del chat. La tarjeta lo etiqueta como «GPU verificado» y advierte que su contexto es de 2048 tokens y su calidad de gama de entrada: para exégesis o informes largos siguen recomendándose 1.5B/3B en CPU. El resto del catálogo no cambia y sigue omitiendo Vulkan en Adreno.
- **Pendiente para ampliar la matriz:** repetir `test-backend-ops` con las formas de Qwen (1536/8960/151936 × 1536 y 896) para otros tipos (`q5_0`, `q5_1`, `q8_0`). Si alguno coincide con la CPU en K=1536, se podría ofrecer un perfil de 1.5B acelerado; hasta entonces, GPU solo está verificada en el 0.5B Q4_0 y el modo automático sigue omitiendo Vulkan en Adreno.
- **Alineación de 16 KB (resuelta):** las `.so` de CPU, Vulkan y el puente JNI se reenlazaron con `-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384` y declaran `align=0x4000`; el APK pasa `zipalign -c -P 16`. Las imágenes DSP del backend Hexagon siguen a 4 KB porque las produce el SDK de Qualcomm; por eso ese backend experimental se excluye del APK por defecto (`-PverbovivoHexagon=true` lo reincorpora solo para pruebas). El RedMagic 9 Pro usa páginas de 4 KB, así que este cambio no altera su comportamiento; desbloquea dispositivos de 16 KB y Play Store con `targetSdk 36`.
- El APK depende de `libvulkan.so` a través de `libggml-vulkan.so`. En un Android sin loader Vulkan, el motor nativo puede no cargar y la app cae a wllama; no se presenta como si la GPU estuviera activa.

### 4.3 NPU Hexagon en Android (implementada, experimental)

La vía elegida no fue QNN/Genie ni LiteRT-LM, sino el backend **`ggml-hexagon`** que ya incluye llama.cpp (commit `27b7a8a`, versión 0.7.0-dev). Así el catálogo GGUF existente sirve sin conversiones ni un segundo runtime, y el backend se usa solo en Snapdragon compatible.

**Por qué no LiteRT-LM:** el AAR 0.18.1 de `litertlm-android` solo incluye `liblitertlm_jni.so`; las bibliotecas del delegado NPU (`libLiteRtDispatch_Qualcomm.so`) no se empaquetan y habría que compilarlas desde QAIRT. Eso implica otro formato de modelo (`.litertlm`) y otro catálogo, sin ventaja clara frente a Hexagon para los GGUF actuales. ONNX/QNN y MLC tienen el mismo problema de formato y de SDK propietario.

**Detección y decisión**

- `probe_npu()` lee `ro.soc.manufacturer`, `ro.soc.model` y `ro.board.platform`. Continúa si el fabricante es Qualcomm, QTI o QCOM, o si el modelo/board identifican un Snapdragon conocido aunque el fabricante no use el nombre largo. Varios firmware publican `QTI` (Qualcomm Technologies, Inc.); exigir la cadena «qualcomm» impedía probar Hexagon en el RedMagic 9 Pro.
- Un mapa conservador asocia el SoC con la versión Hexagon: SM8850/Volcano → v81, SM8750/Sun → v79, SM8650/Pineapple y SM8635/SM7675/SM7635 → v75, SM8550/Kalama → v73, QCS8550/QCM8550 → v73. SM8450/Taro es v69: se rechaza con motivo porque el backend exige ≥ v73, y no se intenta abrir una sesión que fallará.
- Si la arquitectura no se puede determinar (`arch == 0`), la NPU queda `available` pero **no** `usable`: preferimos la política automática antes que arriesgar un cuelgue en un SoC no mapeado.
- La biblioteca `libggml-hexagon.so` se carga con `dlopen` solo en `arm64-v8a` y solo para Qualcomm. Después se registra explícitamente con `ggml_backend_register()` (el `libggml.so` precompilado no incluye `GGML_HEXAGON`) y se enumeran sus dispositivos con nombre de registro `"HTP"`.
- `probe_gpu()` excluye el dispositivo cuyo backend se llama `"HTP"`: Hexagon se declara como `GGML_BACKEND_DEVICE_TYPE_GPU` ante ggml y, sin ese filtro, la interfaz anunciaría Vulkan sin serlo.

**Orden de carga y retroceso**

1. Si la NPU es `usable`, se intenta cargar el GGUF con todas las capas en HTP.
2. Si falla el modelo o el contexto KV, se libera todo y se pasa al siguiente objetivo. En Adreno el siguiente es CPU; en otras GPU es Vulkan y luego CPU.
3. `nativeLoadInfo()` devuelve `acceleration` (`npu`/`gpu`/`cpu`), `npuFallback`/`gpuFallback` y los motivos. La UI solo dice «NPU» cuando `acceleration === "npu"`; una NPU detectable pero que no abre se muestra como «CPU (NPU no utilizable)», «CPU (retroceso desde NPU)» o «CPU (NPU bloqueada tras un cierre)», según corresponda.

**Empaquetado y compilación**

- Se usó el toolchain Docker de Qualcomm (`ghcr.io/snapdragon-toolchain/arm64-android:v0.8`, Hexagon SDK 6.7.0.0) para producir `libggml-hexagon.so` y los skels `libggml-htp-v73/75/79/81/85.so` (unos 0.8–0.9 MB cada uno).
- Las bibliotecas van solo en `arm64-v8a`; el emulador `x86_64` no tiene Hexagon y no se empaqueta allí.
- `useLegacyPackaging = true` hace que Android extraiga las `.so` al instalar. El backend abre el skel del DSP con la URI `file:///libggml-htp-vXX.so`, por lo que la ruta de `nativeLibraryDir` debe estar en la búsqueda del linker del proceso.
- El backend habilita el modo de módulos sin firma (`DSPRPC_CONTROL_UNSIGNED_MODULE`) y usa `libcdsprpc.so`, que existe en los Snapdragon; en un SoC sin FastRPC la carga falla y se retrocede.

**Límites y verificación**

- **Probada en hardware: la NPU no es accesible para la app en el RedMagic 9 Pro.** El APK se instaló y ejecutó en un RedMagic 9 Pro (SM8650 → Hexagon v75). La sonda NPU no se ejecutaba porque el firmware publica `ro.soc.manufacturer=QTI` y el JNI exigía la cadena `qualcomm`; se corrigió para aceptar `QTI`/`QCOM` cuando el SoC mapea a v73–v85. Tras esa corrección, `libggml-hexagon.so` carga y `runtimePresent` es `true`, pero `ggml_backend_hexagon_reg()` devuelve `NULL`. El diagnóstico añadido al JNI aisló la causa: `htpdrv_init()` no puede abrir `libcdsprpc.so`. El archivo existe en `/vendor/lib64` (467 560 bytes, ELF64 AArch64), figura en `/vendor/etc/public.libraries.txt` y exporta todos los símbolos requeridos (`rpcmem_*`, `fastrpc_mmap/munmap`, `dspqueue_*`, `remote_handle64_*`, `remote_session_control`), pero el enlazador de Android 16 responde `library "libcdsprpc.so" not found` por nombre y `is not accessible for the namespace "clns-9"` por ruta absoluta. Precargar la biblioteca antes del backend tampoco lo evita. Es una restricción del firmware, no del APK: no se empaqueta la biblioteca propietaria del vendedor para intentar saltarla. La app lo informa como «El firmware bloquea libcdsprpc.so para aplicaciones; la NPU no es accesible desde esta app» y usa CPU. La afirmación correcta hoy es «implementada, empaquetada y con detección corregida», no «aceleración NPU verificada».
- Riesgos pendientes si se probara en otro firmware: que el enlazador exponga `libcdsprpc.so` a la app, que el DSP acepte la URI del skel extraído, que la sesión sin firma se abra, que el límite de memoria de sesión (~3.5 GB) no baste para modelos grandes y que el reparto NPU/CPU de capas no degrade el rendimiento.
- La NPU **no amplía la RAM**. Un 7B sigue necesitando sus pesos y su caché KV; mejora latencia y consumo, no el techo de tamaño. Los mínimos de memoria del catálogo (2/4/6/12 GB) no cambian por tener NPU.
- Solo cubre Snapdragon v73–v85. Exynos, Tensor, MediaTek y Snapdragon anteriores a v73 se quedan en CPU (o Vulkan si el driver no es Adreno), y la interfaz lo explica con el nombre del SoC o el motivo.

### 4.4 Selección automática a prueba de cierres

El fallo del driver Vulkan no devuelve un error: el proceso muere. Para que la app siga siendo usable sin mentir, la política se apoya en cuatro piezas:

1. **Marcador previo:** antes de sondear o cargar con NPU/GPU, Java escribe de forma síncrona (`SharedPreferences.commit()`) el objetivo, la fase (`probe`/`load`/`runtime`) y el archivo. Si el proceso muere, el marcador queda en disco.
2. **Diagnóstico real:** al arrancar se consulta `ApplicationExitInfo`. Solo se cuarentena el acelerador si Android registró `REASON_CRASH_NATIVE`, `REASON_CRASH` o `REASON_SIGNALED` después del marcador. Cerrar la app a mano, que el sistema recicle el proceso o un fallo de RAM no desactivan la aceleración para siempre.
3. **Cuarentena y reintento:** un acelerador en cuarentena no se ofrece en modo automático; se usa el siguiente. La UI muestra el motivo y un botón para restablecerla después de actualizar firmware/APK.
4. **Cálculo, no solo carga:** tras cargar, el marcador se conserva hasta que una generación completa termina. Así también se detecta un cierre al crear pipelines en el primer `llama_decode`, no solo al abrir el GGUF.

La sonda de la NPU también lleva marcador: abrir una sesión FastRPC puede tumbar el proceso en un firmware incompatible, y en ese caso no se vuelve a tocar el DSP en el siguiente arranque. El coste es una escritura pequeña por carga/generación; el beneficio es que un driver roto no deja la app en un bucle de cierres.

**Verificación:** las pruebas unitarias cubren las etiquetas y la política; el APK compila para arm64-v8a y x86_64. En el RedMagic 9 Pro se confirmó que `ApplicationExitInfo` registra el cierre como `APP CRASH(NATIVE)` (`reason=5`) y que `dropbox` conserva la pila del aborto. **Falta verificar el ciclo completo** (que, tras el cierre, el siguiente arranque use NPU/CPU sin volver a tocar Vulkan) con el APK corregido; la prueba quedó pendiente porque el teléfono estaba bloqueado o en uso.

`GGML_CPU_ALL_VARIANTS` (variantes SIMD por chip) sigue pendiente como optimización independiente de la NPU.

## 4.5 Reparto eficiente con solo tres cerebros viables

La matriz real es corta: 0.5B Q4_K_M/CPU, 0.5B Q4_0/GPU y 1.5B/3B/7B en CPU. Con tan pocos perfiles, el coste no está en añadir modelos sino en **gastar menos llamadas y reservar cada cerebro para lo que sí sabe hacer**. La implementación separa tres responsabilidades:

1. **Contrato de esfuerzo por perfil.** `effortContract.ts` fija el presupuesto de cada perfil: 192 tokens sin continuación en 0.5B; 640 (400 + 240) con una continuación en 1.5B; 840 (560 + 280) en 3B; 1040 (640 + 400) en 7B. También limita los mensajes de historial (2/4/6) y los versículos completos inyectados (2/4/5/5). El adaptador nativo aplica ese contrato antes del tope duro de salida, así que el 0.5B no intenta encadenar bloques que su calidad y su velocidad no sostienen.
2. **Enrutado determinista del estudio.** `executionPolicy.ts` decide, sin llamar al modelo, si la respuesta debe componerla el motor verificado. Solo ocurre con proveedor `on-device`, acción `ANSWER`, sin continuación, sin saludo ni seguimiento, sin petición de documento y con señal de estudio (pregunta, tarea `estudiar` o vocabulario de exégesis). Un pasaje, libro, doctrina o personaje sin esa señal no se intercepta: consejería y diálogo abierto siguen en el modelo. La respuesta se marca como «motor verificado» y las citas salen literales de SQLite.
3. **Caché de composición y ampliación explícita.** `compositionCache.ts` guarda hasta 24 composiciones por sesión con una clave de acción, nivel, slots, texto normalizado y referencias. El orquestador la usa tanto en la ruta verificada como en el respaldo determinista. Cuando el modelo sí responde y corta por longitud, el resultado lleva `truncated`; la última burbuja muestra **Ampliar**, que envía «continúa» y fusiona la respuesta en el mismo mensaje.

**Prefijo estable y caché KV nativa (Fase 2, implementada).** `buildCompactSystemPrompt` ordena el prompt así: identidad y reglas de cita (fijas), instrucción de estilo, y al final contexto, estado, historial, tarea y Biblia verificada. La parte volátil queda al final porque el chat crece hacia adelante. `llama_jni.cpp` ya no limpia la memoria en cada generación: guarda los tokens cuyo KV sigue vivo (`g_cached_tokens`), compara el prompt nuevo con ese vector y decodifica solo la cola desde el primer token distinto. Verifica antes que `llama_memory_seq_pos_max(0) + 1` coincida con el vector; si no, descarta todo. Recorta el KV con `llama_memory_seq_rm` y siempre vuelve a decodificar el último token del prompt, porque el muestreador necesita su logit. Los tokens generados también se añaden a la caché, de modo que al pulsar «continúa» o al repetir el turno se reutiliza casi todo el prefijo. Se reinicia el muestreador en cada turno, como antes.

La caché se descarta completa cuando el prompt se recorta por la cabecera, cuando `seq_rm` falla (modelos de ventana deslizante), al recargar el modelo y cuando la app abre una conversación nueva: `nativeResetCache` solo marca una bandera y el JNI la aplica perezosamente antes del próximo prompt, para no vaciar el KV en medio de un cálculo. `generate` devuelve `cacheReusedTokens` y el adaptador lo suma en `usage.cacheReusedTokens`; en desarrollo se registra «KV N/M reutilizados» junto al prefill.

**Medición en el RedMagic 9 Pro (2026-10-28).** Con el APK instalado y la app en primer plano se llamó al puente nativo con prompts crecientes, que usan el mismo camino de prefill que el chat:

- **3B Q4_K_M en CPU:** 80 tokens → `cacheReusedTokens` 0 y prefill de 4.312 ms. El mismo texto más una frase: 89 tokens, 80 reutilizados, prefill de 471 ms. Unas 9× menos.
- **Qwen2.5-0.5B Q4_0 en Vulkan:** 81 tokens → 3.370 ms (incluye la compilación de pipelines del primer cálculo); 88 tokens con 81 reutilizados → 244 ms. Tras `resetCache`, el mismo prompt vuelve a 0 reutilizados y 1.548 ms; repetido otra vez reutiliza 87 de 88 y baja a 56 ms, unas 27× frente al prefill completo ya caliente.
- **Coherencia:** el mismo prompt con KV reutilizado y tras el reinicio del KV produjo la misma continuación, sin texto corrupto ni cierres en Vulkan. La calidad del 0.5B sigue siendo la suya: alucina referencias y a veces responde con números; eso es el modelo, no la caché. Los tokens generados también se reutilizan: al repetir el turno el recuento sube de 81 a 87.

**Verificación.** `npx tsc --noEmit` limpio y 299 pruebas en 21 archivos. Las nuevas cubren los presupuestos exactos, el estilo compacto, la política de enrutado (pasaje con señal sí; diálogo abierto, consejería, continuación y documento no), los versículos completos sin elipsis, el límite de historial, la caché (una sola llamada a la fábrica), las voces reales del dispositivo (sin catálogo inventado, sin alias `-language` y sin duplicados local/red) y la suma de tokens reutilizados del KV en `usage`. La prueba de integración del orquestador confirma que «explícame Salmos 23:1» responde con el motor verificado sin tocar el puente nativo.

**Verificación en el RedMagic 9 Pro (2026-10-28).** El teléfono apareció en ADB y se comprobó sobre el APK instalado:

- Vulkan informa `name: "Vulkan0"` y `description: "Adreno (TM) 750"`. La detección del perfil Q4_0 mira ambos campos, así que la tarjeta muestra «Modo rápido verificado… 2,4×» y ya no el aviso contradictorio de que se ejecutaría en CPU. `LlamaNative.getInfo()` devuelve `acceleration: "gpu"` con el perfil 0.5B Q4_0 cargado.
- El 0.5B responde con una sola llamada de 192 tokens y sin encadenar continuaciones. Su calidad es de gama de entrada: en una prueba conversacional devolvió una frase corta y genérica, coherente con el aviso del catálogo.
- El historial que se envía al modelo ya no contiene notas del sistema («límite de tokens», «pulsa Ampliar») ni el marcador `[…]`; ambos se colaban en la salida de un 0.5B. En modo compacto solo se conserva la cola de la respuesta anterior.
- El 3B cargó en CPU y «continúa» empalmó texto nuevo en la misma burbuja sin duplicar la respuesta. Si un modelo reescribe lo mismo y no aporta nada, la burbuja muestra una nota honesta en lugar de quedarse igual sin explicación.
- **Selector de cerebro unificado.** El gestor mostraba dos rejillas sobre el mismo catálogo: la de perfiles activaba y la de «Archivos GGUF» solo cambiaba la descarga, así que elegir ahí y guardar dejaba el cerebro anterior. Se eliminó la rejilla duplicada; queda una sola lista con distintivo «En uso» y «Seleccionado · pulsa Guardar y activar». En el RedMagic se activó 1.5B, la etiqueta global pasó a «En el dispositivo · 1.5B Q4_K_M», se restauró 3B y la selección sobrevivió a una recarga del WebView.
- **Voces reales en lugar de etiquetas.** El catálogo anterior inventaba siete voces «naturales» y reproducía mediante `translate.google.com`; al fallar, el motor usaba la voz por defecto y todas sonaban igual. Ahora solo se listan las voces que `getSupportedVoices()` devuelve, deduplicando la pareja `-local`/`-network`, y se pasa el `voiceURI` exacto al motor nativo. En el RedMagic hay 18 voces en español en bruto y 9 timbres únicos; se eligió «Masculina [ED]», se guardó en `verbovivo_tts_voice_v1` y tras recargar el WebView la barra siguió usando esa voz.

Sigue pendiente solo la NPU (bloqueada por el espacio de nombres del enlazador, tarea #34). La caché KV ya está medida en hardware: ver arriba. La app quedó detenida tras la prueba; al abrirla recarga el 3B según su configuración.

## 5. Fuentes

- llama.cpp, documentación de Android: <https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md>
- llama.cpp, compilación con Vulkan: <https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md>
- Android NDK, guía de gráficos y Vulkan: <https://developer.android.com/ndk/guides/graphics>
- Khronos, Vulkan-Headers: <https://github.com/KhronosGroup/Vulkan-Headers>
- MediaPipe LLM Inference en Android: <https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/android>
- LiteRT-LM: <https://ai.google.dev/edge/litert-lm>
- MLC LLM: <https://llm.mlc.ai/docs/>
- ONNX Runtime GenAI: <https://onnxruntime.ai/docs/genai/>
- Chromium, seguimiento de `SharedArrayBuffer` en WebView: <https://issues.chromium.org/issues/40914606>

Las cifras de rendimiento de terceros no se copian aquí como garantía: la referencia real de este proyecto es la medición en el emulador y las pruebas de `src/tests/onDeviceBrain.test.ts` y `src/tests/deviceCatalog.test.ts`.
