# VerboVivo

> **Plataforma de estudio bíblico, exégesis y homilética offline-first**  
> *Canon verificado, diálogo teológico con memoria y conexión opcional a un modelo local.*

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Engine: Node.js >=20.19](https://img.shields.io/badge/Node.js-%3E%3D20.19-emerald.svg)](https://nodejs.org/)
[![Database: SQLite WASM](https://img.shields.io/badge/Database-SQLite%20(WASM)-blue.svg)](https://sql.js.org/)
[![Tests: 301 Passing](https://img.shields.io/badge/Tests-301%2F301%20Passed-brightgreen.svg)]()
[![CI](https://github.com/yemsy26/Aula-B-blica/actions/workflows/ci.yml/badge.svg)](https://github.com/yemsy26/Aula-B-blica/actions/workflows/ci.yml)
[![Platform: PWA / Web / Android](https://img.shields.io/badge/Platform-PWA%20%7C%20Android%20(Capacitor)-indigo.svg)]()

---

## 1. Visión y Filosofía de Arquitectura

**VerboVivo** es un entorno teológico para pastores, maestros, líderes de células y estudiantes de las Escrituras. Su prioridad es la **soberanía del texto bíblico**: las citas se recuperan literalmente de una base SQLite local y nunca se inventan.

El sistema funciona en dos capas:

1. **Capa determinista (siempre disponible):** base de datos canónica, escudo lingüístico, recuperación híbrida, compositor homilético y catálogo doctrinal. No necesita red ni descargas.
2. **Capa generativa opcional:** el diálogo puede redactarse con un **GGUF en el propio dispositivo** (llama.cpp nativo en Android; wllama/WASM en PC y como respaldo), con **Ollama**, con **LM Studio** u otro endpoint compatible con OpenAI. El motor determinista sigue actuando como respaldo y como fuente de verdad para las citas.

El flujo de conversación es el mismo con cualquier cerebro. La diferencia está en quién redacta, no en cómo se interpreta la petición ni en cómo se verifican las citas.

---

## 2. Capacidades Reales

### 2.1 Diálogo teológico con estado (independiente del modelo)

- **Cinco modos de conversación:** `AUTO`, `CONSULTA`, `ESTUDIO`, `CONSEJERIA` y `DOCUMENTO`.
- **Máquina de estados por conversación:** fases `DISCOVER → CLARIFY → PROPOSE → CONFIRM → GENERATE → FOLLOW_UP`.
- **Extracción de ranuras (slots):** libro, pasaje, personaje, doctrina, formato ministerial, audiencia y propósito.
- **Política de una sola pregunta:** el sistema no interroga al usuario con un cuestionario; formula la pregunta más útil y espera.
- **Propuesta y aprobación antes de documentos largos:** para sermones, clases o campañas, primero acuerda el plan y luego redacta.
- **Persistencia por chat:** el estado del diálogo se guarda en `usuario_memoria.sqlite`, de modo que sobrevive a recargas y cambios de pantalla.
- **Cancelación real:** el botón *Detener* aborta la generación en curso y conserva lo que ya se mostró.

### 2.2 Capa de cerebros intercambiables

La interfaz `BrainAdapter` desacopla la conversación del proveedor:

| Proveedor | Uso | Requisitos |
| :--- | :--- | :--- |
| `deterministic` | Compositor teológico local, sin red | Ninguno |
| `on-device` | GGUF con llama.cpp nativo en Android (NPU Hexagon, Vulkan o CPU) o wllama/WASM en PC | Descargar el archivo desde la app |
| `ollama` | Inferencia generativa local o LAN | Ollama accesible desde el dispositivo |
| `openai-compatible` | LM Studio, vLLM u otro servidor compatible | Endpoint y nombre de modelo |

- Streaming real en los cuatro caminos, con cancelación y *timeout* enlazados.
- **Estados honestos:** la interfaz distingue *cargando cerebro*, *procesando contexto* (prefill) y *generando*; no muestra «Generando» mientras el dispositivo aún digiere el prompt.
- **Vigilante de inferencia:** si el runtime no emite el primer token o deja de emitir durante un silencio anómalo, la generación se corta con un error claro en lugar de quedar colgada. Los límites son mayores en Android porque el prefill real puede tardar minutos.
- Prueba de salud y latencia desde el gestor de modelos. En `on-device`, «Cargar y probar» ejecuta además una generación mínima real y reporta el tiempo y la muestra obtenida.
- Si el cerebro no responde, el sistema lo informa y etiqueta el respaldo determinista; no finge que el modelo está activo.
- **PC:** wllama usa varios hilos cuando el navegador está aislado (`COOP`/`COEP`), con un límite conservador de núcleos.
- **Android con APK nativo:** `libllama.so` + JNI ejecutan el GGUF fuera del WebView, en memoria nativa. El plugin reserva de 2 a 6 hilos reales según los núcleos (deja uno para la interfaz y la voz) y no depende de `SharedArrayBuffer`. El APK incluye `arm64-v8a` (teléfonos) y `x86_64` (emulador).
- **GPU Vulkan en Android:** si el dispositivo expone una GPU Vulkan con los requisitos de llama.cpp (16-bit storage), el plugin puede cargar las capas en GPU y lo informa con su nombre. Si Vulkan falta, es un rasterizador de software (emulador SwiftShader) o falla la carga, se usa CPU y la interfaz lo dice; nunca anuncia una aceleración que no ocurrió. La GPU acelera el cálculo, pero **no aumenta la RAM**. **En Adreno se omite Vulkan en modo automático**: se reprodujo en un RedMagic 9 Pro (Adreno 750) cómo el driver aborta en `vkCreateComputePipeline`; además, ese driver no compila el matmul cuantizado del prefill (se recorta el lote a 8), no compila los dmmv de K-quant y la ruta de subgrupos tumba el proceso. **Resultado verificado en ese teléfono:** un Qwen2.5-0.5B **Q4_0** con todas las capas en GPU genera texto coherente a ~11,9 tok/s frente a ~4,95 tok/s en CPU (unas 2,4×); el 1.5B Q4_0 produce texto corrupto con dos o más capas y los Q4_K_M del catálogo no pueden usar Vulkan en este driver. Si el backend falla durante el cálculo, el plugin libera la sesión, cuarentena el acelerador y el adaptador recarga en CPU y repite el bloque automáticamente.
- **NPU Hexagon en Android (experimental):** en Snapdragon con Hexagon v73–v85, el APK incluye el backend `ggml-hexagon` y sus skels DSP. El JNI identifica el SoC (`ro.soc.*`), registra el backend y solo lo intenta si la arquitectura encaja; después prueba **NPU → GPU (si es segura) → CPU** y reporta qué se usó y por qué se retrocedió. `available`/`usable` son independientes: una NPU presente que no abre no se presenta como activa. La NPU tampoco amplía la RAM. En el RedMagic 9 Pro se detectó que su firmware publica `ro.soc.manufacturer=QTI` y que el JNI lo rechazaba antes de cargar Hexagon v75; ahora acepta `QTI`/`QCOM`/`Qualcomm` cuando el SoC mapea a v73–v85. Tras esa corrección `libggml-hexagon.so` carga, pero la inicialización FastRPC falla: `libcdsprpc.so` existe en `/vendor/lib64` (ELF64 AArch64, con todos los símbolos que usa llama.cpp) y figura en `public.libraries.txt`, y aun así el enlazador responde `not accessible for the namespace` para la app. Es una restricción del firmware de ese teléfono, no del APK; la app lo informa como «NPU presente pero no utilizable» y sigue en CPU. **La NPU no está verificada en hardware y en este firmware no es accesible para apps.**
- **Reparto eficiente por perfil:** cada cerebro tiene un contrato de esfuerzo propio (presupuesto total, primer bloque, continuaciones automáticas, historial y versículos completos). No se gasta el mismo presupuesto en un 0.5B que en un 7B, y el 0.5B no encadena bloques: responde en una sola llamada breve y ofrece el botón **Ampliar** si hace falta más.

  | Perfil | Total del turno | Primer bloque | Continuaciones | Historial | Versículos completos |
  | :--- | ---: | ---: | ---: | ---: | ---: |
  | 0.5B (ULTRALIGHT / GPU) | 192 | 192 | 0 | 2 | 2 |
  | 1.5B (STANDARD) | 640 | 400 | 1 | 4 | 4 |
  | 3B (ADVANCED_4B) | 840 | 560 | 1 | 6 | 5 |
  | 7B (MAX_8B) | 1040 | 640 | 2 | 6 | 5 |

  El adaptador sigue deduplicando el solape entre bloques y añade una nota distinta según el perfil: el 0.5B invita a pulsar «Ampliar» o escribir «continúa»; los perfiles con continuación avisan de que ya se intentó automáticamente. La UI muestra «Ampliar» solo en la última respuesta cortada, y al pulsarlo se pide «continúa» y se fusiona en la misma burbuja.
- **El modelo dirige; los motores ejecutan:** cuando la petición es estudio, exégesis o explicación de un pasaje, doctrina o personaje, el orquestador responde con el **motor verificado** (pasaje, catálogo doctrinal y citas literales de SQLite) sin cargar el modelo. La respuesta se etiqueta «motor verificado» y se cachea por sesión (LRU de 24 entradas). El modelo local queda para diálogo abierto, consejería y ampliaciones libres; así se evitan llamadas largas que el 0.5B no puede sostener y se garantiza que las citas sean exactas. Si el modelo falla, el respaldo determinista usa la misma caché.
- **Prefijo estable y caché KV:** el prompt compacto coloca primero identidad y reglas fijas y deja al final el estado, la tarea y la Biblia verificada. El puente JNI conserva el KV del turno anterior, detecta el prefijo común con el prompt nuevo y decodifica solo la cola; los tokens generados también se reutilizan al continuar. La caché se descarta por sí sola si el prompt cambia por la cabecera, si el modelo no admite recorte parcial o al abrir una conversación nueva (`resetCache`), sin recargar el modelo. `generate` informa `cacheReusedTokens`.
- **Aceleración automática y a prueba de cierres:** antes de sondear o cargar con NPU/GPU se escribe un marcador síncrono. Si el proceso muere, el siguiente arranque consulta `ApplicationExitInfo`: cuando Android confirma un cierre nativo, ese acelerador se pone en cuarentena y se usa el siguiente; si fue un cierre normal del usuario, el marcador se descarta sin castigar al driver. El gestor explica el bloqueo y permite restablecerlo tras una actualización.
- **Android sin motor nativo o PC sin aislamiento:** wllama ejecuta el GGUF en un solo hilo. El adaptador híbrido lo detecta y lo informa; nunca finge que usa el motor nativo.
- **Catálogo honesto:** con motor nativo se ofrecen tamaños según la RAM real; sin él, en Android solo se ofrece 0.5B porque 1.5B/3B/7B no serían usables. El gestor muestra ABI, hilos y motivo de cada bloqueo.

### 2.3 Canon verificado e inyección de citas

- SQLite en WebAssembly (`sql.js`) con FTS y concordancias.
- Códigos Strong hebreos y griegos, y referencias cruzadas TSK.
- Marcadores `[CITA: Libro Cap:Vers]` reemplazados por el **texto literal** almacenado en la base.
- Si una referencia no existe en la versión activa, se muestra como no encontrada; no se rellena con texto inventado.
- La versión activa (por defecto RV1909) aparece siempre en la interfaz.

### 2.4 Pre-procesador lingüístico y seguridad pastoral

- Normalización de lenguaje cotidiano, modismos hispanohablantes y abreviaturas bíblicas.
- Clasificación de intención y audiencia sin llamadas de red.
- Detección de crisis con manejo de negaciones, modismos y contexto informativo, con derivación a ayuda profesional cuando corresponde.
- Límites explícitos de consejería: acompañamiento pastoral, no diagnóstico ni tratamiento clínico.

### 2.5 Composición homilética y exégesis

- Compositor determinista para los 66 libros, con tres niveles: **Semilla**, **Discípulo** y **Maestro**.
- Formatos ministeriales: sermón de culto, escuela dominical, célula de jóvenes, campaña de cuatro semanas y ceremonia especial.
- Exégesis específica por libro, capítulo o versículo, con raíces léxicas, estructura literaria, conexión cristocéntrica y aplicación pastoral.
- Guía pedagógica cuando se estudia un libro completo.
- Catálogo doctrinal determinista (21 doctrinas y 15 personajes) contrastado contra los versículos sembrados.

### 2.6 Catálogo de modelos de referencia y descarga honesta

El catálogo describe archivos GGUF reales de Qwen2.5:

| Perfil | Archivo | Tamaño aprox. | RAM sugerida |
| :--- | :--- | :--- | :--- |
| `ULTRALIGHT` | 0.5B Q4_K_M | 469 MB | 2 GB |
| `STANDARD` | 1.5B Q4_K_M | 1.04 GB | 4 GB |
| `ADVANCED_4B` | 3B Q4_K_M | 1.96 GB | 6 GB |
| `MAX_8B` | 7B Q4_K_M | 4.36 GB | 8 GB |
| `ULTRALIGHT_GPU` | 0.5B Q4_0 | 429 MB | 2 GB |

Los identificadores históricos se conservan por compatibilidad; el tamaño real aparece en la interfaz. `ULTRALIGHT_GPU` es el **modo rápido**: el único perfil que se carga con todas las capas en Vulkan en el Adreno 750 (verificado a ~11,9 tok/s frente a ~4,95 tok/s en CPU). Solo aparece en Android nativo con esa GPU o si el archivo ya está descargado. Su contexto es de 2048 tokens y su calidad es de gama de entrada, así que sirve para consultas breves y devocionales; para exégesis, sermones o informes largos se recomiendan 1.5B o 3B en CPU. Si Vulkan falla al cargar o durante el cálculo, el adaptador recarga el mismo perfil en CPU y continúa sin sacarte del chat.

**El catálogo no se muestra completo en todos los equipos.** El gestor construye un catálogo según el runtime real (`buildDeviceCatalog`) y solo deja elegir lo que puede ejecutarse:

| Contexto | Modelos ofrecidos | Motivo |
| :--- | :--- | :--- |
| Android con llama.cpp nativo | Según RAM real: 2 GB → 0.5B; 4 GB o más → 0.5B y 1.5B; 6 GB+ → también 3B; 12 GB+ → también 7B | El motor usa varios hilos y memoria fuera del WebView. La recomendación automática en cualquier teléfono es **1.5B**: 3B y 7B quedan como elección manual con advertencia (más lentos, más batería; el 7B ocupa 4,4 GB y no es un cerebro diario de teléfono). |
| Android nativo con Adreno 750 | Lo anterior **más** el modo rápido 0.5B Q4_0 en GPU | Es el único perfil que el driver Vulkan ejecuta correctamente; se etiqueta «GPU verificado» y advierte su contexto de 2048 y su calidad de gama de entrada. |
| Android sin motor nativo (APK antiguo o ABI no incluida) | Solo 0.5B | Sin `SharedArrayBuffer` ni JNI, wllama corre en un hilo: 1.5B tarda varios minutos y 3B/7B no son prácticos. |
| PC sin `COOP`/`COEP` | 0.5B y 1.5B | Wllama cae a un solo hilo; 3B/7B quedan impracticables. |
| PC aislado | Según RAM: 2 GB → 0.5B; 4 GB → 1.5B; 6 GB+ → 3B; 8 GB+ → también 7B | La app usa la RAM que reporta el navegador; si informa exactamente 8 GB, lo trata como un posible tope de medición y avisa antes de cargar 7B. |
| Tauri/nativo con RAM real | El mayor que quepa | La app nativa puede reportar más de 8 GB. |
| Espacio libre insuficiente | Se bloquea la descarga | Se necesitan al menos el tamaño del archivo; con menos del doble se advierte. |

Un archivo ya descargado que dejó de ser viable sigue visible con la etiqueta «No viable aquí» y su motivo, para que el usuario sepa qué ocupa espacio; no se puede activar ni volver a descargar desde ese equipo. En Android, si el cerebro activo es un 7B heredado, la cabecera avisa y ofrece cambiar al 0.5B.

Sobre la descarga:

- **Android nativo:** descarga con OkHttp directamente al almacenamiento privado de la app (`filesDir/models`, inaccesible para OPFS). Usa `Range` real, escribe un `.part`, permite pausar, reanudar y cancelar, emite progreso y renombra el archivo solo al completarlo.
- **PC/web y respaldo WASM:** peticiones `Range` por bloques de 50 MB, ensamblado por streaming en OPFS y comprobación del tamaño final.
- Ambos caminos sondean el tamaño real del archivo; si el servidor ignora `Range` o entrega menos bytes, fallan de forma visible en lugar de truncar el modelo.
- Verifican SHA-256 **solo cuando el catálogo publica un hash**; hoy el catálogo no publica hashes, así que la app lo dice en lugar de afirmar una verificación inexistente.
- **El archivo se ejecuta dentro de la app:** llama.cpp nativo en Android o `@wllama/wllama` (llama.cpp compilado a WebAssembly) en PC y como respaldo. Ollama sigue siendo la opción recomendada para respuestas rápidas y documentos largos.

### 2.7 Persistencia, memoria y estudio

- Bases `biblia_core.sqlite` y `usuario_memoria.sqlite` sincronizadas con almacenamiento privado (IndexedDB en web, sistema de archivos en Android).
- Perfil evolutivo comprimido para no inflar el contexto.
- Copias de seguridad JSON con firma SHA-256.
- Pizarra de estudio con exportación a texto, Markdown y PDF.
- Biblioteca de módulos bíblicos de dominio público e importación JSON/CSV.
- TTS offline con las voces en español realmente instaladas en el dispositivo, sin catálogos simulados, y segmentación prosódica.

---

## 3. Límites Técnicos (Lo que el sistema NO hace)

- **GPU Vulkan y NPU Hexagon en Android, con matices.** llama.cpp usa CPU y, cuando hay una GPU Vulkan compatible y segura, descarga en ella las capas del modelo. En Snapdragon con Hexagon v73–v85 existe un backend NPU (`ggml-hexagon`) **experimental que no se empaqueta en el APK por defecto**; se puede incluir para pruebas con `./gradlew assembleDebug -PverbovivoHexagon=true`. **En Adreno, Vulkan se omite en modo automático** porque su driver ha cerrado la app al compilar pipelines; el respaldo es CPU. Ese cierre se reprodujo en un RedMagic 9 Pro: la pila terminaba en `vk::Device::createComputePipeline: ErrorUnknown` dentro de `libggml-vulkan.so`. El disparador no era el objetivo elegido por Java, sino que el intento de CPU dejaba `model_params.devices` en `null` y llama.cpp añadía todas las GPU; el planificador ejecutaba Vulkan aunque `n_gpu_layers=0`. Ahora CPU recibe una lista vacía terminada en `null` y sin offload de operaciones. **En el Adreno 750 la única combinación verificada con aceleración real es 0.5B Q4_0** (~2,4× sobre CPU); los K-quant del catálogo no compilan en Vulkan y el 1.5B Q4_0 da resultados incorrectos. No hay NPU para Exynos, Tensor, MediaTek ni Snapdragon anteriores a v73: el plugin lo detecta por SoC y explica el motivo. El camino NPU es **experimental y en el RedMagic 9 Pro el firmware bloquea `libcdsprpc.so` para la app** (`not accessible for the namespace`), así que la carga continúa en CPU y la interfaz lo dice; no se empaqueta la biblioteca propietaria del vendedor para forzarlo. Un cierre nativo no se puede capturar: por eso hay marcador previo, cuarentena automática por `ApplicationExitInfo` y un botón para restablecerla. En PC, la GPU se aprovecha conectando Ollama/LM Studio. Las bibliotecas ARM64 se compilan con línea base `armv8-a` (sin exigir dotprod) para no provocar SIGILL en teléfonos antiguos; eso sacrifica algo de rendimiento frente a compilaciones específicas por chip.
- **Alineación de 16 KB resuelta.** Todas las `.so` del APK se enlazan con páginas de 16 KB (`-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384`), incluido el puente JNI; se verificó con `llvm-readelf` (segmentos `LOAD` con `align=0x4000`) y `zipalign -c -P 16`. Las imágenes DSP del backend Hexagon (`libggml-htp-v*.so`) solo se pueden enlazar a 4 KB porque las produce el SDK de Qualcomm y no se pueden reenlazar sin él; por eso ese backend experimental se excluye del APK por defecto. El APK distribuible usa CPU y Vulkan y cumple el requisito.
- **Rendimiento medido en emulador, no en teléfono físico.** En el emulador x86_64 (3 hilos, 0.5B Q4_K_M), un prompt de chat de 284 tokens tardó 13,1 s de prefill y generó a 14,4 tokens/s sin interfaz. Con el WebView renderizando en el emulador, el mismo flujo bajó a ~2,5 tokens/s. Son cifras de emulación por software: un teléfono ARM64 con 6 hilos debería ser más rápido, pero **no se ha verificado en hardware físico**.
- **En Android sin el APK nativo**, wllama sigue ejecutando el GGUF en un solo hilo: funciona, pero es lento. Para uso intensivo, instala el APK con llama.cpp nativo o conecta Ollama en la misma Wi-Fi.
- **La calidad depende del tamaño del modelo.** El 0.5B sirve para respuestas breves y como respaldo offline; el 1.5B y el 3B ya sostienen respuestas más largas en el dispositivo gracias a la continuación automática, pero para exégesis y documentos extensos sigue siendo más fiable el compositor determinista o Ollama en PC. Las citas de SQLite siguen siendo la fuente de verdad.
- **No usa APIs comerciales en la nube por defecto.** El usuario puede configurar un endpoint local; la aplicación no envía datos a servicios externos por su cuenta.
- **El motor determinista no es un LLM.** Compone documentos teológicos verificados a partir de plantillas, catálogo doctrinal y texto bíblico; no razona libremente como un modelo generativo.
- **No sustituye consejería profesional ni atención médica.**
- **No aloja traducciones con derechos de autor.** Solo distribuye textos de dominio público; las versiones adicionales las importa el usuario.
- **La persistencia es local.** Si se borran los datos del navegador o de la app sin respaldo, no hay recuperación desde un servidor central.
- **La calidad de las citas depende de la versión instalada.** Una referencia ausente se reporta como no encontrada.

---

## 4. Instalación Rápida

### Requisitos

- Node.js 20.19 o superior (recomendado 22 LTS o 24).
- Git.

```bash
git clone https://github.com/yemsy26/Aula-B-blica.git
cd Aula-B-blica
npm install
npm run dev
```

Abre `http://localhost:5173`.

### Activar el cerebro en el dispositivo

1. Abre **Gestor de modelos** (botón del cerebro en la cabecera).
2. En **En el dispositivo**, elige el GGUF recomendado para tu hardware.
3. Pulsa **Descargar archivo** y espera a que termine la barra de progreso.
4. Pulsa **Guardar y activar** y luego **Cargar y probar**. La prueba informa contexto, hilos y latencia real.

En PC el modelo se ejecuta con varios hilos si el servidor envía `COOP`/`COEP` (Vite ya los configura en desarrollo y previsualización). En Android con el APK nativo usa los hilos reales del dispositivo y memoria fuera del WebView; sin ese motor, wllama queda en un solo hilo y el gestor lo advierte antes de descargar.

### Conectar un modelo local por red (opcional, recomendado en móvil)

1. Abre **Gestor de modelos** en la interfaz.
2. Elige `Ollama` o `OpenAI-compatible`.
3. Configura endpoint y modelo. Ejemplos:
   - Ollama en PC: `http://localhost:11434`, modelo `qwen2.5:1.5b`.
   - Emulador Android → PC: `http://10.0.2.2:11434`.
   - Teléfono real → PC en la misma Wi-Fi: `http://IP-DE-TU-PC:11434`.
   - LM Studio: `http://localhost:1234/v1`, modelo `local-model`.
4. En Ollama, permite conexiones de la LAN con `OLLAMA_HOST=0.0.0.0` y `OLLAMA_ORIGINS=*`, y abre el puerto 11434 en el cortafuegos.
5. Pulsa **Probar conexión** y luego **Guardar y activar**.

Si no configuras nada, la aplicación sigue funcionando con el motor determinista; si descargas un GGUF, también funciona sin red.

---

## 5. Scripts

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm test` | Suite completa: **301 pruebas** con Vitest. |
| `npx tsc --noEmit` | Verificación de tipos sin emitir archivos. |
| `npm run build` | Verificación TypeScript y empaquetado de producción en `dist/`. |
| `npm run preview` | Previsualización del paquete de producción. |

---

## 6. Distribución

### PWA

Incluye Service Worker (`public/sw.js`) y manifiesto (`public/manifest.json`). La app instalada conserva la base canónica, los modelos descargados y los datos locales. El cerebro on-device funciona sin red; Ollama/LM Studio requieren el servidor que el usuario configure.

### Android con Capacitor

Requisitos: JDK 17, Android SDK 36 y NDK 27.0.12077973.

```bash
npm ci
npm run build
npx cap copy android
cd android
./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Las bibliotecas nativas de llama.cpp para `arm64-v8a` y `x86_64` (CPU, Vulkan y Hexagon) están precompiladas en `android/app/src/main/jniLibs`, así que cambiar el WebView no obliga a recompilar llama.cpp; solo se recompila el puente JNI.

Firma: copia `android/keystore.properties.example` a `android/keystore.properties` y ajusta las credenciales para firmar un release. Tanto el keystore como ese archivo están fuera de git. Sin ellos, `assembleDebug` usa la firma estándar de depuración.

---

## 7. Estructura del Repositorio

```
verbovivo/
├── android/                 # Proyecto nativo de Capacitor
│   ├── app/src/main/cpp/    # Puente JNI sobre llama.cpp
│   ├── app/src/main/java/   # Plugin Capacitor y actividad principal
│   ├── app/src/main/jniLibs # Bibliotecas precompiladas (CPU, Vulkan, Hexagon)
│   └── native/llama-headers # Cabeceras públicas del llama.cpp emparejado
├── docs/                    # Auditoría de diálogo e informe de inferencia móvil
├── public/                  # PWA, iconos, service worker, sql.js y wllama
├── src/
│   ├── core/
│   │   ├── database/        # SQLite WASM, canon, semillas, inyección de citas
│   │   ├── dialogue/        # Máquina de estados, slots, contrato de prompt, catálogo doctrinal
│   │   ├── importer/        # Catálogo de módulos y parseo BYOB
│   │   ├── inference/       # Registro de cerebros, adaptadores, compositor, descarga
│   │   │   └── brain/       # deterministic, on-device (nativo/WASM), ollama, openai-compatible, streaming
│   │   ├── memory/          # Perfil evolutivo y compresión
│   │   ├── native-bridge/   # Hardware y puente Capacitor / Web
│   │   ├── rag/             # Recuperación híbrida y contexto
│   │   ├── retention/       # Pan diario y respaldos
│   │   ├── shield/          # Normalización, rutas y detección de crisis
│   │   ├── tts/             # Voz offline y prosodia
│   │   └── utils/
│   ├── tests/               # 301 pruebas con Vitest
│   └── ui/                  # React 19 + Tailwind
├── .github/workflows/       # Integración continua (tipos, pruebas y build)
├── capacitor.config.ts
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 8. Licencia

MIT. Consulta [LICENSE](LICENSE) para la exención de garantías y las condiciones de uso.
