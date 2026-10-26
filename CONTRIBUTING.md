# Guía de Contribución a VerboVivo

¡Gracias por tu interés en contribuir a **VerboVivo**! Este proyecto es 100% de código abierto, gratuito y sin fines de lucro, diseñado para proveer investigación teológica, exégesis histórica y herramientas homiléticas deterministas y privadas para toda la comunidad hispanohablante.

---

## 1. Principios de Arquitectura y Compromisos

1. **Privacidad y Soberanía Local (100% Offline):**
   - Todo dato del usuario (consultas, historial, estudios, notas de voz, perfiles de memoria) debe permanecer exclusivamente en el dispositivo del usuario.
   - Queda estrictamente prohibido introducir llamadas o telemetrías a servicios de terceros, APIs en la nube o analíticas comerciales sin consentimiento explícito y local.

2. **Inmutabilidad Canónica (0% Alteración de Texto Bíblico):**
   - Ningún modelo generativo o función de transformación puede modificar, parafrasear o alucinar versículos bíblicos canónicos.
   - Las citas textuales se inyectan determinísticamente desde la base de datos local SQLite (`sql.js` WASM) usando el protocolo `[CITA: Libro Cap:Vers]`.

3. **Blindaje de Dominio Público y Licencias:**
   - La distribución base incluye exclusivamente textos de Dominio Público (como RV1909) o licencias Creative Commons permisivas.
   - La importación de traducciones externas debe ser responsabilidad directa del usuario final bajo estudio personal (BYOB).

---

## 2. Configuración del Entorno de Desarrollo

### Requisitos Previos
- **Node.js:** Versión 18.0.0 o superior (`node -v`).
- **npm:** Versión 9.0.0 o superior (`npm -v`).
- **Git:** Instalado en el sistema operativo.

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
