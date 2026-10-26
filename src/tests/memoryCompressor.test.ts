import { describe, it, expect, beforeEach } from 'vitest';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { UsuarioMemoriaService, ChatMessage } from '../core/database/usuarioMemoriaService.js';
import { MemoryCompressor } from '../core/memory/memoryCompressor.js';

describe('Compresor de Memoria Global Asíncrono - Destilador en Tiempo Muerto', () => {
  let usuarioService: UsuarioMemoriaService;
  let compressor: MemoryCompressor;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    usuarioService = new UsuarioMemoriaService(adapter);
    await usuarioService.initializeSchema();
    // Umbral de 2 mensajes para pruebas rápidas
    compressor = new MemoryCompressor(usuarioService, 2);
  });

  it('debe encolar tareas sin bloquear la ejecución sincrónica', () => {
    const sampleMessages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'user',
        content: '¿Por qué Dios permite que suframos si Él nos ama?',
        timestamp: new Date().toISOString(),
        level: 'Semilla',
      },
    ];

    expect(() => {
      compressor.scheduleCompression('chat_1', sampleMessages);
    }).not.toThrow();
  });

  it('debe extraer dudas pendientes, versículos y temas doctrinales en segundo plano', async () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'user',
        content: '¿Cómo se relaciona la justificación por fe en Romanos 3:23 con las obras en Efesios 2:8?',
        timestamp: new Date().toISOString(),
        level: 'Discipulo',
        route: '[CHARLA_CONSEJERIA]',
      },
      {
        id: 'm2',
        role: 'assistant',
        content:
          'La justificación es un acto legal inmutable de Dios. Como enseña la Escritura en Efesios 2:8-9, las buenas obras son el fruto, no la raíz.',
        timestamp: new Date().toISOString(),
        level: 'Discipulo',
        route: '[CHARLA_CONSEJERIA]',
      },
    ];

    compressor.scheduleCompression('chat_1', messages);

    // Ejecutar compresión inmediata
    const snapshot = await compressor.flushNow();

    expect(snapshot).not.toBeNull();
    expect(snapshot?.dudasDetectadas.length).toBeGreaterThan(0);
    expect(snapshot?.temasExtraidos.some((t) => t.includes('Gracia'))).toBe(true);
    expect(snapshot?.versiculosClave.length).toBeGreaterThan(0);
    expect(snapshot?.nivelPercibido).toBe('Discipulo');
  });

  it('debe garantizar que la síntesis de cruce global no supere las 300 palabras', async () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'user',
        content: 'Explícame el significado profundo de bara en Génesis 1:1 y cómo Cristo es el Logos de Juan 1:1',
        timestamp: new Date().toISOString(),
        level: 'Maestro',
        route: '[CREADOR_ESTUDIO]',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'En la exégesis de Génesis 1:1, Dios crea de la nada...',
        timestamp: new Date().toISOString(),
        level: 'Maestro',
        route: '[CREADOR_ESTUDIO]',
      },
    ];

    compressor.scheduleCompression('chat_2', messages);
    const snapshot = await compressor.flushNow();

    expect(snapshot).not.toBeNull();
    const wordCount = snapshot!.sintesisCruceGlobal.split(/\s+/).length;
    expect(wordCount).toBeLessThan(300);

    // Verificar que la ficha maestra en SQLite se haya actualizado
    const profile = usuarioService.getGlobalProfile();
    expect(profile.nivel_espiritual).toBe('Maestro');
    expect(profile.resumen_madurez).toContain('Usuario en nivel [Maestro]');
  });
});
