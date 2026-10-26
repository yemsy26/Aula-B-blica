# VerboVivo

> **Plataforma de Estudio Bíblico, Exégesis Histórica y Homilética 100% Offline**  
> *Preservación canónica determinista, cero dependencias de nube y privacidad absoluta.*

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Engine: Node.js >=18](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-emerald.svg)](https://nodejs.org/)
[![Database: SQLite WASM](https://img.shields.io/badge/Database-SQLite%20(WASM)-blue.svg)](https://sql.js.org/)
[![Tests: 129 Passing](https://img.shields.io/badge/Tests-129%2F129%20Passed-brightgreen.svg)]()
[![Platform: PWA / Web / Android](https://img.shields.io/badge/Platform-PWA%20%7C%20Android%20(Capacitor)-indigo.svg)]()

---

## 1. Visión y Filosofía de Arquitectura

**VerboVivo** es un entorno de software teológico y pastoral desarrollado bajo un principio de soberanía digital: **operatividad total sin conexión a Internet**. Diseñado tanto para pastores, maestros de seminario y líderes de células como para estudiantes de las Escrituras en regiones con conectividad limitada o nula, VerboVivo garantiza que el texto bíblico nunca sufra alucinaciones ni alteraciones doctrinarias.

A diferencia de las herramientas convencionales basadas en APIs externas o servicios en la nube, VerboVivo ejecuta su motor de base de datos relacional y su sintetizador exegético directamente en el cliente mediante **WebAssembly (SQLite / sql.js)** y almacenamiento local cifrado en navegador o dispositivo móvil.

---

## 2. Especificaciones y Alcance Técnico

### Capacidades Reales (Lo que el sistema HACE)

1. **Motor Relacional Local e Inmutabilidad Canónica (0% Alteración Textual):**
   - Base de datos relacional SQLite embebida en WebAssembly (`sql.js`) ejecutándose en la memoria del hilo de trabajo.
   - Indexación de texto completo (FTS) para búsqueda rápida por palabras clave, frases y concordancias.
   - Inyección determinista de citas canónicas literales (`[CITA: Libro Cap:Vers]`) que previene de raíz cualquier parafraseo o invención de versículos.

2. **Pre-procesador Lingüístico Determinista (< 1 ms):**
   - Normalización de lenguaje cotidiano, modismos regionales hispanohablantes (argentinismos, modismos caribeños, coloquialismos mexicanos/andinos) y abreviaturas bíblicas estándar.
   - Enrutador de intención ministerial y selector de audiencia sin requerir llamadas de red.
   - Detección pastoral preventiva de situaciones de crisis personal o angustia espiritual con sugerencia inmediata de pasajes de consuelo y líneas de ayuda.

3. **Motor Homilético Multiformato y Extenso (Multipágina):**
   - Generación estructurada de documentos de 800 a 1,800 palabras para los 66 libros del canon bíblico en 3 niveles de madurez teológica:
     - **Semilla (Básico · Devocional):** Explicación clara, tono pastoral cálido y aplicaciones cotidianas.
     - **Discípulo (Intermedio · Contextual):** Contexto histórico-cultural, análisis temático y referencias cruzadas.
     - **Maestro (Avanzado · Exegético):** Raíces léxicas en Hebreo y Griego Koiné, trasfondo histórico y teología sistemática.
   - Detección y elaboración en **7 Formatos Ministeriales**:
     1. `SERMON_CULTO` (Mensaje expositivo para púlpito).
     2. `ESCUELA_DOMINICAL` (Clase pedagógica interactiva con preguntas para estudiantes).
     3. `GRUPO_PEQUENO` (Dinámica de célula, rompehielos y aplicación comunitaria).
     4. `SERIE_4_SEMANAS` (Plan curricular mensual de 4 lecciones progresivas).
     5. `BIOGRAFIA_PERSONAJE` (Perfil biográfico, crisis, victorias y lecciones prácticas).
     6. `DOCTRINA_SISTEMATICA` (Fundamentos dogmáticos, errores comunes y refutaciones bíblicas).
     7. `BODA_FUNERAL` (Ceremonias ministeriales con protocolo pastoral solemne).

4. **Exégesis Específica por Libro, Capítulo y Versículo (Cero Respuestas Genéricas):**
   - Al solicitar el estudio de un pasaje puntual (ej. `Salmo 23:1`, `Romanos 8`, `Juan 3:16`), el sistema genera un informe exegético exhaustivo y directo, sin desviar a resúmenes globales:
     - **Marco Histórico y Contexto Canónico Inmediato:** Autor, fecha, propósito y ubicación precisa en la perícopa.
     - **Léxico Original con Códigos Strong:** Raíces hebreas y griegas con transcripción fonética, significado literal, definición teológica y aclaraciones hermenéuticas indispensables para blindar el texto contra malas interpretaciones o doctrinas inventadas.
     - **Estructura Literaria y Desarrollo del Pasaje:** Desglose analítico versículo a versículo o sección a sección.
     - **Teología Bíblica y Conexión Cristocéntrica:** Cómo el pasaje apunta a la revelación del Salvador y la redención del pacto.
     - **Aplicación Pastoral Contemporánea:** Principios vivenciales y preguntas reflexivas guiadas bajo la regla del ping-pong pastoral.
   - Guía de estudio integral por libro cuando se consulta un libro completo (ej. «quiero estudiar Salmos» o «guía de Romanos»), estructurada por secciones canónicas, temas teológicos y advertencias exegéticas.

5. **Catálogo de Cerebros IA Locales y Diagnóstico de Hardware (4 Niveles):**
   - Evaluación diagnóstica en tiempo real del hardware (`navigator.storage.estimate`, `navigator.hardwareConcurrency`, memoria estimada) para recomendar el modelo ideal y detectar el nivel máximo soportado:
     - `ULTRALIGHT (0.8B Q3_K_M · 400 MB)`: Gama Entrada (mínimo 2 GB RAM).
     - `STANDARD (1.5B Q4_K_M · 750 MB)`: Gama Media (mínimo 4 GB RAM).
     - `ADVANCED_4B (4B Q4_K_M · 2.1 GB)`: Gama Media-Alta (mínimo 6 GB RAM).
     - `MAX_8B (8B Q4_K_M · 4.2 GB)`: Gama Alta / Flagship (mínimo 8 GB RAM).
   - Descargador fraccionado en bloques de 50 MB con pausa/reanudación, guardado en almacenamiento local privado (IndexedDB / FS nativo) y verificación de integridad SHA-256.

6. **Motor de Casuística Universal y Espejos Bíblicos:**
   - Mapeo semántico de desafíos contemporáneos (deudas, desempleo, fatiga, duelo, liderazgo en crisis) hacia arquetipos históricos y principios de las Escrituras.

7. **Herramientas de Investigación y Estudio Integradas:**
   - **Concordancia Léxica Strong:** Búsqueda y análisis de términos originales en Hebreo, Arameo y Griego Koiné (ej. *bará* H1254, *agapē* G26, *lógos* G3056).
   - **Referencias Cruzadas (Treasury of Scripture Knowledge - TSK):** Mapeo temático entre pasajes del Antiguo y Nuevo Testamento.
   - **Pizarra de Estudio:** Bloc de notas persistente con exportación directa a texto enriquecido para WhatsApp, Markdown para publicación e impresión en formato PDF.

8. **Síntesis de Voz Offline (TTS) con Prosodia Adaptativa y Voces Naturales:**
   - Detección y priorización automática de voces Naturales Neural HD tanto en navegador como en Android (Edge Natural, Google Natural Speech, Piper Neural HD).
   - Módulo `ProsodyChunker` que segmenta lecturas y aplica modulaciones específicas para títulos, narrativas y citas solemnes con pausas reverentes.

9. **Biblioteca de Módulos Bíblicos en 1 Clic (BYOB):**
   - Descarga e indexación directa de versiones de Dominio Público y licencias abiertas (RV1909, Versión Biblia Libre CC BY-SA 4.0, BES, Biblia del Oso 1569).
   - Soporte para importación de traducciones en formatos estándar JSON y CSV.

10. **Memoria Local Evolutiva y Respaldo Firmado:**
    - Registro local del progreso teológico del usuario comprimido a menos de 300 palabras para optimizar el contexto.
    - Generación de respaldos completos en formato JSON con firma de integridad SHA-256 para migración entre dispositivos.

---

### Límites Técnicos y Operativos (Lo que el sistema NO hace)

- **No utiliza servidores remotos ni APIs comerciales en la nube:**  
  Toda la información del usuario, las bases de datos y los historiales se almacenan exclusivamente en el dispositivo local. Si se borra la caché o los datos del navegador sin haber exportado un respaldo, la información no podrá ser recuperada desde ningún servidor central.

- **Generador Determinista vs. Modelos Neuronales Extensos (LLMs):**  
  Por defecto, VerboVivo utiliza un sintetizador exegético determinista altamente optimizado que entrega respuestas completas e instantáneas en dispositivos con apenas 2 GB de memoria RAM. Para ejecutar modelos neuronales libres sin restricciones mediante archivos `.gguf` pesados (1.5B a 8B parámetros), se requiere conectar un entorno de ejecución local independiente (como Ollama, LM Studio o WebGPU en hardware con al menos 4 GB de RAM libre).

- **Límites de Propiedad Intelectual y Derechos de Autor:**  
  El código fuente de VerboVivo distribuye únicamente traducciones bíblicas de Dominio Público (Reina-Valera 1909). La plataforma no aloja ni distribuye textos comerciales con derechos de autor reservados. Cualquier versión contemporánea adicional debe ser importada de forma directa y personal por el usuario para su estudio privado sin fines comerciales.

---

## 3. Guía de Instalación Rápida (Windows, macOS y Linux)

### Requisitos Previos

- **Node.js:** Versión 18.0.0 o superior ([Descargar Node.js](https://nodejs.org/)).
- **Git:** Instalado y configurado en el sistema ([Descargar Git](https://git-scm.com/)).

### Pasos de Instalación

```bash
# 1. Clonar el repositorio oficial
git clone https://github.com/yemsy26/Aula-B-blica.git
cd Aula-B-blica

# 2. Instalar dependencias del proyecto
npm install

# 3. Iniciar el servidor local de desarrollo
npm run dev
```

Abre tu navegador en `http://localhost:5173` para comenzar a utilizar la aplicación inmediatamente.

---

## 4. Scripts Disponibles en `package.json`

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia el entorno de desarrollo local con recarga en caliente (Vite HMR). |
| `npm test` | Ejecuta la suite completa de 129 pruebas unitarias con Vitest. |
| `npm run build` | Compila TypeScript y empaqueta la aplicación web para producción en `dist/`. |
| `npm run preview` | Previsualiza localmente el paquete de producción generado. |

---

## 5. Distribución y Empaquetado

### Modo Progressive Web App (PWA 100% Offline)
VerboVivo incluye un Service Worker precacheado (`public/sw.js`) y un manifiesto web completo (`public/manifest.json`). Al visitar la aplicación desde cualquier navegador moderno en Android, iOS, Windows, macOS o Linux, aparecerá automáticamente la opción **"Instalar Aplicación"** en la barra de direcciones. Una vez instalada, funcionará de manera permanente sin requerir conexión a Internet.

### Compilación a Android APK Nativo (Capacitor)
Para generar un binario APK instalable en dispositivos móviles Android:

```bash
# 1. Generar la compilación estática de producción
npm run build

# 2. Agregar la plataforma nativa de Android (requiere Android SDK)
npx cap add android

# 3. Sincronizar assets estáticos
npx cap sync android

# 4. Abrir en Android Studio para compilar el APK
npx cap open android
```

---

## 6. Estructura del Repositorio

```
verbovivo/
├── public/                 # Manifiesto PWA, iconos vectoriales, service worker y binario sql-wasm
│   ├── favicon.svg
│   ├── icon-192.svg
│   ├── icon-512.svg
│   ├── manifest.json
│   ├── sql-wasm.js
│   ├── sql-wasm.wasm
│   └── sw.js
├── src/
│   ├── core/
│   │   ├── database/       # Adaptador SQLite WASM, catálogo canónico (66 libros) y semillas
│   │   ├── importer/       # Catálogo de módulos en 1 clic y parseador de formatos BYOB
│   │   ├── inference/      # Compositor homilético, motor determinista y puente GGUF
│   │   ├── memory/         # Compresor de perfil evolutivo y destilador asíncrono
│   │   ├── native-bridge/  # Detección de hardware y puente Capacitor / Web
│   │   ├── rag/            # Recuperador híbrido, reescritor de intención y contexto
│   │   ├── retention/      # Generador de Pan Diario y gestor de copias de seguridad
│   │   ├── shield/         # Escudo limpiador, normalizador dialectal y detector de crisis
│   │   ├── tts/            # Motor de síntesis de voz offline, prosodia y ranking neural
│   │   └── utils/          # Utilidades seguras de portapapeles y formato
│   ├── tests/              # 129 pruebas unitarias automatizadas con Vitest
│   └── ui/                 # Componentes React 19, vistas responsive y estilos Tailwind
├── capacitor.config.ts     # Configuración para Android / Capacitor
├── CONTRIBUTING.md         # Normas de contribución para la comunidad
├── LICENSE                 # Licencia MIT con anexo de blindaje canónico
├── package.json            # Metadatos del proyecto y dependencias
├── tsconfig.json           # Configuración del compilador TypeScript
└── vite.config.ts          # Configuración del empaquetador Vite
```

---

## 7. Licencia y Responsabilidad Legal

Este software se distribuye bajo los términos de la **Licencia MIT**. Consulta el archivo [LICENSE](LICENSE) para conocer todos los detalles sobre exención de garantías y responsabilidades canónicas de uso personal.
