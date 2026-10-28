# Guía de Contribución a VerboVivo

¡Gracias por tu interés en contribuir a **VerboVivo**! Este proyecto es 100% de código abierto, gratuito y sin fines de lucro, diseñado para proveer investigación teológica, exégesis histórica y herramientas homiléticas deterministas y privadas para toda la comunidad hispanohablante.

---

## 1. Principios de Arquitectura y Compromisos

1. **Privacidad y soberanía local (offline-first):**
   - Todo dato del usuario (consultas, historial, estudios, notas de voz, perfiles de memoria) debe permanecer exclusivamente en el dispositivo del usuario.
   - Queda estrictamente prohibido introducir llamadas o telemetrías a servicios de terceros, APIs en la nube o analíticas comerciales sin consentimiento explícito y local.
   - La conexión a un servidor de modelos local (Ollama, LM Studio u otro compatible con OpenAI) es una acción explícita del usuario. El motor determinista debe seguir funcionando sin red.

2. **Inmutabilidad Canónica (0% Alteración de Texto Bíblico):**
   - Ningún modelo generativo o función de transformación puede modificar, parafrasear o alucinar versículos bíblicos canónicos.
   - Las citas textuales se inyectan determinísticamente desde la base de datos local SQLite (`sql.js` WASM) usando el protocolo `[CITA: Libro Cap:Vers]`.

3. **Blindaje de Dominio Público y Licencias:**
   - La distribución base incluye exclusivamente textos de Dominio Público (como RV1909) o licencias Creative Commons permisivas.
   - La importación de traducciones externas debe ser responsabilidad directa del usuario final bajo estudio personal (BYOB).

---

## 2. Configuración del Entorno de Desarrollo

### Requisitos Previos
- **Node.js:** Versión 20.19 o superior (recomendado 22 LTS o 24).
- **npm:** Versión 10 o superior (`npm -v`).
- **Git:** Instalado en el sistema operativo.
- **Android (opcional):** JDK 17, Android SDK 36 y NDK 27.0.12077973 para compilar el APK nativo.

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/yemsy26/Aula-B-blica.git
cd Aula-B-blica

# 2. Instalar dependencias limpias
npm install

# 3. Iniciar servidor de desarrollo local
npm run dev

# 4. Ejecutar la suite completa de pruebas unitarias
npm test
```

### Compilación del APK Android

```bash
npm run build
npx cap copy android
cd android
./gradlew assembleDebug
```

El APK se genera en `android/app/build/outputs/apk/debug/app-debug.apk`. Para firmar un release, copia `android/keystore.properties.example` a `android/keystore.properties` y coloca tu keystore fuera del control de versiones; sin ese archivo se usa la firma de depuración estándar.

---

## 3. Flujo de Trabajo para Pull Requests (PR)

1. **Crea una rama descriptiva:**
   ```bash
   git checkout -b feature/nueva-funcionalidad
   # o
   git checkout -b fix/correccion-exegesis
   ```

2. **Asegura la calidad del código:**
   - Escribe pruebas unitarias con Vitest en `src/tests/` para cualquier nueva funcionalidad o corrección de error.
   - Ejecuta la suite de verificación antes de confirmar tus cambios:
     ```bash
     npm test
     npm run build
     ```
   - Ambos comandos deben terminar con código de salida 0.

3. **Formato de Mensajes de Commit (Conventional Commits):**
   - `feat: agregar nuevo formato homilético para seminarios`
   - `fix: corregir cálculo de rangos en inyector de citas`
   - `docs: actualizar instrucciones de compilación local`
   - `perf: optimizar tiempo de inicio de SQLite WASM`

---

## 4. Licencia de Contribuciones

Al enviar una solicitud de extracción (Pull Request) a este repositorio, aceptas que tus contribuciones se licencien bajo los términos de la [Licencia MIT](LICENSE) del proyecto.
