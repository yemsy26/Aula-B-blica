import { describe, it, expect } from 'vitest';
import { selectAdaptiveModel, AVAILABLE_MODELS } from '../core/inference/modelRegistry.js';
import { getPersonalityConfig } from '../core/inference/systemPrompts.js';
import { ChunkedDownloader } from '../core/inference/chunkedDownloader.js';
import { LocalDeterministicEngine } from '../core/inference/localEngine.js';

describe('Inferencia Edge - Selector Adaptativo de Hardware', () => {
  it('debe asignar perfil ULTRALIGHT (0.8B) en dispositivos con RAM <= 3GB', () => {
    const model = selectAdaptiveModel({
      platform: 'android',
      estimatedRamMb: 2048,
      isLowEndDevice: true,
    });

    expect(model.id).toBe('ULTRALIGHT');
    expect(model.cuantizacion).toBe('Q3_K_M');
    expect(model.tamanoMb).toBeLessThanOrEqual(450);
  });

  it('debe asignar perfil STANDARD (1.5B) en dispositivos con RAM >= 4GB', () => {
    const model = selectAdaptiveModel({
      platform: 'android',
      estimatedRamMb: 6144,
      isLowEndDevice: false,
    });

    expect(model.id).toBe('STANDARD');
    expect(model.cuantizacion).toBe('Q4_K_M');
    expect(model.contextoMaxTokens).toBe(2048);
  });
});

describe('Inferencia Edge - Camaleón de Personalidad y Prompts', () => {
  it('debe cambiar de temperatura y prompt en < 1 ms según ruta y nivel', () => {
    const start = performance.now();
    const configSemilla = getPersonalityConfig('[CHARLA_CONSEJERIA]', 'Semilla');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1);
    expect(configSemilla.temperature).toBe(0.6);
    expect(configSemilla.systemPrompt).toContain('MODO SEMILLA');
    expect(configSemilla.systemPrompt).toContain('[CITA: Libro Cap:Vers]');
  });

  it('debe configurar temperatura ultra-baja (0.1) en [BUSQUEDA_EXACTA]', () => {
    const configExacta = getPersonalityConfig('[BUSQUEDA_EXACTA]', 'Maestro');
    expect(configExacta.temperature).toBe(0.1);
    expect(configExacta.systemPrompt).toContain('MODO MAESTRO');
  });

  it('debe configurar estructura homilética en [CREADOR_ESTUDIO]', () => {
    const configEstudio = getPersonalityConfig('[CREADOR_ESTUDIO]', 'Discipulo');
    expect(configEstudio.systemPrompt).toContain('bosquejo homilético');
    expect(configEstudio.systemPrompt).toContain('MODO DISCÍPULO');
  });
});

describe('Inferencia Edge - Descargador Fraccionado por Bloques', () => {
  it('debe simular descarga fraccionada por bloques de 50MB con pausa y reanudación', async () => {
    let lastProgressPercentage = 0;
    const manifest = AVAILABLE_MODELS.ULTRALIGHT;

    const downloader = new ChunkedDownloader(manifest, (p) => {
      lastProgressPercentage = p.porcentaje;
    });

    expect(downloader.getStatus()).toBe('IDLE');

    // Iniciar descarga
    const downloadPromise = downloader.start();
    // Pausar tras breve periodo
    setTimeout(() => downloader.pause(), 10);

    await downloadPromise;
    expect(['PAUSED', 'COMPLETED']).toContain(downloader.getStatus());

    // Reanudar y finalizar
    if (downloader.getStatus() === 'PAUSED') {
      const resumePromise = downloader.start();
      await resumePromise;
      expect(downloader.getStatus()).toBe('COMPLETED');
      expect(lastProgressPercentage).toBe(100);
    }
  });
});

describe('Inferencia Edge - Motor Determinista Local', () => {
  it('debe generar respuesta con streaming de tokens y etiquetas [CITA: ...]', async () => {
    const engine = new LocalDeterministicEngine();
    const streamedTokens: string[] = [];

    const fullResponse = await engine.generate(
      '¿Qué dice el Salmo 23 sobre el descanso?',
      '[BUSQUEDA_EXACTA]',
      'Semilla',
      undefined,
      (token) => streamedTokens.push(token)
    );

    expect(streamedTokens.length).toBeGreaterThan(0);
    expect(fullResponse).toContain('[CITA:');
    expect(engine.isModelReady()).toBe(true);
  });

  it('debe liberar memoria inmediatamente al finalizar la generación', async () => {
    const engine = new LocalDeterministicEngine();
    await engine.generate('creación del mundo', '[BUSQUEDA_EXACTA]', 'Maestro');
    // Verifica que el método de limpieza se ejecute sin excepciones
    await expect(engine.releaseMemory()).resolves.toBeUndefined();
  });

  it('debe componer dinámicamente un estudio devocional para Éxodo en nivel Semilla', async () => {
    const engine = new LocalDeterministicEngine();
    const response = await engine.generate(
      'quiero estudiar éxodo',
      '[CREADOR_ESTUDIO]',
      'Semilla'
    );

    expect(response).toContain('Guía y Estudio Devocional: Éxodo');
    expect(response).toContain('Pasos Prácticos de Fe');
    expect(response).toContain('[CITA: Éxodo');
  });

  it('debe componer dinámicamente un bosquejo homilético para Apocalipsis en nivel Discípulo', async () => {
    const engine = new LocalDeterministicEngine();
    const response = await engine.generate(
      'bosquejo de apocalipsis',
      '[CREADOR_ESTUDIO]',
      'Discipulo'
    );

    expect(response).toContain('Bosquejo Homilético y Teológico: Apocalipsis');
    expect(response).toContain('Preguntas para Discipulado');
    expect(response).toContain('[CITA: Apocalipsis');
  });

  it('debe componer dinámicamente un análisis exegético para Romanos en nivel Maestro', async () => {
    const engine = new LocalDeterministicEngine();
    const response = await engine.generate(
      'analisis exegetico de romanos',
      '[CREADOR_ESTUDIO]',
      'Maestro'
    );

    expect(response).toContain('Análisis Exegético y Teología Bíblica: Romanos');
    expect(response).toContain('Estructura Literaria');
    expect(response).toContain('[CITA: Romanos');
  });

  it('debe gestionar la activación del modelo activo sin interferir en el ciclo de vida', () => {
    const engine = new LocalDeterministicEngine();
    expect(engine.getActiveModelId()).toBe('MOCK');
    engine.setActiveModelId('ULTRALIGHT');
    expect(engine.getActiveModelId()).toBe('ULTRALIGHT');
    engine.setActiveModelId('STANDARD');
    expect(engine.getActiveModelId()).toBe('STANDARD');
  });

  describe('Generación Homilética Multiformato y Extensa (Multipágina)', () => {
    it('debe generar un Sermón de Culto extenso (> 2,500 caracteres) con todos los apartados ministeriales requeridos', async () => {
      const engine = new LocalDeterministicEngine();
      const response = await engine.generate(
        'necesito un estudio de Romanos para dar un culto',
        '[CREADOR_ESTUDIO]',
        'Discipulo'
      );

      // Verificación de volumen extenso (multipágina ministerial)
      expect(response.length).toBeGreaterThan(2500);

      // Verificación de estructura homilética obligatoria
      expect(response).toContain('SERMÓN HOMILÉTICO DE PÚLPITO: ROMANOS');
      expect(response).toContain('Texto Áureo de Apertura');
      expect(response).toContain('[CITA: Romanos');
      expect(response).toContain('PROPÓSITO MINISTERIAL Y VERDAD CENTRAL');
      expect(response).toContain('INTRODUCCIÓN PASTORAL Y ROMPEHIELO');
      expect(response).toContain('CUATRO MOVIMIENTOS EXPOSITIVOS');
      expect(response).toContain('El Diagnóstico del Corazón');
      expect(response).toContain('Paz Inquebrantable');
      expect(response).toContain('Seguridad Eterna');
      expect(response).toContain('El Culto Racional');
      expect(response).toContain('G5485');
      expect(response).toContain('Frase de Poder');
      expect(response).toContain('CONCLUSIÓN Y LLAMADO MINISTERIAL AL ALTAR');
      expect(response).toContain('Oración Pastoral para Ministrar desde el Púlpito');
      expect(response).toContain('Desafío Semanal Congregacional');
    });

    it('debe generar una Lección Docente de Escuela Dominical extensa con tabla y plan semanal', async () => {
      const engine = new LocalDeterministicEngine();
      const response = await engine.generate(
        'clase de escuela dominical sobre Génesis',
        '[CREADOR_ESTUDIO]',
        'Discipulo',
        undefined,
        undefined,
        null,
        'ESTUDIO_CLASE'
      );

      expect(response.length).toBeGreaterThan(2500);
      expect(response).toContain('GUÍA PEDAGÓGICA Y LECCIÓN EXEGÉTICA: GÉNESIS');
      expect(response).toContain('OBJETIVOS PEDAGÓGICOS INTEGRALES');
      expect(response).toContain('Objetivo Cognitivo');
      expect(response).toContain('GLOSARIO DE TÉRMINOS CLAVE');
      expect(response).toContain('CUADRO COMPARATIVO DOCTRINAL');
      expect(response).toContain('GUÍA DE DISCUSIÓN GRUPAL');
      expect(response).toContain('PLAN DE LECTURA Y TAREA SEMANAL');
    });

    it('debe generar una Guía de Célula de Jóvenes con cronograma de 60 min y dinámica', async () => {
      const engine = new LocalDeterministicEngine();
      const response = await engine.generate(
        'tema para grupo de jóvenes sobre la identidad',
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
      expect(response).toContain('HISTORIA ESPEJO');
      expect(response).toContain('ENSEÑANZA CENTRAL INTERACTIVA');
      expect(response).toContain('DESAFÍO SEMANAL DE IMPACTO');
      expect(response).toContain('GUÍA DE ORACIÓN EN PAREJAS');
    });

    it('debe generar un Plan de Campaña de 4 Semanas completo', async () => {
      const engine = new LocalDeterministicEngine();
      const response = await engine.generate(
        'campaña de 4 semanas de fe',
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

    it('debe generar una Liturgia para Ceremonia Especial', async () => {
      const engine = new LocalDeterministicEngine();
      const response = await engine.generate(
        'orden litúrgico para una boda cristiana',
        '[CREADOR_ESTUDIO]',
        'Discipulo',
        undefined,
        undefined,
        null,
        'CEREMONIA_ESPECIAL'
      );

      expect(response.length).toBeGreaterThan(2000);
      expect(response).toContain('CEREMONIA NUPCIAL Y BENDICIÓN MATRIMONIAL');
      expect(response).toContain('ORDEN LITÚRGICO MINUTO A MINUTO');
      expect(response).toContain('HOMILÍA PASTORAL');
      expect(response).toContain('ORACIÓN SACERDOTAL DE BENDICIÓN FINAL');
    });
  });
});
