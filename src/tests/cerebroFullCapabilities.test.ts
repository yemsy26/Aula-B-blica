import { describe, it, expect } from 'vitest';
import { selectAdaptiveModel, AVAILABLE_MODELS } from '../core/inference/modelRegistry.js';
import { ChunkedDownloader } from '../core/inference/chunkedDownloader.js';
import { LocalDeterministicEngine } from '../core/inference/localEngine.js';
import { processShield } from '../core/shield/index.js';
import { rewriteTheologicalIntent } from '../core/rag/queryRewriter.js';
import { UserEvolutionProfile } from '../core/database/usuarioMemoriaService.js';
import { findBiblicalMirror } from '../core/rag/casuistryMapper.js';
import { findCanonicalBook } from '../core/database/canonicalBooks.js';

describe('Batería Integral de Pruebas del Cerebro y Modelos Edge (VerboVivo)', () => {
  const engine = new LocalDeterministicEngine();

  // =========================================================================
  // 1. OPCIONES DE CEREBRO DISPONIBLES Y SELECTOR ADAPTATIVO DE HARDWARE
  // =========================================================================
  describe('1. Modelos Disponibles y Selector Adaptativo de Hardware', () => {
    it('debe registrar el cerebro ULTRALIGHT (0.8B Q3_K_M) con métricas óptimas para gama baja', () => {
      const model = AVAILABLE_MODELS.ULTRALIGHT;
      expect(model.id).toBe('ULTRALIGHT');
      expect(model.tamanoParametros).toBe('0.8B');
      expect(model.cuantizacion).toBe('Q3_K_M');
      expect(model.tamanoMb).toBeLessThanOrEqual(450);
      expect(model.ramMinimaRequeridaMb).toBeLessThanOrEqual(2048);
      expect(model.totalChunks).toBe(8);
      expect(model.tamanoChunkMb).toBe(50);
      expect(model.sha256).toBeDefined();
    });

    it('debe registrar el cerebro STANDARD (1.5B Q4_K_M) con alta fidelidad exegética para gama media/alta', () => {
      const model = AVAILABLE_MODELS.STANDARD;
      expect(model.id).toBe('STANDARD');
      expect(model.tamanoParametros).toBe('1.5B');
      expect(model.cuantizacion).toBe('Q4_K_M');
      expect(model.contextoMaxTokens).toBeGreaterThanOrEqual(2048);
      expect(model.ramMinimaRequeridaMb).toBe(4096);
      expect(model.totalChunks).toBe(15);
      expect(model.sha256).toBeDefined();
    });

    it('debe asignar automáticamente el cerebro según la memoria RAM del dispositivo', () => {
      const lowEnd = selectAdaptiveModel({ platform: 'android', estimatedRamMb: 2048, isLowEndDevice: true });
      expect(lowEnd.id).toBe('ULTRALIGHT');

      const highEnd = selectAdaptiveModel({ platform: 'android', estimatedRamMb: 6144, isLowEndDevice: false });
      expect(highEnd.id).toBe('STANDARD');
    });

    it('debe permitir cambiar de modelo activo en el motor de inferencia', () => {
      engine.setActiveModelId('MOCK');
      expect(engine.getActiveModelId()).toBe('MOCK');

      engine.setActiveModelId('ULTRALIGHT');
      expect(engine.getActiveModelId()).toBe('ULTRALIGHT');

      engine.setActiveModelId('STANDARD');
      expect(engine.getActiveModelId()).toBe('STANDARD');
    });
  });

  // =========================================================================
  // 2. DESCARGA FRACCIONADA DE CEREBROS POR BLOQUES (50 MB)
  // =========================================================================
  describe('2. Descarga Fraccionada y Verificación de Integridad de Cerebros', () => {
    it('debe completar la descarga por bloques con progreso, pausa, reanudación y verificación SHA256', async () => {
      const progressLogs: number[] = [];
      const manifest = AVAILABLE_MODELS.ULTRALIGHT;

      const downloader = new ChunkedDownloader(manifest, (p) => {
        progressLogs.push(p.porcentaje);
      });

      expect(downloader.getStatus()).toBe('IDLE');

      // Iniciar descarga
      const startPromise = downloader.start();
      // Pausar
      setTimeout(() => downloader.pause(), 10);
      await startPromise;

      expect(['PAUSED', 'COMPLETED']).toContain(downloader.getStatus());

      // Reanudar si se pausó
      if (downloader.getStatus() === 'PAUSED') {
        const resumePromise = downloader.start();
        await resumePromise;
      }

      expect(downloader.getStatus()).toBe('COMPLETED');
      expect(progressLogs[progressLogs.length - 1]).toBe(100);
      expect(downloader.getProgress().chunksDescargados).toBe(manifest.totalChunks);
    });
  });

  // =========================================================================
  // 3. RESPUESTAS ESPECÍFICAS (NO GENÉRICAS) ANTE SITUACIONES HUMANAS REALES
  // =========================================================================
  describe('3. Espejos Bíblicos: Respuestas Específicas a Problemas Reales vs. Respuestas Genéricas', () => {
    const genericPhrases = [
      'como modelo de lenguaje',
      'como ia',
      'como una inteligencia artificial',
      'no tengo sentimientos',
      'en conclusión general',
      'es importante recordar que cada persona',
    ];

    it('debe responder específicamente con Eliseo y la viuda ante problemas de deudas y economía', async () => {
      const prompt = 'No me alcanza el dinero para pagar las deudas este mes, siento que me ahogo';
      const shield = processShield(prompt);
      expect(shield.detectedRoute).toBe('[CHARLA_CONSEJERIA]');

      const response = await engine.generate(
        shield.normalizedText,
        shield.detectedRoute,
        'Semilla'
      );

      // Verificación de especificidad bíblica
      expect(response).toContain('Eliseo');
      expect(response).toContain('aceite');
      expect(response).toContain('2 Reyes 4');
      expect(response).toContain('[CITA:');

      // Debe incluir pasos prácticos y pregunta ping-pong
      expect(response).toContain('Pasos Prácticos para tu Día a Día:');
      expect(response).toMatch(/\?$/m); // Termina con pregunta de seguimiento

      // Cero lenguaje genérico de IA
      for (const phrase of genericPhrases) {
        expect(response.toLowerCase()).not.toContain(phrase);
      }
    });

    it('debe responder específicamente con Elías en el desierto ante depresión y agotamiento profundo', async () => {
      const prompt = 'Estoy con un agotamiento extremo, ya no puedo más con esta carga y desánimo';
      const shield = processShield(prompt);

      const response = await engine.generate(
        shield.normalizedText,
        shield.detectedRoute,
        'Semilla'
      );

      expect(response).toContain('Elías');
      expect(response).toContain('1 Reyes 19');
      expect(response).toContain('enebro');
      expect(response).toContain('[CITA:');
      expect(response).toContain('Pasos Prácticos');

      for (const phrase of genericPhrases) {
        expect(response.toLowerCase()).not.toContain(phrase);
      }
    });

    it('debe responder específicamente con Jesús en Galilea y los lirios ante la ansiedad por el futuro', async () => {
      const prompt = 'Tengo una ansiedad que no me deja dormir pensando en lo que va a pasar con mi futuro';
      const shield = processShield(prompt);

      const response = await engine.generate(
        shield.normalizedText,
        shield.detectedRoute,
        'Semilla'
      );

      expect(response).toContain('Jesús');
      expect(response).toContain('Galilea');
      expect(response).toContain('Mateo 6');
      expect(response).toContain('[CITA:');
      expect(response).toContain('Pasos Prácticos');

      for (const phrase of genericPhrases) {
        expect(response.toLowerCase()).not.toContain(phrase);
      }
    });

    it('debe responder específicamente con la restauración de Pedro ante la culpa y el fracaso moral', async () => {
      const prompt = 'Siento una culpa inmensa por haber fallado, creo que arruiné mi relación con Dios';
      const shield = processShield(prompt);

      const response = await engine.generate(
        shield.normalizedText,
        shield.detectedRoute,
        'Semilla'
      );

      expect(response).toContain('Pedro');
      expect(response).toContain('Juan 21');
      expect(response).toContain('[CITA:');
      expect(response).toContain('Pasos Prácticos');

      for (const phrase of genericPhrases) {
        expect(response.toLowerCase()).not.toContain(phrase);
      }
    });

    it('debe responder específicamente con José en Egipto ante el dolor de una traición familiar', async () => {
      const prompt = 'Me dolió muchísimo la traición de un familiar cercano, no sé cómo sanar esta herida';
      const shield = processShield(prompt);

      const response = await engine.generate(
        shield.normalizedText,
        shield.detectedRoute,
        'Semilla'
      );

      expect(response).toContain('José');
      expect(response).toContain('Génesis 50');
      expect(response).toContain('[CITA:');

      for (const phrase of genericPhrases) {
        expect(response.toLowerCase()).not.toContain(phrase);
      }
    });
  });

  // =========================================================================
  // 4. RESPUESTAS POR NIVEL TEOLÓGICO: SEMILLA, DISCÍPULO Y MAESTRO
  // =========================================================================
  describe('4. Adaptación Dinámica por Nivel Teológico en Estudio de Libros Canónicos', () => {
    it('debe generar contenido pastoral y devocional para Génesis en Nivel Semilla', async () => {
      const response = await engine.generate('estudiar génesis', '[CREADOR_ESTUDIO]', 'Semilla');

      expect(response).toContain('Guía y Estudio Devocional: Génesis');
      expect(response).toContain('Propósito para tu vida:');
      expect(response).toContain('Pasos Prácticos de Fe:');
      expect(response).toContain('Paso 1 (Lectura pausada)');
      expect(response).toContain('[CITA: Génesis');
    });

    it('debe generar bosquejo ministerial con preguntas de discipulado para Génesis en Nivel Discípulo', async () => {
      const response = await engine.generate('estudiar génesis', '[CREADOR_ESTUDIO]', 'Discipulo');

      expect(response).toContain('Bosquejo Homilético y Teológico: Génesis');
      expect(response).toContain('Moisés');
      expect(response).toContain('Preguntas para Discipulado y Grupo Pequeño:');
      expect(response).toContain('[CITA: Génesis');
    });

    it('debe generar análisis exegético profundo con términos hebreos/griegos para Génesis en Nivel Maestro', async () => {
      const response = await engine.generate('estudiar génesis', '[CREADOR_ESTUDIO]', 'Maestro');

      expect(response).toContain('Análisis Exegético y Teología Bíblica: Génesis');
      expect(response).toContain('Estructura Literaria y Morfosintaxis');
      expect(response).toContain('Articulación Intertextual y Tipológica (TSK)');
      expect(response).toContain('Teología Sistemática y Proclamación Expositiva');
      expect(response).toContain('[CITA: Génesis');
    });
  });

  // =========================================================================
  // 5. BÚSQUEDA EXACTA Y RAÍCES ORIGINALES (HEBREO/GRIEGO)
  // =========================================================================
  describe('5. Búsqueda Exacta y Raíces Originales en Lenguas Bíblicas', () => {
    it('debe explicar con precisión la raíz hebrea bará (H1254) y su exclusividad divina', async () => {
      const response = await engine.generate('que significa bara en la creacion', '[BUSQUEDA_EXACTA]', 'Maestro');

      expect(response).toContain('[CITA: Génesis 1:1]');
      expect(response).toContain('H1254: bará');
      expect(response).toContain('ex nihilo');
      expect(response).toContain('Juan 1:1');
    });

    it('debe entregar la referencia canónica inmutable del Salmo 23 con su aplicación de reposo', async () => {
      const response = await engine.generate('el señor es mi pastor salmo 23', '[BUSQUEDA_EXACTA]', 'Semilla');

      expect(response).toContain('[CITA: Salmos 23:1-3]');
      expect(response).toContain('Pastor fiel');
    });
  });

  // =========================================================================
  // 6. LOS 7 FORMATOS HOMILÉTICOS EXTENSOS (> 2,000 CARACTERES)
  // =========================================================================
  describe('6. Los 7 Formatos Homiléticos Ministeriales Extensos', () => {
    it('formato 1: SERMON_CULTO debe incluir 4 movimientos, texto áureo y llamado al altar', async () => {
      const response = await engine.generate(
        'preparar sermon para el domingo de Romanos',
        '[CREADOR_ESTUDIO]',
        'Discipulo',
        undefined,
        undefined,
        null,
        'SERMON_CULTO'
      );

      expect(response.length).toBeGreaterThan(2500);
      expect(response).toContain('SERMÓN HOMILÉTICO DE PÚLPITO: ROMANOS');
      expect(response).toContain('Texto Áureo de Apertura');
      expect(response).toContain('PROPÓSITO MINISTERIAL Y VERDAD CENTRAL');
      expect(response).toContain('CUATRO MOVIMIENTOS EXPOSITIVOS');
      expect(response).toContain('CONCLUSIÓN Y LLAMADO MINISTERIAL AL ALTAR');
      expect(response).toContain('Oración Pastoral para Ministrar desde el Púlpito');
    });

    it('formato 2: ESTUDIO_CLASE debe incluir objetivos pedagógicos y cuadro comparativo', async () => {
      const response = await engine.generate(
        'leccion de escuela biblica sobre Efesios',
        '[CREADOR_ESTUDIO]',
        'Discipulo',
        undefined,
        undefined,
        null,
        'ESTUDIO_CLASE'
      );

      expect(response.length).toBeGreaterThan(2500);
      expect(response).toContain('GUÍA PEDAGÓGICA Y LECCIÓN EXEGÉTICA: EFESIOS');
      expect(response).toContain('OBJETIVOS PEDAGÓGICOS INTEGRALES');
      expect(response).toContain('CUADRO COMPARATIVO DOCTRINAL');
      expect(response).toContain('PLAN DE LECTURA Y TAREA SEMANAL');
    });

    it('formato 3: CELULA_JOVENES debe incluir cronograma de 60 min y dinámica rompehielo', async () => {
      const response = await engine.generate(
        'reunion de celula de jovenes',
        '[CREADOR_ESTUDIO]',
        'Semilla',
        undefined,
        undefined,
        null,
        'CELULA_JOVENES'
      );

      expect(response.length).toBeGreaterThan(2500);
      expect(response).toContain('GUÍA PARA GRUPOS PEQUEÑOS Y CÉLULAS DE JÓVENES');
      expect(response).toContain('CRONOGRAMA MINUTO A MINUTO (60 MIN)');
      expect(response).toContain('DINÁMICA ROMPEHIELO');
      expect(response).toContain('DESAFÍO SEMANAL DE IMPACTO');
    });

    it('formato 4: SERIE_CAMPANA debe proyectar las 4 semanas completas (28 días)', async () => {
      const response = await engine.generate(
        'campaña de 4 semanas de consagracion',
        '[CREADOR_ESTUDIO]',
        'Discipulo',
        undefined,
        undefined,
        null,
        'SERIE_CAMPANA'
      );

      expect(response.length).toBeGreaterThan(2500);
      expect(response).toContain('SEMANA 1: EL FUNDAMENTO INDESTRUCTIBLE');
      expect(response).toContain('SEMANA 2: EL PROCESO EN EL CRISOL');
      expect(response).toContain('SEMANA 3: LA TRANSFORMACIÓN INTERIOR');
      expect(response).toContain('SEMANA 4: LA COMISIÓN Y EL IMPACTO MULTIPLICADOR');
      expect(response).toContain('GUÍA DE AYUNO Y LECTURA CONTINUA DE 28 DÍAS');
    });

    it('formato 5: PERFIL_PERSONAJE debe analizar virtudes, caídas y lecciones de liderazgo', async () => {
      const response = await engine.generate(
        'estudio biográfico del personaje David',
        '[CREADOR_ESTUDIO]',
        'Discipulo',
        undefined,
        undefined,
        null,
        'PERFIL_PERSONAJE'
      );

      expect(response.length).toBeGreaterThan(2000);
      expect(response).toContain('BIOGRAFÍA Y PERFIL BÍBLICO EXHAUSTIVO');
      expect(response).toContain('SUS GRANDES VICTORIAS DE FE');
      expect(response).toContain('CRISIS, DEBILIDADES Y MOMENTOS DE QUEBRANTO');
      expect(response).toContain('LA GRACIA QUE RESTAURA Y VUELVE A COMISIONAR');
      expect(response).toContain('CINCO LECCIONES DE LIDERAZGO PARA EL CREYENTE MODERNO');
    });

    it('formato 6: DOCTRINA_SISTEMATICA debe refutar herejías históricas con citas confesionales', async () => {
      const response = await engine.generate(
        'doctrina de la justificacion por la fe',
        '[CREADOR_ESTUDIO]',
        'Maestro',
        undefined,
        undefined,
        null,
        'DOCTRINA_SISTEMATICA'
      );

      expect(response.length).toBeGreaterThan(2000);
      expect(response).toContain('ESTUDIO DE TEOLOGÍA SISTEMÁTICA Y APOLOGÉTICA CANÓNICA');
      expect(response).toContain('DEFINICIÓN TEOLÓGICA E HISTÓRICA DEL DOGMA');
      expect(response).toContain('DESARROLLO VETEROTESTAMENTARIO (SOMBRAS Y PACTOS EN EL AT)');
      expect(response).toContain('PLENITUD CRISTOLÓGICA Y APOSTÓLICA EN EL NUEVO TESTAMENTO');
      expect(response).toContain('APOLOGÉTICA: RESPUESTA A TRES OBJECIONES COMUNES');
      expect(response).toContain('APLICACIÓN PASTORAL Y DOXOLOGÍA FINAL');
    });

    it('formato 7: CEREMONIA_ESPECIAL debe incluir liturgia paso a paso para eventos solemnes', async () => {
      const response = await engine.generate(
        'liturgia para santa cena solemne',
        '[CREADOR_ESTUDIO]',
        'Discipulo',
        undefined,
        undefined,
        null,
        'CEREMONIA_ESPECIAL'
      );

      expect(response.length).toBeGreaterThan(2000);
      expect(response).toContain('ORDEN LITÚRGICO MINUTO A MINUTO');
      expect(response).toContain('HOMILÍA PASTORAL');
      expect(response).toContain('ORACIÓN SACERDOTAL DE BENDICIÓN FINAL');
    });
  });

  // =========================================================================
  // 7. MEMORIA EVOLUTIVA DINÁMICA
  // =========================================================================
  describe('7. Integración de Memoria Evolutiva del Usuario', () => {
    it('debe entrelazar el tema previamente estudiado cuando el usuario hace una nueva consulta', async () => {
      const mockProfile: UserEvolutionProfile = {
        total_consultas: 5,
        nivel_actual: 'Discipulo',
        temas_estudiados: [
          {
            tema: 'Pacto Abrahámico',
            conteo: 3,
            primera_fecha: '2026-10-01',
            ultima_fecha: '2026-10-25',
          },
        ],
        versiculos_recurrentes: ['Génesis 15:6'],
        autores_preferidos: ['Pablo'],
        progreso_fe_notas: 'Creciendo en comprensión de pactos',
        crisis_detectadas_historico: 0,
      };

      const response = await engine.generate(
        'háblame de la fidelidad de Dios en el trabajo',
        '[CHARLA_CONSEJERIA]',
        'Discipulo',
        undefined,
        undefined,
        mockProfile
      );

      expect(response).toContain('Pacto Abrahámico');
      expect(response).toContain('[CITA:');
      expect(response).toMatch(/\?$/m);
    });
  });

  // =========================================================================
  // 8. ESCUDO DE CRISIS PASTORAL (SEGURIDAD EMOCIONAL Y ESPIRITUAL)
  // =========================================================================
  describe('8. Escudo de Crisis Pastoral', () => {
    it('debe activar inmediatamente la bandera de crisis con mensaje pastoral y líneas de ayuda ante ideación suicida', () => {
      const crisisInput = 'ya no quiero vivir, siento que mi vida no tiene sentido y quiero acabar con todo';
      const result = processShield(crisisInput);

      expect(result.crisis.isCrisis).toBe(true);
      expect(result.crisis.severity).toBe('CRITICA');
      expect(result.crisis.immediatePastoralAction).toBeDefined();
      expect(result.crisis.immediatePastoralAction?.helplineRecommendation).toContain('Teléfono de la Esperanza');
      expect(result.crisis.immediatePastoralAction?.biblicalAnchors.some((a) => a.includes('Salmos 34:18'))).toBe(true);
      expect(result.tags).toContain('CRISIS_EMOCIONAL');
    });
  });
});
