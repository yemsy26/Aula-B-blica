import { describe, it, expect } from 'vitest';
import {
  resolveUserAgreement,
  extractFormatFromText,
  composeDialogueAgreementProposal,
  wrapApprovedDocumentWithDialogue,
} from '../core/inference/dialogueAgreementManager.js';
import { localInferenceEngine } from '../core/inference/localEngine.js';
import { ChatMessage } from '../core/database/usuarioMemoriaService.js';

describe('Sistema de Diálogo y Acuerdo Ministerial Colaborativo', () => {
  describe('1. Resolución del Estado de Acuerdo (resolveUserAgreement)', () => {
    it('debe iniciar en modo diálogo colaborativo (sin aprobación previa) ante consultas abiertas', () => {
      const result = resolveUserAgreement('quiero preparar un sermón sobre la paz');
      expect(result.isApprovedOrExplicit).toBe(false);
      expect(result.targetFormat).toBe('SERMON_CULTO');
    });

    it('debe detectar aprobación inmediata si el formato ministerial viene seleccionado en la barra superior', () => {
      const result = resolveUserAgreement('la fe en tiempos difíciles', undefined, 'SERMON_CULTO');
      expect(result.isApprovedOrExplicit).toBe(true);
      expect(result.targetFormat).toBe('SERMON_CULTO');
    });

    it('debe detectar aprobación cuando el mensaje contiene un botón [ACUERDO: ...]', () => {
      const result = resolveUserAgreement('[ACUERDO: Desarrollar Sermón de Culto Completo]');
      expect(result.isApprovedOrExplicit).toBe(true);
      expect(result.targetFormat).toBe('SERMON_CULTO');

      const resultClase = resolveUserAgreement('[ACUERDO: Desarrollar Lección de Escuela Dominical]');
      expect(resultClase.isApprovedOrExplicit).toBe(true);
      expect(resultClase.targetFormat).toBe('ESTUDIO_CLASE');
    });

    it('debe detectar aprobación si el usuario responde afirmativamente tras una propuesta del asistente', () => {
      const chatHistory: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'quiero predicar el domingo sobre el perdón',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: '### Diálogo Pastoral y Propuesta de Acuerdo: El perdón\n\n¿Te parece adecuado este rumbo de 3 puntos?',
          timestamp: new Date().toISOString(),
        },
      ];

      const affirmativeReplies = ['sí', 'si', 'adelante', 'hazlo', 'de acuerdo', 'desarróllalo', 'procede', 'perfecto'];
      for (const reply of affirmativeReplies) {
        const res = resolveUserAgreement(reply, chatHistory);
        expect(res.isApprovedOrExplicit).toBe(true);
      }
    });

    it('debe detectar solicitud explícita cuando el prompt contiene órdenes directas de formato completo', () => {
      const explicitPrompts = [
        'genera el sermón completo de Romanos 8',
        'escribe el bosquejo completo para el culto',
        'dame la guía completa de escuela dominical',
      ];
      for (const prompt of explicitPrompts) {
        const res = resolveUserAgreement(prompt);
        expect(res.isApprovedOrExplicit).toBe(true);
      }
    });
  });

  describe('2. Deducción de Formatos (extractFormatFromText)', () => {
    it('debe deducir correctamente los 7 formatos ministeriales', () => {
      expect(extractFormatFromText('quiero dar una clase en la escuela dominical')).toBe('ESTUDIO_CLASE');
      expect(extractFormatFromText('reunión de célula de jóvenes')).toBe('CELULA_JOVENES');
      expect(extractFormatFromText('serie de campaña de 4 semanas')).toBe('SERIE_CAMPANA');
      expect(extractFormatFromText('perfil biográfico del rey david')).toBe('PERFIL_PERSONAJE');
      expect(extractFormatFromText('tratado de doctrina sistemática sobre la justificación')).toBe('DOCTRINA_SISTEMATICA');
      expect(extractFormatFromText('ceremonia de boda y votos')).toBe('CEREMONIA_ESPECIAL');
      expect(extractFormatFromText('bosquejo para predicar en el púlpito el domingo')).toBe('SERMON_CULTO');
    });
  });

  describe('3. Generador de Propuesta de Diálogo y Acuerdo', () => {
    it('debe producir una propuesta estructurada con 3 puntos, citas y opciones de acuerdo', () => {
      const proposal = composeDialogueAgreementProposal({
        prompt: 'preparar una prédica sobre la fidelidad de Dios',
        route: '[CREADOR_ESTUDIO]',
        level: 'Discipulo',
        firstCitation: 'Lamentaciones 3:22-23',
        secondCitation: 'Salmos 36:5',
        suggestedFormat: 'SERMON_CULTO',
      });

      expect(proposal).toContain('Diálogo Pastoral y Propuesta de Acuerdo:');
      expect(proposal).toContain('Fundamento Canónico Inicial:');
      expect(proposal).toContain('[CITA: Lamentaciones 3:22-23]');
      expect(proposal).toContain('Propuesta de Movimientos y Enfoque:');
      expect(proposal).toContain('1. **');
      expect(proposal).toContain('2. **');
      expect(proposal).toContain('3. **');
      expect(proposal).toContain('[ACUERDO:');
      expect(proposal).toContain('¿Te parece adecuado este rumbo de 3 puntos');
    });

    it('debe envolver documentos aprobados con afirmación pastoral y seguimiento ping-pong', () => {
      const wrapped = wrapApprovedDocumentWithDialogue(
        'Contenido doctrinal extenso del sermón...',
        'SERMON_CULTO',
        'adelante, desarróllalo'
      );

      expect(wrapped).toContain('¡Excelente acuerdo!');
      expect(wrapped).toContain('Contenido doctrinal extenso del sermón...');
      expect(wrapped).toContain('Seguimiento Pastoral en Diálogo');
      expect(wrapped).toContain('Pizarra de Estudio');
      expect(wrapped.trim().endsWith('?')).toBe(true);
    });
  });

  describe('4. Inferencia con Motor Determinista y Flujo Conversacional', () => {
    it('ante una solicitud abierta de sermón, no debe escupir el documento crudo, sino la propuesta dialogada', async () => {
      const response = await localInferenceEngine.generate(
        'quiero preparar un sermón sobre la victoria en cristo',
        '[CREADOR_ESTUDIO]',
        'Discipulo'
      );

      // No debe ser el documento de 3000 caracteres todavía
      expect(response).toContain('Diálogo Pastoral y Propuesta de Acuerdo:');
      expect(response).toContain('Propuesta de Movimientos y Enfoque:');
      expect(response).toContain('[ACUERDO: Desarrollar');
      expect(response).toContain('¿Te parece adecuado este rumbo');
    });

    it('cuando el usuario confirma con [ACUERDO: ...], el motor entrega el formato extenso completo y wrap dialógico', async () => {
      const response = await localInferenceEngine.generate(
        '[ACUERDO: Desarrollar Sermón de Culto Completo]',
        '[CREADOR_ESTUDIO]',
        'Discipulo'
      );

      expect(response.length).toBeGreaterThan(2000);
      expect(response).toContain('¡Excelente acuerdo!');
      expect(response).toContain('SERMÓN HOMILÉTICO DE PÚLPITO');
      expect(response).toContain('CUATRO MOVIMIENTOS EXPOSITIVOS');
      expect(response).toContain('Seguimiento Pastoral en Diálogo');
    });

    it('ante un versículo específico (Salmo 23:1), entrega la exégesis profunda y opciones de herramientas para continuar', async () => {
      const response = await localInferenceEngine.generate(
        'dame un estudio detallado del salmo 23:1',
        '[CREADOR_ESTUDIO]',
        'Discipulo'
      );

      expect(response).toContain('Estudio Exegético y Teológico Detallado: Salmos 23:1');
      expect(response).toContain('Léxico Original y Definiciones Exegéticas');
      expect(response).toContain('Código Strong: H3068');
      expect(response).toContain('Código Strong: H7462');
      expect(response).toContain('Herramientas Homiléticas Disponibles');
      expect(response).toContain('[ACUERDO: Desarrollar Sermón Expositivo de Culto sobre Salmos 23:1]');
    });

    it('ante la solicitud de cómo estudiar un libro, entrega la guía pedagógica con definiciones y hojas de ruta', async () => {
      const response = await localInferenceEngine.generate(
        'como estudiar el libro de Romanos',
        '[CREADOR_ESTUDIO]',
        'Discipulo'
      );

      expect(response).toContain('Guía Pedagógica y Acompañamiento: Libro de Romanos');
      expect(response).toContain('Léxico y Definiciones Doctrinales Fundamentales del Libro');
      expect(response).toContain('Justificación');
      expect(response).toContain('Gracia');
      expect(response).toContain('Hoja de Ruta de Aprendizaje');
      expect(response).toContain('[ACUERDO: Desarrollar Serie de 4 Semanas sobre Romanos]');
    });
  });
});
