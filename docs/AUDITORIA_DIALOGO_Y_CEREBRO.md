# Auditoría de VerboVivo: diálogo, cerebro y precisión teológica

**Fecha:** 2026-10-26  
**Alcance:** código fuente de `src/`, documentación (`README.md`), pruebas automatizadas y comportamiento en ejecución.  
**Versión analizada:** rama `main`, commit `7960f76`.

> **Estado (2026-10-27):** este documento conserva la auditoría del estado inicial. Las fases 0, 1 y 2 fueron implementadas y verificadas con `tsc --noEmit` limpio y la suite de pruebas aprobada. La fase 3 se implementó con **llama.cpp nativo (JNI/NDK) en Android** y wllama/WASM en PC y como respaldo; el APK usa **NPU Hexagon** en Snapdragon v73–v85, **Vulkan** cuando hay una GPU real y compatible, y retrocede a CPU con motivo explícito. La elección es automática y a prueba de cierres: un marcador persistido antes de cada intento y `ApplicationExitInfo` permiten poner en cuarentena un acelerador que haya cerrado el proceso; en Adreno, Vulkan se omite en modo automático. El camino NPU es experimental y aún no se ha verificado en un teléfono físico. No hay WebGPU. El catálogo de cerebros se filtra por runtime real (RAM, ABI e hilos nativos, aislamiento COOP/COEP en PC, espacio, GPU/NPU), de modo que no se ofrecen tamaños inutilizables. El detalle de lo hecho y lo pendiente está en la sección 11.

---

## 1. Veredicto ejecutivo

VerboVivo no tiene un problema de "cerebro": tiene un problema de **orquestación conversacional**. La aplicación confunde *seleccionar un modelo* con *saber conversar*. Hoy el modelo elegido en la interfaz no llega al motor de inferencia, el motor no recibe el estado del diálogo y el contenido se genera con plantillas deterministas que a veces parecen específicas sin serlo.

Lo que sí está bien construido: la base SQLite en WASM, el esquema canónico, el inyector de citas literales, el RAG híbrido, el escudo de normalización, la persistencia, la memoria evolutiva y el TTS. Esa infraestructura es una base real y aprovechable.

Los cuatro hallazgos que explican la sensación de que "no sabe hablar con el cerebro":

1. **El cerebro seleccionado es cosmético.** `activeModel` solo se guarda y se muestra; `generate()` nunca lo usa. Solo existen dos rutas efectivas: motor determinista o servidor local (Ollama/LM Studio). Los archivos GGUF descargados no se cargan nunca.
2. **No existe una capa de diálogo.** No hay estado de conversación, slots, preguntas de aclaración, resolución de seguimientos ni confirmación real. La "aprobación" se deduce mirando el último mensaje del asistente.
3. **El modelo real no recibe el historial.** El puente envía únicamente el prompt actual y el prompt de sistema; no envía turnos anteriores, estado ni resumen. Por eso no puede recordar ni precisar.
4. **El contenido determinista es plantilla.** Consultas fuera del catálogo caen en Juan 3:16; la exégesis de cualquier pasaje usa un léxico genérico y el Salmo 23 está hardcodeado; los siete formatos homiléticos comparten el mismo cuerpo con el nombre del libro insertado.

**Consecuencia:** el sistema puede dar una impresión de precisión exegética que no siempre corresponde con la evidencia utilizada. Para un sistema de teología, estudios y consejería, eso es más grave que una respuesta lenta.

**La solución no es "cambiar de modelo".** Es construir un *kernel de diálogo teológico* entre la interfaz y cualquier cerebro, con un contrato de prompt, estado persistente, recuperación canónica y validación de salida.

---

## 2. Cómo funciona hoy (flujo real)

```
Usuario
  │
  ▼
ChatView (selecciona formato y nivel)
  │
  ▼
App.handleSendMessage
  │
  ├─► processShield()          normaliza dialecto, clasifica ruta, detecta crisis
  │
  ├─► rewriteTheologicalIntent()   mapea lenguaje cotidiano a temas/libros/Strong
  │
  ├─► HybridRetriever.retrieve()   busca en SQLite (FTS + tema + TSK + Strong)
  │
  ├─► ContextBuilder.buildGroundTruth()   empaqueta 5 versículos en <SCRIPTURE_GROUND_TRUTH>
  │
  ├─► localInferenceEngine.generate()
  │      ├─ si backend = LOCAL_SERVER → realModelBridge.generateStream()
  │      │      └─ Ollama /api/generate o OpenAI /v1/chat/completions
  │      └─ si no → DynamicTheologicalComposer.compose()  (plantillas)
  │
  ├─► CitationInjector.injectCitationsInText()   reemplaza [CITA:] por texto de SQLite
  │
  └─► SQLite: guarda mensajes + compresión de memoria
```

### Archivos clave

| Responsabilidad | Archivo |
|---|---|
| Flujo principal | `src/ui/App.tsx` (`handleSendMessage`, líneas 290-417) |
| Interfaz de chat | `src/ui/components/ChatView.tsx` |
| Clasificación de intención | `src/core/shield/routerClassifier.ts` |
| Normalización y crisis | `src/core/shield/` |
| RAG | `src/core/rag/hybridRetriever.ts`, `queryRewriter.ts`, `contextBuilder.ts` |
| Motor determinista | `src/core/inference/localEngine.ts` |
| Puente a modelos reales | `src/core/inference/realModelBridge.ts` |
| Exégesis de pasajes | `src/core/inference/passageExegesisService.ts` |
| Formatos homiléticos | `src/core/inference/homileticGenerators.ts` |
| Diálogo/acuerdo | `src/core/inference/dialogueAgreementManager.ts` |
| Citas inmutables | `src/core/database/citationInjector.ts` |
| Catálogo de modelos | `src/core/inference/modelRegistry.ts`, `chunkedDownloader.ts` |
| Persistencia | `src/core/database/persistenceService.ts`, `usuarioMemoriaService.ts` |

---

## 3. Hallazgos detallados

### A. Cerebro e inferencia

| ID | Severidad | Hallazgo | Evidencia | Impacto |
|---|---|---|---|---|
| A1 | Crítica | El modelo activo no se usa para inferir | `localEngine.ts:471-489` solo define `activeModel`; `generate()` en `:495-573` no lo consulta | El usuario cree que cambió de cerebro y recibe siempre el determinista |
| A2 | Crítica | El GGUF descargado nunca se carga | `grep` no encuentra lectura del archivo final; `nativeBridge.runLocalInference()` usa el compositor determinista (`bridge.ts:156-205`) | La descarga no habilita inferencia real |
| A3 | Alta | El puente real no envía historial | `realModelBridge.ts:59-64` recibe solo `prompt`; Ollama `:80-95` y OpenAI `:131-145` envían únicamente el turno actual | El modelo no puede recordar ni resolver seguimientos |
| A4 | Alta | Timeout demasiado corto y sin cancelación real | `realModelBridge.ts:16` usa 4000 ms; `App.tsx:349-369` corre una segunda generación tras el timeout | En modelos locales lentos casi siempre gana el fallback; pueden mezclarse dos streams |
| A5 | Alta | El parser de streaming pierde tokens | `realModelBridge.ts:116-125` y `:157-179` parten cada chunk por `\n` sin buffer de líneas incompletas | Respuestas truncadas o palabras perdidas en NDJSON/SSE |
| A6 | Alta | Catálogo de modelos inconsistente | `modelRegistry.ts:18` usa el SHA-256 del string vacío; `:20` anuncia 0.8B pero apunta a 0.5B; `:54` anuncia 4B pero apunta a 3B; `:71` anuncia 8B pero apunta a 7B | Métricas, tamaños y hashes no son confiables |
| A7 | Crítica | La descarga es simulada | `chunkedDownloader.ts:96-106` escribe bloques de 100 KB con relleno; no ensambla el archivo; `verifyIntegrity()` en `:159-169` siempre devuelve `true` | La UI muestra "SHA-256 verificado" sin verificación real |
| A8 | Alta | El backend no se persiste | `ModelManagerModal.tsx:44,64-68` guarda el backend solo en estado React; al recargar vuelve a `DETERMINISTIC` | Configurar Ollama se pierde en cada recarga |
| A9 | Media | `pingLocalServer()` solo prueba `/api/tags` | `realModelBridge.ts:44` | LM Studio o llama-server pueden estar activos y la UI decir "sin respuesta" |
| A10 | Alta | Las pruebas no prueban inferencia real | `cerebroFullCapabilities.test.ts:98-113` solo comprueba get/set; `:119-147` valida la descarga simulada | 143 pruebas en verde no garantizan que el cerebro funcione |

### B. Diálogo y comprensión del usuario

| ID | Severidad | Hallazgo | Evidencia | Impacto |
|---|---|---|---|---|
| B1 | Crítica | No hay estado de conversación | `dialogueAgreementManager.ts:16-90` solo analiza el prompt y el último mensaje del asistente | No hay memoria de tema, pasaje, audiencia ni formato |
| B2 | Crítica | No hay slots ni preguntas de aclaración | `composeDialogueAgreementProposal` (`:124-192`) propone siempre tres movimientos fijos | No pregunta lo que falta; no se adapta al usuario |
| B3 | Crítica | No se resuelven seguimientos | Verificado: "y el versículo 2?" devuelve Juan 3:16 | Se pierde el hilo de la conversación |
| B4 | Alta | El formato seleccionado se aplica a todos los mensajes | `ChatView.tsx:234,273,516`; `localEngine.ts:53-86` genera documento completo si el formato no es `AUTO` | Tras elegir "Sermón", cualquier mensaje produce un sermón de 8.000 caracteres |
| B5 | Alta | La detección de aprobación es frágil | `dialogueAgreementManager.ts:41-58` usa regex de afirmaciones y busca frases en el último mensaje | Falsos positivos y pérdida de contexto |
| B6 | Alta | Consultas simples se clasifican como documentos | `routerClassifier.ts:159-170` convierte "vida de", "historia de", "quién fue" en `PERFIL_PERSONAJE`; verificado con "¿Quién fue el rey David?" | En lugar de responder, pide aprobar un formato |
| B7 | Alta | Preguntas doctrinales caen en respuesta genérica | Verificado: "¿Qué es la Trinidad?" → `[CHARLA_CONSEJERIA]` sin tema → Juan 3:16 | No responde la pregunta |
| B8 | Alta | No hay modos de uso | No existe distinción `consulta / estudio / consejería / documento` | Todo se trata como consejería o como documento |
| B9 | Media | La memoria no es memoria de diálogo | `memoryCompressor.ts:93-169` extrae palabras clave y preguntas; no guarda slots ni estado | El modelo real no recibe contexto útil |

### C. Precisión teológica y contenido

| ID | Severidad | Hallazgo | Evidencia | Impacto |
|---|---|---|---|---|
| C1 | Crítica | Fallback doctrinal fijo en Juan 3:16 | `localEngine.ts:99-105` y `:460-466` | Respuestas desconectadas de la consulta |
| C2 | Crítica | La exégesis de pasajes no siempre es específica | `passageExegesisService.ts:493-544` devuelve un léxico genérico para cualquier libro; `:561-621` hardcodea Salmo 23; `:696-701` usa párrafos genéricos | Se etiqueta como "exégesis" lo que es una plantilla |
| C3 | Crítica | Los siete formatos homiléticos comparten el mismo cuerpo | `homileticGenerators.ts:64-118`; el tema "El Poder Transformador de la Gracia Soberana" se repite para cualquier libro | Un sermón sobre Abdías y uno sobre Romanos pueden tener el mismo contenido |
| C4 | Alta | Las citas de los documentos no siempre se derivan del texto | `homileticGenerators.ts:14-58` usa referencias por defecto y del libro, no la perícopa trabajada | Aparente exégesis con evidencia débil |
| C5 | Alta | No se distingue texto, interpretación y aplicación | `systemPrompts.ts:66-86` no lo exige | Se mezcla revelación con opinión pastoral |
| C6 | Alta | No hay postura hermenéutica declarada | No existe tradición, confesión ni criterios de interpretación | Respuestas inconsistentes y difíciles de auditar |
| C7 | Media | El inyector de citas es sólido, pero solo cubre `[CITA:]` | `citationInjector.ts:172-215`; fallback hardcodeado en `:24-54` | Las afirmaciones doctrinales fuera de citas no se validan; el fallback puede no coincidir con la versión activa |
| C8 | Alta | El detector de crisis tiene falsos positivos | `crisisDetector.ts:70-87` busca substrings sin negación: "no quiero morir" contiene "quiero morir" | Alerta crítica incorrecta y posible revictimización |
| C9 | Alta | Falta alcance y derivación en consejería | `crisisDetector.ts:75-86` ofrece ayuda, pero no hay límites de competencia ni derivación profesional sistemática | Riesgo para un uso "consejero" |

### D. Interfaz y experiencia

| ID | Severidad | Hallazgo | Evidencia | Impacto |
|---|---|---|---|---|
| D1 | Media | El renderizador solo entiende `###` | `ChatView.tsx:150-157`; los generadores usan `#` y `##` (`homileticGenerators.ts:70-71`) | Títulos y tablas se muestran como markdown crudo |
| D2 | Media | No se muestra "qué entendí" | No hay panel de estado ni chips de aclaración | El usuario no sabe por qué el sistema responde lo que responde |
| D3 | Alta | La UI afirma que el cerebro está activo y descargado | `ModelManagerModal.tsx:323-331,438-442,468-479` | Confianza injustificada en una capacidad que no existe |
| D4 | Media | El texto normalizado sustituye al original | `App.tsx:336` pasa `shieldResult.normalizedText` | Se pierden matices, nombres y expresiones del usuario |
| D5 | Baja | No hay botón de cancelar generación | `App.tsx` no expone `AbortController` | En respuestas largas el usuario queda bloqueado |

### E. Documentación frente a realidad

| ID | Severidad | Hallazgo | Evidencia | Impacto |
|---|---|---|---|---|
| E1 | Alta | El README promete descarga real, SHA-256 y cerebros 0.8B/1.5B/4B/8B | `README.md:59-65,87-90`; el código simula la descarga y no carga el GGUF | Expectativa incumplida y riesgo reputacional |
| E2 | Media | El README dice 131 pruebas; hay 143 | `README.md:9,137,191`; ejecución real: 143 | Documentación desactualizada |
| E3 | Alta | "100% offline con modelos neuronales" no está implementado | `README.md:99-100` lo admite parcialmente, pero la sección de catálogo sugiere lo contrario | Confusión sobre la capacidad real |

---

## 4. Por qué no hay diálogo (causa raíz)

La cadena se rompe en cuatro puntos:

1. **La selección no llega al motor.** `activeModel` es una etiqueta. El motor decide entre determinista y servidor local, no entre los cuatro cerebros.
2. **El motor no recibe estado.** Solo recibe el texto del turno actual, una ruta y un nivel. No recibe "veníamos hablando de Salmo 23, para jóvenes, en 20 minutos".
3. **La intención se clasifica con palabras clave, no con contexto.** "Quién fue David" se convierte en solicitud de documento; "qué es la Trinidad" se convierte en consejería genérica.
4. **La generación sustituye a la conversación.** En cuanto se detecta un formato, se produce un documento; no se responde primero, no se aclara, no se confirma.

El resultado es un sistema que **monologa en plantillas** o **delega en un modelo al que le falta la mitad del contexto**.

---

## 5. Arquitectura propuesta: Kernel de Diálogo Teológico agnóstico al cerebro

La idea central es separar cuatro responsabilidades que hoy están mezcladas:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INTERFAZ                                                 │
│    modo, nivel, cerebro real, estado visible, cancelar      │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. KERNEL DE DIÁLOGO                                        │
│    estado + slots + fase + política de preguntas            │
│    decide: responder / aclarar / proponer / generar         │
└──────────────┬───────────────────────────────┬──────────────┘
               ▼                               ▼
┌──────────────────────────────┐  ┌───────────────────────────┐
│ 3. CONTRATO DE PROMPT        │  │ 4. RECUPERACIÓN CANÓNICA  │
│    identidad + tradición     │  │    pasaje + tema + TSK    │
│    estado + canon + formato  │  │    presupuesto por cerebro│
└──────────────┬───────────────┘  └───────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. BRAIN ADAPTER (cualquier cerebro)                        │
│    determinista | Ollama | OpenAI-compatible |             │
│    llama.cpp nativo (CPU/Vulkan/Hexagon) | wllama/WASM     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. VALIDADOR                                                │
│    citas, formato, seguridad, coherencia                    │
└─────────────────────────────────────────────────────────────┘
```

### 5.1. `BrainAdapter`: el contrato que hace posible "cualquier cerebro"

```ts
export interface BrainCapabilities {
  contextWindow: number;
  streaming: boolean;
  chat: boolean;
  jsonMode: boolean;
  languages: string[];
  local: boolean;
  maxOutputTokens?: number;
}

export interface BrainAdapter {
  id: string;
  label: string;
  capabilities: BrainCapabilities;

  health(): Promise<{ ok: boolean; latencyMs?: number; detail?: string }>;

  chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult>;
}

export interface BrainChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature: number;
  maxTokens: number;
  stop?: string[];
}
```

Adaptadores mínimos:

- `DeterministicAdapter`: envuelve el compositor actual, pero **se presenta como "modo plantilla"**, no como modelo neuronal.
- `OllamaAdapter`: usa `/api/chat` con `messages`, no `/api/generate` con un solo prompt.
- `OpenAICompatibleAdapter`: `/v1/chat/completions` con `messages`.
- `WebGpuAdapter` y `NativeLlamaAdapter`: interfaces preparadas; si no están implementados, la UI debe decir "no disponible".

Reglas del registro:

- Selección por preferencia del usuario y capacidades del dispositivo.
- Cadena de fallback explícita: `Ollama → OpenAI-compatible → Determinista`.
- La UI muestra el cerebro **realmente conectado**, no el deseado.
- Si el fallback se activa, se avisa: "Respondiendo en modo plantilla; el modelo local no está disponible".

### 5.2. `TheologicalDialogueManager`: el estado que hoy no existe

```ts
export type DialogueMode = 'consulta' | 'estudio' | 'consejeria' | 'documento';

export type DialoguePhase =
  | 'IDLE'
  | 'DISCOVER'
  | 'CLARIFY'
  | 'PROPOSE'
  | 'CONFIRM'
  | 'GENERATE'
  | 'FOLLOW_UP';

export interface DialogueState {
  mode: DialogueMode;
  phase: DialoguePhase;
  level: UserTheologicalLevel;
  tradition?: string;

  slots: {
    task?: 'responder' | 'estudiar' | 'predicar' | 'ensenar' | 'aconsejar' | 'doctrinar' | 'ceremonia';
    topic?: string;
    passage?: { book: string; chapter: number; verseStart?: number; verseEnd?: number };
    audience?: 'ninos' | 'jovenes' | 'adultos' | 'lideres' | 'congregacion' | 'personal';
    occasion?: string;
    format?: MinistryFormat;
    durationMinutes?: number;
    tone?: 'pastoral' | 'academico' | 'didactico' | 'solemne';
    goal?: string;
    constraints?: string[];
  };

  lastPassage?: { book: string; chapter: number; verseStart?: number; verseEnd?: number };
  pendingQuestion?: { slot: keyof DialogueState['slots']; options?: string[] };
  historySummary: string;
  safetyFlag?: 'CRISIS' | 'MEDIA' | 'NONE';
  updatedAt: string;
}
```

**Fases y decisión por turno:**

```
IDLE
  └─ llega mensaje → DISCOVER (extraer slots)
       ├─ ¿crisis? → protocolo de seguridad, no generar documento
       ├─ ¿consulta simple y completa? → responder directamente → FOLLOW_UP
       ├─ ¿falta un dato que cambia materialmente la respuesta? → CLARIFY (1 pregunta)
       ├─ ¿pide documento? → PROPOSE (brief + esquema) → CONFIRM → GENERATE
       └─ ¿seguimiento? → resolver contra lastPassage/estado → responder o continuar
```

**Política de aclaración (la clave para ser preciso):**

1. Máximo **una** pregunta por turno.
2. Preguntar solo si el dato cambia el resultado (pasaje, audiencia, formato, duración).
3. No preguntar lo que ya está en el estado.
4. Usar valores por defecto y decirlos: "Asumiré nivel Discípulo y 30 minutos; dime si lo cambio".
5. Si el usuario dice "solo dime" o "hazlo ya", responder/generar con los datos disponibles.
6. Confirmar solo documentos largos; nunca bloquear una consulta simple.
7. Si cambia el tema, conservar nivel y audiencia, resetear pasaje y formato.

**Resolución de seguimientos:**

- "y el versículo 2" → `lastPassage` + versículo 2.
- "hazlo para jóvenes" → parchear `audience`.
- "cámbialo a clase" → parchear `format` y volver a `PROPOSE`.
- "sobre eso" → `topic` o `lastPassage`.
- Si no se puede resolver, preguntar una sola vez.

### 5.3. Contrato de prompt para cualquier modelo

El prompt debe ser **estable, estructurado y portable**:

```text
[IDENTIDAD]
Eres VerboVivo, especialista en teología bíblica, exégesis y consejería pastoral.
No eres un asistente genérico. Tu autoridad es la Escritura; tu tono es pastoral.

[ALCANCE Y LÍMITES]
- No sustituyes atención médica, psicológica, legal ni financiera.
- En crisis, prioriza seguridad, derivación y acompañamiento.
- Distingue siempre: Texto / Interpretación / Aplicación.
- Si no tienes evidencia suficiente, dilo y pregunta.

[TRADICIÓN]
{tradition || 'Cristianismo evangélico, enfoque histórico-gramatical'}

[ESTADO DE DIÁLOGO]
Modo: {mode}
Fase: {phase}
Nivel: {level}
Slots: {json de slots}
Último pasaje: {lastPassage}
Resumen: {historySummary}

[CANON RECUPERADO]
<SCRIPTURE_GROUND_TRUTH>
...
</SCRIPTURE_GROUND_TRUTH>

[TAREA ACTUAL]
{nextAction}

[FORMATO DE SALIDA]
- Responde en español.
- Usa [CITA: Libro Cap:Vers] para cada referencia.
- No inventes versículos ni citas de memoria.
- Si generas documento, usa la estructura pedida.
- Termina con una sola pregunta de seguimiento, si aporta.
```

El contrato debe **adaptarse al tamaño de contexto del cerebro**: si el modelo soporta 2.048 tokens, se recorta el canon y el historial; si soporta 8.192, se incluye más evidencia. Nunca enviar un prompt que exceda la ventana.

### 5.4. Recuperación canónica orientada al diálogo

- Resolver primero el pasaje del estado; después el del mensaje.
- Para una consulta simple: 3-5 versículos relevantes.
- Para un documento: 2-3 pasajes por movimiento, no 5 en total.
- Almacenar un `EvidenceLedger` con los versículos realmente provistos.
- Validar cada `[CITA:]` contra ese ledger y contra SQLite.
- Léxico: usar solo entradas verificadas. Si no hay entrada para el pasaje, decirlo: "No tengo léxico específico para este versículo; ofrezco contexto general". Nunca presentar un léxico genérico como si fuera del texto.

### 5.5. Validador de salida

Antes de mostrar la respuesta:

1. **Citas:** toda `[CITA:]` resuelve; si no, se elimina o se marca.
2. **Formato:** secciones requeridas presentes.
3. **Etiquetas:** "exégesis" solo si hay léxico/contexto verificable; si no, "estudio" o "reflexión".
4. **Seguridad:** crisis, autolesión, abuso, consejo médico/legal.
5. **Coherencia:** no afirmar que se estudiaron pasajes que no se recuperaron.
6. **Longitud:** respetar el presupuesto del cerebro y del usuario.

Si falla, se repara con una segunda pasada o se devuelve una respuesta honesta y más corta.

### 5.6. Memoria de conversación

Separar tres niveles:

- **Estado del diálogo:** slots, fase, último pasaje, pregunta pendiente. Persistido por chat.
- **Resumen del chat:** < 300 palabras, actualizado cada N turnos.
- **Perfil global:** nivel, tradición, temas, preferencias. Ya existe, pero no debe sustituir al estado.

El modelo recibe: estado + últimos N turnos + resumen + canon. Eso es lo que permite que "cualquier cerebro" se comporte de forma consistente.

### 5.7. Interfaz

- Selector de **modo**: Consulta / Estudio / Consejería / Documento.
- Selector de **cerebro real** con salud, latencia y modelo; no solo una etiqueta.
- Panel "Entendí": tema, pasaje, audiencia, formato, duración.
- Chips de aclaración: "Jóvenes", "Adultos", "30 min", "Sin documento".
- Botón **Generar borrador** separado de **Responder**.
- Botón **Cancelar** durante streaming.
- Aviso claro cuando se usa el modo plantilla.
- Renderizado correcto de `#`, `##`, tablas y listas.
- El formato seleccionado debe ser **para el siguiente mensaje**, no un candado permanente.

---

## 6. Ejemplo de conversación objetivo

```text
Usuario: quiero predicar el domingo

VerboVivo: ¿Sobre qué pasaje o tema, y para qué audiencia?
           [Perdón] [Fe en crisis] [Jóvenes] [Congregación]

Usuario: sobre el perdón, para jóvenes

VerboVivo: Entendí: sermón expositivo sobre el perdón, audiencia juvenil,
           nivel Discípulo, 30-35 minutos.
           Propuesta:
           1. La culpa que paraliza (Salmo 32)
           2. La gracia que restaura (Lucas 15)
           3. El perdón que libera (Efesios 4:32)
           ¿Genero el sermón completo con este rumbo?
           [Generar] [Cambiar audiencia] [Solo dame el esquema]

Usuario: mejor 20 minutos y con una ilustración

VerboVivo: Ajustado a 20 minutos e ilustración central.
           [Generar sermón]
```

Hoy ese flujo no existe: el primer mensaje ya produce una propuesta de tres puntos fijos, y si el usuario elige un formato en la barra, cada mensaje posterior genera un documento completo.

---

## 7. Plan de implementación por fases

### Fase 0 — Verdad y plomería (prioridad máxima)

Objetivo: que la UI no mienta y que el cerebro elegido llegue al motor.

- [x] Crear `BrainAdapter` y `BrainRegistry`.
- [x] Implementar `OllamaAdapter` con `/api/chat` y `messages` (historial incluido).
- [x] Implementar `OpenAICompatibleAdapter` con `messages`.
- [x] Conectar el proveedor real y persistir la configuración (`localStorage` vía `BrainRegistry`).
- [x] Corregir streaming con buffer de líneas (NDJSON/SSE).
- [x] Timeout configurable; cancelación real con `AbortController`.
- [x] No ejecutar dos generaciones tras timeout; el fallback se etiqueta en la UI.
- [x] Sustituir la descarga simulada: `Range` real, ensamblado y SHA-256 solo si el catálogo lo publica.
- [x] Alinear URLs, tamaños, parámetros; no publicar hashes no verificados.
- [x] Mostrar en la UI el cerebro realmente conectado.
- [x] Actualizar README (pruebas, capacidades reales).

### Fase 1 — Kernel de diálogo (el corazón del pedido)

- [x] `DialogueState` + persistencia por chat (`dialogue_states`).
- [x] Extracción de slots por reglas.
- [x] Máquina de fases y política de una pregunta por turno.
- [x] Resolución de seguimientos y cambios de tema.
- [x] Modos `consulta / estudio / consejería / documento`.
- [x] Separar "responder" de "generar documento".
- [x] Confirmación para documentos largos.
- [ ] Panel "Entendí" y chips de aclaración (pendiente de UI).
- [x] Enviar historial + estado + resumen al cerebro.

### Fase 2 — Precisión teológica

- [x] `PromptContractBuilder` con tradición, alcance y formato de salida.
- [x] Validador de citas: solo se muestran las resueltas contra SQLite.
- [ ] Léxico verificado para todos los pasajes; hoy hay fichas específicas y un fallback que debe etiquetarse mejor.
- [ ] Documentos por perícopa: los formatos ya reciben pasaje y audiencia, pero el cuerpo aún comparte estructura base.
- [x] Separar Texto / Interpretación / Aplicación en el contrato de prompt.
- [x] Detector de crisis con negación, modismos y contexto informativo.
- [x] Límites de consejería y derivación profesional en el contrato.
- [ ] Evaluación con 50-100 casos teológicos y de diálogo (existen 256 pruebas unitarias, no una evaluación de calidad).

### Fase 3 — Cerebros locales reales

- [x] Descarga y ensamblado real de GGUF, con verificación de tamaño por bloque y del archivo final.
- [x] Carga del GGUF en PC y Android mediante wllama/WASM.
- [x] Carga con **llama.cpp nativo en Android** (JNI/NDK, `arm64-v8a` y `x86_64`), memoria fuera del WebView y 2–6 hilos.
- [x] Selección orientativa por hardware.
- [x] Pruebas de inferencia real en PC y Android.
- [x] Medición de latencia y uso de CPU/memoria en Android (0.5B nativo; cifras en la sección 11).

---

## 8. Criterios de aceptación

El sistema se considerará "conversacional y preciso" cuando cumpla esto:

1. "¿Qué es la Trinidad?" recibe una respuesta directa, con citas, sin proponer un sermón.
2. "¿Quién fue David?" recibe una respuesta directa; luego ofrece un estudio.
3. "Quiero predicar el domingo" hace como máximo dos preguntas de alto valor.
4. "Solo hazlo" genera con valores por defecto declarados.
5. "Y el versículo 2" resuelve el pasaje anterior, no Juan 3:16.
6. Cambiar de cerebro (determinista → Ollama → OpenAI-compatible) conserva el estado y el comportamiento.
7. El modelo real recibe los últimos turnos, el resumen y el canon.
8. Toda `[CITA:]` se resuelve contra SQLite o se marca como no encontrada.
9. El formato seleccionado afecta un turno, no todos.
10. Un timeout o cancelación no mezcla dos respuestas.
11. La crisis se detecta con contexto y se deriva; "no quiero morir" no se trata como ideación.
12. La UI no muestra "descargado/activo" si el motor no puede usarlo.
13. Los documentos largos se confirman antes de generarse.
14. Las pruebas cubren diálogo, no solo metadatos y plantillas.

---

## 9. Decisiones que conviene tomar antes de implementar

> Resueltas en la sección 11: on-device con llama.cpp nativo en Android y wllama/WASM en PC, Ollama/OpenAI-compatible, teología evangélica histórico-gramatical, consejería con derivación y offline con determinista etiquetado.

1. **Cerebros prioritarios:** ¿Ollama/LM Studio en PC, WebGPU en navegador, llama.cpp nativo en Android, o los tres?
2. **Postura teológica:** ¿evangélica general, reformada, pentecostal, no denominacional? El prompt y la consejería cambian.
3. **Alcance de consejería:** ¿acompañamiento pastoral con derivación, o también orientación psicológica? Recomiendo lo primero, con límites explícitos.
4. **Modo offline:** ¿el producto debe funcionar sin modelo neuronal, con el determinista bien etiquetado, o el modelo real es requisito?
5. **Descarga de modelos:** ¿se implementa de verdad o se retira de la UI hasta que exista el runtime?

---

## 10. Conclusión

La base de VerboVivo es valiosa: SQLite canónico, citas inmutables, RAG, niveles, escudo y persistencia. Lo que falta es la capa que convierte esa base en una conversación: **estado, intención, aclaración, contrato de prompt y validación**.

El cambio de mayor impacto no es añadir otro modelo, sino construir el **kernel de diálogo** y hacer que el modelo sea un adaptador intercambiible. Cuando eso exista, el sistema podrá hablar con cualquier cerebro y ser preciso con lo que el usuario quiere, en lugar de responder con la plantilla que mejor coincida con una palabra clave.

---

## 11. Estado de implementación (2026-10-27)

### Decisiones tomadas

- **Cerebros prioritarios:** GGUF en el dispositivo (llama.cpp nativo en Android, wllama en PC), Ollama y endpoints OpenAI-compatible (LM Studio, vLLM). El motor determinista queda como respaldo y como fuente de citas.
- **Postura teológica:** cristianismo evangélico, hermenéutica histórico-gramatical, lectura canónica centrada en Cristo. Declarada en el contrato de prompt.
- **Consejería:** acompañamiento pastoral con límites explícitos y derivación profesional; sin diagnóstico clínico.
- **Offline:** la aplicación funciona sin red con el motor determinista o con un GGUF ya descargado.
- **GGUF:** el archivo descargado se ejecuta realmente con llama.cpp nativo en Android o `@wllama/wllama` en PC; no se simula inferencia.

### Implementado

| Área | Archivos principales | Resultado |
| :--- | :--- | :--- |
| Adaptadores de cerebro | `src/core/inference/brain/` | Determinista, on-device híbrido (nativo/WASM), Ollama y OpenAI-compatible con streaming, salud y cancelación |
| Adaptador on-device | `onDeviceAdapter.ts`, `nativeLlamaAdapter.ts`, `wllamaAdapter.ts` | Elige llama.cpp nativo si el APK lo incluye; si no, wllama. Contexto por modelo, prompt compacto, topes de salida y errores explícitos |
| Motor nativo | `android/app/src/main/cpp/llama_jni.cpp`, `jniLibs/*`, `LlamaNativePlugin.java` | Carga, formato de chat, muestreo, prefill, streaming, cancelación y liberación en memoria nativa |
| Aceleración Android | `llama_jni.cpp`, `LlamaNativePlugin.java`, `native-bridge/`, `modelRegistry.ts` | Detección de SoC y Hexagon v73–v85, registro de `ggml-hexagon`, carga por objetivo explícito desde Java (NPU → Vulkan → CPU), cuarentena persistida tras un cierre nativo confirmado con `ApplicationExitInfo`, omisión de Vulkan en Adreno y etiqueta honesta en la UI |
| Descarga nativa | `LlamaNativePlugin.java`, `llamaNative.ts` | OkHttp a `filesDir/models`, `Range`, `.part`, pausa/reanudación/cancelación, progreso y borrado |
| Kernel de diálogo | `src/core/dialogue/` | Estado, slots, fases, una pregunta por turno, propuesta y aprobación |
| Contrato de prompt | `promptContract.ts` | Identidad, tradición, límites, citas, estado, historial y canon; variante compacta para modelos de bolsillo |
| Integración UI | `App.tsx`, `ChatView.tsx` | Modos, fase visible, cancelar, formato por turno, Markdown ampliado, sello de citas honesto y streaming agrupado cada 120 ms |
| Persistencia | `usuarioMemoriaService.ts` | Estado por chat y configuración del cerebro |
| Descarga honesta | `chunkedDownloader.ts` | `Range` real, verificación exacta de cada bloque, tamaño ensamblado, limpieza de parciales y SHA condicional |
| Catálogo | `modelRegistry.ts` | Archivos reales 0.5B/1.5B/3B/7B y `buildDeviceCatalog` según motor nativo, RAM, ABI y espacio |
| Gestor de modelos | `ModelManagerModal.tsx` | Configuración real, descarga, activación, prueba de carga, ABI/hilos y catálogo filtrado |
| Seguridad | `crisisDetector.ts` | Negación, modismos y contexto informativo |
| Documentación | `README.md`, este documento | Capacidades y límites alineados con el código |

### Verificación

- `npx tsc --noEmit`: sin errores.
- `npx vitest run`: **256 pruebas aprobadas** en 18 archivos.
- Cobertura específica: kernel de diálogo, adaptadores, orquestador, descarga honesta, contexto del modelo local, contrato compacto, estados de actividad, saneamiento de fugas del prompt, vigilante de inferencia bloqueada, catálogo por runtime, catálogo con motor nativo Android y etiquetas honestas de NPU/GPU/CPU, incluida la cuarentena y la omisión de Vulkan en Adreno.
- **Catálogo honesto:** en Android con motor nativo se ofrecen tamaños según RAM real (2 GB → 0.5B; 4 GB → 1.5B; 6 GB → 3B; 12 GB → 7B con advertencia); sin motor nativo solo se ofrece 0.5B; en PC sin COOP/COEP se ofrece hasta 1.5B; en PC aislado se ofrecen los tamaños que caben en la RAM reportada. Si falta espacio, la descarga se bloquea con el motivo. Un archivo ya descargado e inviable sigue visible con «No viable aquí».
- **Autoprueba del gestor:** en `on-device`, «Cargar y probar» no se limita a cargar el archivo: ejecuta una generación mínima y muestra latencia y muestra real, o falla de forma visible.
- **Estados de UI:** `loading` (cargando cerebro local), `prefill` (procesando contexto) y `generating` (primer token recibido) son distintos; el texto de prefill distingue llama.cpp nativo de wllama.
- **PC (navegador aislado):** wllama cargó el GGUF de prueba en 1,0 s con 8 hilos y generó una respuesta en 968 ms.
- **Android nativo (emulador x86_64):** `getInfo` reportó motor disponible, ABI `x86_64`, 3,9 GB reales y 3 hilos. El 0.5B se descargó (491.400.032 bytes), se pausó a 428.564.588 bytes y se reanudó con `Range` hasta completar. Cargó en ~0,3 s y generó «amén» en ~1,2 s (13,5 tokens/s).
- **Chat nativo por la app:** prompt de 426 tokens, 55 s de prefill y ~2,5 tokens/s con el WebView renderizando en el emulador. Sin render de interfaz, el mismo equipo midió 13,1 s de prefill para 284 tokens y 14,4 tokens/s. La cancelación devolvió `abort` en menos de un segundo.
- **NPU en emulador x86_64:** `getInfo` devolvió `npu.available=false` con el motivo «Este SoC (AOSP) no expone Hexagon»; el 0.5B se recargó en CPU en 0,2–0,4 s con `npuFallback=false`. Verifica la degradación honesta y que el plugin nuevo no rompe el camino existente, **no** la NPU real.
- **Ollama desde el emulador:** el atajo `10.0.2.2:11434` alcanzó el servidor del PC y la app informó con claridad que el modelo configurado no estaba en `/api/tags`, en lugar de fingir conexión.

### Pendiente y riesgos conocidos

1. **Rendimiento móvil.** El motor nativo ya usa varios hilos (2–6) y memoria fuera del WebView, pero solo se midió en emulador x86_64; falta medir en un teléfono ARM64 físico (temperatura, batería y estabilidad). Sin motor nativo, wllama sigue limitado a un hilo.
2. **Calidad del 0.5B.** Es un modelo de bolsillo: puede responder de forma imprecisa. Las citas verificadas y el compositor determinista siguen siendo la fuente de verdad; para exégesis conviene 1.5B/3B en PC u Ollama.
3. **GPU y NPU: implementadas, sin verificación física.** llama.cpp usa CPU, Vulkan y Hexagon en Android. La GPU se activa solo si es real; la NPU solo en Snapdragon v73–v85 con una versión determinada por SoC, y ambas retroceden a CPU con motivo. En modo automático Vulkan se omite cuando el dispositivo es Adreno, porque su driver ha cerrado la app al compilar pipelines; si aun así un acelerador cierra el proceso, el plugin lo detecta con `ApplicationExitInfo`, lo pone en cuarentena y la UI lo explica. Falta probar en un teléfono ARM64 físico: el emulador x86_64 no tiene Hexagon y nunca se abrió una sesión DSP real. La NPU no aumenta la RAM; los mínimos del catálogo no cambian. `GGML_CPU_ALL_VARIANTS` sigue pendiente. La compilación ARM64 usa línea base `armv8-a` para evitar SIGILL en equipos antiguos, a costa de rendimiento frente a dotprod/i8mm.
4. **Descarga nativa duplicada.** En Android, el modelo se guarda en `filesDir/models`; si ya existía una copia OPFS de wllama, no se migra automáticamente y puede ocupar espacio duplicado.
5. **Sin panel "Entendí".** El estado se usa internamente y se muestra la fase, pero no hay chips editables de tema, pasaje y audiencia.
6. **Exégesis con fichas específicas, no cobertura total.** Los pasajes más estudiados tienen léxico propio; el resto usa contexto general.
7. **Formatos homiléticos comparten estructura base.** Se personalizan con pasaje, audiencia y tema, pero no son todavía composiciones independientes por perícopa.
8. **Sin evaluación cualitativa.** Las 256 pruebas verifican contratos y flujos; no miden calidad pastoral ni exegética frente a un corpus de casos.

---

### Anexo: verificaciones realizadas en la auditoría inicial

> Estas cifras corresponden al commit `7960f76`, antes de la implementación.

- `npm test`: 143 pruebas pasan (10 archivos).
- `npx tsc --noEmit`: sin errores.
- Prueba manual de comportamiento:
  - "¿Qué es la Trinidad?" → `[CHARLA_CONSEJERIA]`, respuesta genérica con Juan 3:16.
  - "¿Quién fue el rey David?" → `[CREADOR_ESTUDIO]`, propuesta de acuerdo en lugar de respuesta.
  - "y el versículo 2?" → `[BUSQUEDA_EXACTA]`, Juan 3:16.
  - Formato `SERMON_CULTO` con "hola, ¿cómo estás?" → sermón completo de 8.259 caracteres.
- Revisión de código y documentación citada en cada hallazgo.
