import { describe, it, expect } from 'vitest';
import {
  normalizeLinguisticDialect,
  detectCrisis,
  classifyRoute,
  classifyLevel,
  classifyMinistryFormat,
  processShield,
} from '../core/shield/index.js';

describe('Escudo Limpiador - Normalizador Lingüístico y Dialectos', () => {
  it('debe traducir abreviaturas frecuentes de mensajería (xq, q, pa, tb, toy)', () => {
    const input = 'xq dios no me ayuda si toy orando y q pa mi vda sea bn';
    const output = normalizeLinguisticDialect(input);

    expect(output).toContain('por qué');
    expect(output).toContain('estoy');
    expect(output).toContain('que');
    expect(output).toContain('para');
    expect(output).toContain('vida');
    expect(output).toContain('bien');
  });

  it('debe traducir modismos regionales latinoamericanos a español neutro (chamba, pana, plata)', () => {
    const input = 'mi pana perdio la chamba y no tiene plata pa comer';
    const output = normalizeLinguisticDialect(input);

    expect(output).toContain('amigo');
    expect(output).toContain('trabajo');
    expect(output).toContain('dinero');
    expect(output).toContain('para');
  });

  it('debe corregir faltas ortográficas teológicas críticas (diosito, jenesis, espiritu santo)', () => {
    const input = 'le pido a diosito y al espiritu santo que lea jenesis 1:1';
    const output = normalizeLinguisticDialect(input);

    expect(output).toContain('Dios');
    expect(output).toContain('Espíritu Santo');
    expect(output).toContain('Génesis 1:1');
  });

  it('debe expandir abreviaturas de libros bíblicos (jn 3:16 -> Juan 3:16)', () => {
    const input = 'busca jn 3:16 y sal 23:1';
    const output = normalizeLinguisticDialect(input);

    expect(output).toContain('Juan 3:16');
    expect(output).toContain('Salmos 23:1');
  });
});

describe('Escudo Limpiador - Detector de Crisis Espiritual / Emocional', () => {
  it('debe detectar ideación suicida o autolesión crítica con latencia inmediata', () => {
    const res = detectCrisis('siento que ya no puedo mas y quiero suicidarme');

    expect(res.isCrisis).toBe(true);
    expect(res.severity).toBe('CRITICA');
    expect(res.matchedTriggers).toContain('suicidarme');
    expect(res.immediatePastoralAction).toBeDefined();
    expect(res.immediatePastoralAction?.biblicalAnchors.length).toBeGreaterThan(0);
  });

  it('debe detectar crisis de severidad media (angustia profunda)', () => {
    const res = detectCrisis('tengo una depresion severa y siento que dios me olvido');

    expect(res.isCrisis).toBe(true);
    expect(res.severity).toBe('MEDIA');
    expect(res.matchedTriggers).toContain('depresion severa');
  });

  it('no debe disparar falsos positivos en consultas teológicas normales', () => {
    const res = detectCrisis('¿Qué dice la Biblia sobre la resurrección de los muertos?');

    expect(res.isCrisis).toBe(false);
    expect(res.severity).toBe('NONE');
    expect(res.matchedTriggers).toHaveLength(0);
  });
});

describe('Escudo Limpiador - Enrutador de Intención y Nivel', () => {
  it('debe clasificar [BUSQUEDA_EXACTA] ante citas bíblicas explícitas', () => {
    const route = classifyRoute('Juan 3:16');
    expect(route).toBe('[BUSQUEDA_EXACTA]');
  });

  it('debe clasificar [CREADOR_ESTUDIO] cuando se solicita bosquejo o sermón', () => {
    const route = classifyRoute('Quiero un bosquejo homilético para predicar sobre la fe');
    expect(route).toBe('[CREADOR_ESTUDIO]');
  });

  it('debe clasificar [CREADOR_ESTUDIO] cuando se solicita estudiar un libro bíblico', () => {
    const route = classifyRoute('quiero estudiar el libro de mateo que me recomiendas');
    expect(route).toBe('[CREADOR_ESTUDIO]');
  });

  it('debe clasificar [CREADOR_ESTUDIO] universalmente para cualquiera de los 66 libros bíblicos', () => {
    expect(classifyRoute('estudiar exodo')).toBe('[CREADOR_ESTUDIO]');
    expect(classifyRoute('profecia de habacuc')).toBe('[CREADOR_ESTUDIO]');
    expect(classifyRoute('panorama de apocalipsis')).toBe('[CREADOR_ESTUDIO]');
    expect(classifyRoute('libro de daniel')).toBe('[CREADOR_ESTUDIO]');
    expect(classifyRoute('epistola a los filipenses')).toBe('[CREADOR_ESTUDIO]');
  });

  it('debe clasificar [CHARLA_CONSEJERIA] en preguntas pastorales cotidianas', () => {
    const route = classifyRoute('Siento mucha ansiedad por mi futuro y no sé cómo orar');
    expect(route).toBe('[CHARLA_CONSEJERIA]');
  });

  it('debe clasificar nivel Maestro ante términos técnicos exegéticos', () => {
    const level = classifyLevel('¿Cuál es la raíz en hebreo bara H1254 y el quiasmo en Génesis?');
    expect(level).toBe('Maestro');
  });

  it('debe clasificar nivel Discípulo ante doctrina de gracia y pactos', () => {
    const level = classifyLevel('Explica la doctrina de la justificación y los pactos en el nuevo testamento');
    expect(level).toBe('Discipulo');
  });

  it('debe clasificar nivel Semilla ante consultas básicas y cotidianas', () => {
    const level = classifyLevel('¿Dios me escucha cuando le hablo?');
    expect(level).toBe('Semilla');
  });

  it('processShield debe ejecutarse en < 5 ms', () => {
    const res = processShield('xq dios permite las pruebas en mi chamba? jn 3:16');
    expect(res.processingTimeMs).toBeLessThan(5);
    expect(res.normalizedText).toContain('Juan 3:16');
    expect(res.normalizedText).toContain('trabajo');
  });

  describe('Detección y Clasificación de Formatos Ministeriales', () => {
    it('debe detectar SERMON_CULTO ante peticiones de prédica o culto dominical', () => {
      expect(classifyMinistryFormat('necesito un estudio de Romanos para dar un culto')).toBe('SERMON_CULTO');
      expect(classifyMinistryFormat('preparar un mensaje para el domingo en el púlpito')).toBe('SERMON_CULTO');
      expect(classifyMinistryFormat('bosquejo homilético para predicar')).toBe('SERMON_CULTO');
    });

    it('debe detectar ESTUDIO_CLASE ante peticiones de escuela dominical o instituto bíblico', () => {
      expect(classifyMinistryFormat('clase de escuela dominical sobre Génesis')).toBe('ESTUDIO_CLASE');
      expect(classifyMinistryFormat('lección dominical para maestros')).toBe('ESTUDIO_CLASE');
      expect(classifyMinistryFormat('estudio bíblico profundo de Hebreos')).toBe('ESTUDIO_CLASE');
    });

    it('debe detectar CELULA_JOVENES ante dinámicas y grupos pequeños', () => {
      expect(classifyMinistryFormat('dinámica para reunión de jóvenes')).toBe('CELULA_JOVENES');
      expect(classifyMinistryFormat('estudio para grupo pequeño en casa de paz')).toBe('CELULA_JOVENES');
      expect(classifyMinistryFormat('tema para célula de jóvenes')).toBe('CELULA_JOVENES');
    });

    it('debe detectar SERIE_CAMPANA ante planes de varias semanas o discipulado', () => {
      expect(classifyMinistryFormat('campaña de 4 semanas sobre el fruto del espíritu')).toBe('SERIE_CAMPANA');
      expect(classifyMinistryFormat('serie de sermones para el mes de la familia')).toBe('SERIE_CAMPANA');
    });

    it('debe detectar PERFIL_PERSONAJE ante biografías y vida de personajes bíblicos', () => {
      expect(classifyMinistryFormat('la vida de Moisés y lecciones de fe')).toBe('PERFIL_PERSONAJE');
      expect(classifyMinistryFormat('perfil bíblico de Elías profeta')).toBe('PERFIL_PERSONAJE');
    });

    it('debe detectar DOCTRINA_SISTEMATICA ante dogmas y apologética', () => {
      expect(classifyMinistryFormat('doctrina de la justificación por la fe')).toBe('DOCTRINA_SISTEMATICA');
      expect(classifyMinistryFormat('teología sistemática y defensa de la fe')).toBe('DOCTRINA_SISTEMATICA');
    });

    it('debe detectar CEREMONIA_ESPECIAL ante eventos litúrgicos solemnes', () => {
      expect(classifyMinistryFormat('mensaje y liturgia para una boda cristiana')).toBe('CEREMONIA_ESPECIAL');
      expect(classifyMinistryFormat('servicio solemne de santa cena')).toBe('CEREMONIA_ESPECIAL');
      expect(classifyMinistryFormat('homilía para un sepelio')).toBe('CEREMONIA_ESPECIAL');
    });

    it('debe asignar detectedFormat en processShield y respetar override explícito', () => {
      const autoRes = processShield('necesito un estudio de Romanos para dar un culto');
      expect(autoRes.detectedFormat).toBe('SERMON_CULTO');
      expect(autoRes.detectedRoute).toBe('[CREADOR_ESTUDIO]');

      const overrideRes = processShield('hablame de Romanos', 'Discipulo', 'CELULA_JOVENES');
      expect(overrideRes.detectedFormat).toBe('CELULA_JOVENES');
    });
  });
});
