import { describe, expect, it } from 'vitest';
import { DeviceSystemInfo } from '../core/native-bridge/types.js';
import { BrainChatMessage } from '../core/inference/brain/types.js';
import {
  describeOnDeviceModel,
  fitMessagesForContext,
  OnDeviceWllama,
  resolveOnDeviceManifest,
  resolveWatchdogLimits,
  sanitizeModelOutput,
  WllamaAdapter,
  WllamaRuntimeModule,
} from '../core/inference/brain/wllamaAdapter.js';
import { BrainRegistry } from '../core/inference/brain/brainRegistry.js';
import { buildSystemPrompt } from '../core/dialogue/promptContract.js';
import { createInitialDialogueState } from '../core/dialogue/dialogueManager.js';
import { DetectedTurnContext } from '../core/dialogue/types.js';

const DEVICE: DeviceSystemInfo = {
  platform: 'android',
  estimatedRamMb: 4096,
  isLowEndDevice: false,
  cpuCores: 8,
};

const MESSAGES: BrainChatMessage[] = [
  { role: 'system', content: 'Eres VerboVivo. Cita con [CITA: Libro Cap:Vers].' },
  { role: 'user', content: '¿Qué enseña Romanos 8:28?' },
];

interface FakeWllamaInstance extends OnDeviceWllama {
  assets: { default: string };
  loadParams?: Record<string, unknown>;
  loadBlobs?: Blob[];
  chatOptions?: Record<string, unknown>;
  exitCalled: boolean;
}

function runtimeWith(
  chunks: string[],
  finishReason: 'stop' | 'length' = 'stop'
): { runtime: WllamaRuntimeModule; instance: () => FakeWllamaInstance } {
  class FakeWllama implements FakeWllamaInstance {
    static last: FakeWllama | null = null;
    loadParams?: Record<string, unknown>;
    loadBlobs?: Blob[];
    chatOptions?: Record<string, unknown>;
    exitCalled = false;

    constructor(
      public assets: { default: string },
      public config?: { suppressNativeLog?: boolean; logger?: unknown; allowOffline?: boolean }
    ) {
      FakeWllama.last = this;
    }

    async loadModel(blobs: Blob[], params: Record<string, unknown>): Promise<void> {
      this.loadBlobs = blobs;
      this.loadParams = params;
    }

    async createChatCompletion(options: Record<string, unknown>): Promise<unknown> {
      this.chatOptions = options;
      const onData = options.onData as (chunk: unknown) => void;
      for (const content of chunks) {
        onData({ choices: [{ delta: { content } }] });
      }
      onData({
        choices: [{ delta: {}, finish_reason: finishReason }],
        usage: { prompt_tokens: 12, completion_tokens: chunks.length },
      });
      return undefined;
    }

    async exit(): Promise<void> {
      this.exitCalled = true;
    }
  }

  return {
    runtime: { Wllama: FakeWllama, LoggerWithoutDebug: {} },
    instance: () => {
      if (!FakeWllama.last) throw new Error('El runtime falso no fue instanciado.');
      return FakeWllama.last;
    },
  };
}

function baseOptions(runtime: WllamaRuntimeModule) {
  return {
    wasmUrl: '/wllama/wllama.wasm',
    loadRuntime: async () => runtime,
    getFileSize: async () => 400 * 1024 * 1024,
    readBlob: async () => new Blob(['gguf-falso']),
    getDeviceInfo: async () => DEVICE,
  };
}

/**
 * Runtime que emite (opcionalmente) un token y luego se queda bloqueado hasta
 * que abortSignal lo corta. Reproduce el worker muerto o el runtime que ignora
 * el final de la generación sin devolver nunca el control.
 */
function stalledRuntime(tokenBeforeStall?: string): WllamaRuntimeModule {
  class FakeWllama {
    async loadModel(): Promise<void> {}

    async createChatCompletion(options: Record<string, unknown>): Promise<unknown> {
      const onData = options.onData as (chunk: unknown) => void;
      const abortSignal = options.abortSignal as AbortSignal;

      if (tokenBeforeStall) {
        onData({ choices: [{ delta: { content: tokenBeforeStall } }] });
      }

      return new Promise((_resolve, reject) => {
        const fail = () => reject(new DOMException('aborted', 'AbortError'));
        if (abortSignal.aborted) {
          fail();
          return;
        }
        abortSignal.addEventListener('abort', fail, { once: true });
      });
    }

    async exit(): Promise<void> {}
  }

  return { Wllama: FakeWllama, LoggerWithoutDebug: {} };
}

describe('Cerebro GGUF en el dispositivo (wllama)', () => {
  it('resuelve el manifiesto por id y describe el modelo sin fingir otro', () => {
    expect(resolveOnDeviceManifest('ULTRALIGHT').tamanoParametros).toBe('0.5B');
    expect(resolveOnDeviceManifest('verbovivo_1.5b_q4km.gguf').id).toBe('STANDARD');
    expect(describeOnDeviceModel('STANDARD')).toContain('En el dispositivo');
    expect(describeOnDeviceModel('STANDARD')).toContain('1.5B');
  });

  it('no declara salud si el archivo no está descargado', async () => {
    const { runtime } = runtimeWith(['no debería generarse']);
    const adapter = new WllamaAdapter('ULTRALIGHT', {
      ...baseOptions(runtime),
      getFileSize: async () => null,
    });

    const health = await adapter.health();

    expect(health.ok).toBe(false);
    expect(health.modelAvailable).toBe(false);
    expect(health.detail).toContain('no está descargado');
  });

  it('carga el GGUF con contexto, un hilo y warmup, y confirma que está listo', async () => {
    const { runtime, instance } = runtimeWith(['listo']);
    const adapter = new WllamaAdapter('ULTRALIGHT', baseOptions(runtime));

    const health = await adapter.warmUp();

    expect(health.ok).toBe(true);
    expect(instance().loadParams?.n_ctx).toBe(2048);
    expect(instance().loadParams?.n_threads).toBe(1);
    expect(instance().loadParams?.n_gpu_layers).toBe(0);
    expect(instance().loadParams?.warmup).toBe(true);
    expect(instance().loadBlobs).toHaveLength(1);
    expect(instance().assets.default).toBe('/wllama/wllama.wasm');
  });

  it('transmite tokens, respeta el tope del modelo pequeño y devuelve uso', async () => {
    const { runtime, instance } = runtimeWith(['Hola ', 'mundo']);
    const adapter = new WllamaAdapter('ULTRALIGHT', baseOptions(runtime));
    const tokens: string[] = [];

    const result = await adapter.chat(
      {
        messages: MESSAGES,
        temperature: 0.4,
        maxTokens: 5000,
        topP: 0.9,
        stream: true,
      },
      (token) => tokens.push(token)
    );

    expect(tokens.join('')).toBe('Hola mundo');
    expect(result.text).toBe('Hola mundo');
    expect(result.provider).toBe('on-device');
    expect(result.finishReason).toBe('stop');
    expect(result.usage?.promptTokens).toBe(12);
    // En Android el tope baja a 128 tokens: un hilo y WASM hacen que cada
    // token cueste segundos, así que la respuesta debe cerrar antes.
    expect(instance().chatOptions?.max_tokens).toBe(128);
    expect(instance().chatOptions?.cache_prompt).toBe(true);
    expect(instance().chatOptions?.penalty_repeat).toBe(1.12);
  });

  it('distingue prefill de generación para que la UI no mienta', async () => {
    const { runtime } = runtimeWith(['Hola', ' mundo']);
    const adapter = new WllamaAdapter('ULTRALIGHT', baseOptions(runtime));
    const activities: string[] = [];

    await adapter.warmUp();
    await adapter.chat(
      {
        messages: MESSAGES,
        temperature: 0.4,
        maxTokens: 64,
        stream: true,
        onActivity: (activity) => activities.push(activity),
      },
      undefined
    );

    expect(activities).toEqual(['prefill', 'generating', 'done']);
  });

  it('permite más salida en PC que en Android con el mismo modelo', async () => {
    const { runtime, instance } = runtimeWith(['listo']);
    const adapter = new WllamaAdapter('ULTRALIGHT', {
      ...baseOptions(runtime),
      getDeviceInfo: async () => ({ ...DEVICE, platform: 'web', estimatedRamMb: 16384 }),
    });

    await adapter.chat({
      messages: MESSAGES,
      temperature: 0.4,
      maxTokens: 900,
      stream: true,
    });

    expect(instance().chatOptions?.max_tokens).toBe(256);
  });

  it('avisa cuando el modelo alcanza el límite de tokens en vez de ocultarlo', async () => {
    const { runtime } = runtimeWith(['Texto cortado'], 'length');
    const adapter = new WllamaAdapter('ULTRALIGHT', baseOptions(runtime));

    const result = await adapter.chat(
      { messages: MESSAGES, temperature: 0.4, maxTokens: 900, stream: true },
      undefined
    );

    expect(result.finishReason).toBe('length');
    expect(result.text).toContain('límite de 128 tokens');
  });

  it('cancela de verdad con AbortSignal', async () => {
    const { runtime } = runtimeWith(['nunca se genera']);
    const adapter = new WllamaAdapter('ULTRALIGHT', baseOptions(runtime));
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.chat(
        { messages: MESSAGES, temperature: 0.4, maxTokens: 200, stream: true },
        undefined,
        controller.signal
      )
    ).rejects.toThrow(/cancelada/i);
  });

  it('libera el runtime al cambiar de cerebro', async () => {
    const { runtime, instance } = runtimeWith(['listo']);
    const adapter = new WllamaAdapter('ULTRALIGHT', baseOptions(runtime));

    await adapter.warmUp();
    await adapter.release();

    expect(instance().exitCalled).toBe(true);
  });

  it('explica el fallo si el runtime no puede cargar el archivo', async () => {
    const { runtime } = runtimeWith(['listo']);
    const adapter = new WllamaAdapter('ULTRALIGHT', {
      ...baseOptions(runtime),
      readBlob: async () => null,
    });

    await expect(adapter.warmUp()).resolves.toMatchObject({
      ok: false,
    });
  });
});

describe('Vigilante de inferencia bloqueada', () => {
  it('corta la espera si nunca llega el primer token y lo explica', async () => {
    const adapter = new WllamaAdapter('ULTRALIGHT', {
      ...baseOptions(stalledRuntime()),
      watchdog: { firstTokenMs: 40, idleMs: 40 },
    });

    await expect(
      adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 64, stream: true })
    ).rejects.toThrow(/no emitió el primer token/i);
  });

  it('distingue un silencio entre tokens de una cancelación del usuario', async () => {
    const adapter = new WllamaAdapter('ULTRALIGHT', {
      ...baseOptions(stalledRuntime('Hola')),
      watchdog: { firstTokenMs: 5000, idleMs: 40 },
    });

    await expect(
      adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 64, stream: true })
    ).rejects.toThrow(/dejó de emitir tokens/i);
  });

  it('una cancelación real sigue siendo «cancelada», no un fallo del vigilante', async () => {
    const adapter = new WllamaAdapter('ULTRALIGHT', {
      ...baseOptions(stalledRuntime()),
      watchdog: { firstTokenMs: 5000, idleMs: 5000 },
    });
    const controller = new AbortController();

    const pending = adapter.chat(
      { messages: MESSAGES, temperature: 0.4, maxTokens: 64, stream: true },
      undefined,
      controller.signal
    );
    setTimeout(() => controller.abort(), 30);

    await expect(pending).rejects.toThrow(/cancelada/i);
  });

  it('los límites del vigilante son más generosos en Android que en PC', () => {
    const android = resolveWatchdogLimits('android', 'ULTRALIGHT');
    const desktop = resolveWatchdogLimits('web', 'ULTRALIGHT');

    expect(android.firstTokenMs).toBeGreaterThan(desktop.firstTokenMs);
    expect(android.idleMs).toBeGreaterThan(desktop.idleMs);
  });
});

describe('Ajuste de prompt al contexto real del modelo local', () => {
  it('conserva el sistema y el turno actual, y descarta historial antiguo', () => {
    const history: BrainChatMessage[] = [];
    for (let index = 0; index < 12; index++) {
      history.push({ role: 'user', content: `Pregunta antigua ${index} `.repeat(60) });
      history.push({ role: 'assistant', content: `Respuesta antigua ${index} `.repeat(80) });
    }

    const messages: BrainChatMessage[] = [
      { role: 'system', content: 'Sistema teológico '.repeat(400) },
      ...history,
      { role: 'user', content: 'Pregunta actual sobre Romanos 8:28' },
    ];

    const fitted = fitMessagesForContext(messages, 2048, 512);

    expect(fitted[0].role).toBe('system');
    expect(fitted[0].content.length).toBeLessThan(messages[0].content.length);
    expect(fitted[fitted.length - 1].content).toContain('Pregunta actual');
    expect(fitted.length).toBeLessThan(messages.length);
  });

  it('en Android ultracompacto conserva solo la pregunta actual y recorta el sistema', () => {
    const messages: BrainChatMessage[] = [
      { role: 'system', content: 'Sistema teológico '.repeat(400) },
      { role: 'assistant', content: 'Respuesta anterior '.repeat(200) },
      { role: 'user', content: 'Pregunta actual sobre la gracia' },
    ];

    const normal = fitMessagesForContext(messages, 2048, 128, false);
    const ultra = fitMessagesForContext(messages, 2048, 128, true);

    expect(ultra.length).toBe(2);
    expect(ultra[1].role).toBe('user');
    expect(ultra[1].content).toContain('Pregunta actual');
    expect(ultra[0].content.length).toBeLessThan(normal[0].content.length);
  });

  it('no deja crecer el prompt sin límite aunque el mensaje sea enorme', () => {
    const messages: BrainChatMessage[] = [
      { role: 'system', content: 'Sistema '.repeat(500) },
      { role: 'user', content: 'Texto enorme '.repeat(5000) },
    ];

    const fitted = fitMessagesForContext(messages, 1024, 300);
    const chars = fitted.reduce((total, message) => total + message.content.length, 0);

    expect(chars).toBeLessThan(6000);
    expect(fitted[fitted.length - 1].role).toBe('user');
  });
});

describe('Limpieza de fugas del contrato en modelos de bolsillo', () => {
  it('recorta la instrucción de salida cuando el modelo la repite', () => {
    const raw =
      'La fe es confiar en Cristo.\n\nResponde en español claro, en 1–3 frases (máx. 80 palabras). No repitas frases ni palabras.';

    expect(sanitizeModelOutput(raw)).toBe('La fe es confiar en Cristo.');
  });

  it('elimina líneas de estado y tarea sin tocar el contenido', () => {
    const raw =
      'La gracia es un don.\nESTADO: tema=gracia\nTAREA: explica la gracia\n\nAmén.';

    expect(sanitizeModelOutput(raw)).toBe('La gracia es un don.\n\nAmén.');
  });
});

describe('Contrato compacto para modelos de bolsillo', () => {
  const context: DetectedTurnContext = {
    slots: { topic: 'perdón', format: 'SERMON_CULTO', audience: 'jovenes' },
    isQuestion: true,
    isGreeting: false,
    isDocumentRequest: false,
    isOverride: false,
    isAffirmative: false,
    isNegative: false,
    explicitGenerationCue: false,
    rawText: '¿Cómo explico el perdón a los jóvenes?',
    normalizedText: 'como explico el perdon a los jovenes',
  };

  it('conserva identidad, citación y directiva con muchas menos palabras', () => {
    const state = createInitialDialogueState();
    const directive = 'Responde en tres párrafos y aplica el texto a la vida diaria.';
    const full = buildSystemPrompt({ state, context, directive, mode: 'CONSULTA' });
    const compact = buildSystemPrompt({
      state,
      context,
      directive,
      mode: 'CONSULTA',
      compact: true,
    });

    expect(compact.length).toBeLessThan(full.length);
    expect(compact.length).toBeLessThan(1800);
    expect(compact).toContain('VerboVivo');
    expect(compact).toContain('[CITA: Libro Cap:Vers]');
    expect(compact).toContain(directive);
    expect(compact).toContain('perdón');
    expect(compact).toContain('jóvenes');
  });
});

describe('Registro de cerebros con proveedor on-device', () => {
  it('activa el cerebro local y lo reporta como modelo real sin endpoint', () => {
    const registry = new BrainRegistry({ provider: 'deterministic' });

    registry.configure({ provider: 'on-device', model: 'ULTRALIGHT' });
    const status = registry.getStatus();

    expect(status.provider).toBe('on-device');
    expect(status.isRealModel).toBe(true);
    expect(status.config.endpoint).toBe('');
    expect(status.label).toContain('En el dispositivo');

    registry.resetForTests();
  });

  it('no arrastra el nombre de un modelo remoto al cambiar a on-device', () => {
    const registry = new BrainRegistry({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'qwen2.5:1.5b',
    });

    const config = registry.configure({ provider: 'on-device' });

    expect(config.model).toBe('ULTRALIGHT');
    expect(config.endpoint).toBe('');

    registry.resetForTests();
  });
});

describe('OPFS y ensamblado', () => {
  it('conserva la lectura clásica de archivos para SQLite y descargas', async () => {
    // Importación dinámica para no forzar el ciclo de módulos en el resto de pruebas.
    const { nativeBridge } = await import('../core/native-bridge/bridge.js');
    const path = 'opfs_contract_test.bin';
    const data = new Uint8Array([1, 2, 3, 4]);

    await nativeBridge.writePrivateFile(path, data);
    const read = await nativeBridge.readPrivateFile(path);
    const blob = await nativeBridge.readPrivateBlob(path);
    const size = await nativeBridge.getPrivateFileSize(path);

    expect(Array.from(read ?? [])).toEqual([1, 2, 3, 4]);
    expect(blob?.size).toBe(4);
    expect(size).toBe(4);
    expect(await nativeBridge.hasPrivateFile(path)).toBe(true);

    await nativeBridge.deletePrivateFile(path);
    expect(await nativeBridge.hasPrivateFile(path)).toBe(false);
  });

  it('ensambla bloques y permite leer el resultado', async () => {
    const { nativeBridge } = await import('../core/native-bridge/bridge.js');
    const destination = 'assembly_contract_test.bin';
    const sources = ['assembly_part_0', 'assembly_part_1'];

    await nativeBridge.writePrivateFile(sources[0], new Uint8Array([1, 2]));
    await nativeBridge.writePrivateFile(sources[1], new Uint8Array([3, 4, 5]));

    const result = await nativeBridge.assemblePrivateFiles(destination, sources);
    const read = await nativeBridge.readPrivateFile(destination);

    expect(result?.size).toBe(5);
    expect(Array.from(read ?? [])).toEqual([1, 2, 3, 4, 5]);

    await nativeBridge.deletePrivateFile(destination);
    await Promise.all(sources.map((source) => nativeBridge.deletePrivateFile(source)));
  });

  it('falla si falta un bloque en vez de inventar el archivo', async () => {
    const { nativeBridge } = await import('../core/native-bridge/bridge.js');

    await expect(
      nativeBridge.assemblePrivateFiles('assembly_missing.bin', ['no_existe_1', 'no_existe_2'])
    ).rejects.toThrow(/Falta el bloque/);

    expect(await nativeBridge.hasPrivateFile('assembly_missing.bin')).toBe(false);
  });
});
