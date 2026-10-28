import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/native-bridge/llamaNative.js', () => ({
  getNativeLlamaInfo: vi.fn(),
  listNativeModels: vi.fn(),
  loadNativeModel: vi.fn(),
  generateNative: vi.fn(),
  releaseNativeModel: vi.fn(),
  resetNativeLlamaInfoCache: vi.fn(),
}));

import * as nativeBridge from '../core/native-bridge/llamaNative.js';
import { NativeLlamaAdapter } from '../core/inference/brain/nativeLlamaAdapter.js';
import { BrainChatMessage } from '../core/inference/brain/types.js';
import {
  NativeGenerateResult,
  NativeLlamaInfo,
  NativeLoadResult,
} from '../core/native-bridge/llamaNative.js';

const FILE_NAME = 'verbovivo_1.5b_q4km.gguf';

const INFO: NativeLlamaInfo = {
  available: true,
  abi: 'arm64-v8a',
  supportedAbis: ['arm64-v8a'],
  cores: 8,
  recommendedThreads: 6,
  totalRamMb: 16384,
  freeStorageMb: 50000,
  ready: true,
  loadedFileName: '',
  models: [{ fileName: FILE_NAME, sizeBytes: 1_048_576 }],
  npu: {
    available: false,
    usable: false,
    vendor: 'QTI',
    soc: 'SM8650',
    arch: 75,
    name: '',
    description: '',
    reason: 'sin sesión HTP',
  },
  gpu: {
    available: true,
    usable: false,
    software: false,
    name: 'Vulkan0',
    description: 'Adreno (TM) 750',
  },
  accelerationPolicy: {
    mode: 'auto',
    npu: { usable: false, quarantined: false, skipped: false, reason: '', phase: '' },
    gpu: {
      usable: false,
      quarantined: false,
      skipped: true,
      reason: 'Vulkan se omite en Adreno.',
      phase: '',
    },
  },
};

const LOAD: NativeLoadResult = {
  ok: true,
  context: 4096,
  threads: 6,
  loadMs: 120,
  acceleration: 'cpu',
  gpuLayers: 0,
  npu: INFO.npu,
  gpu: INFO.gpu,
  accelerationPolicy: INFO.accelerationPolicy,
};

const MESSAGES: BrainChatMessage[] = [
  { role: 'system', content: 'Eres VerboVivo. Responde con citas verificadas.' },
  { role: 'user', content: 'Explícame la justificación en Romanos 5.' },
];

function generation(overrides: Partial<NativeGenerateResult>): NativeGenerateResult {
  return {
    text: '',
    finishReason: 'stop',
    promptTokens: 1200,
    generatedTokens: 100,
    prefillMs: 10,
    generationMs: 20,
    tokensPerSecond: 10,
    ...overrides,
  };
}

function queueGeneration(results: NativeGenerateResult[]): void {
  const queue = [...results];
  vi.mocked(nativeBridge.generateNative).mockImplementation(async (_request, onToken) => {
    const next = queue.shift();
    if (!next) throw new Error('El test pidió más generaciones de las previstas.');
    if (next.text) onToken?.(next.text);
    return next;
  });
}

describe('NativeLlamaAdapter · presupuesto y continuación automática', () => {
  beforeEach(() => {
    vi.mocked(nativeBridge.getNativeLlamaInfo).mockResolvedValue(INFO);
    vi.mocked(nativeBridge.listNativeModels).mockResolvedValue(INFO.models);
    vi.mocked(nativeBridge.loadNativeModel).mockResolvedValue(LOAD);
    vi.mocked(nativeBridge.generateNative).mockReset();
  });

  it('carga en CPU sin pedir GPU cuando la política la omite', async () => {
    queueGeneration([generation({ text: 'Respuesta breve.' })]);
    const adapter = new NativeLlamaAdapter('STANDARD');

    await adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 1600 });

    expect(nativeBridge.loadNativeModel).toHaveBeenCalledWith({
      fileName: FILE_NAME,
      contextTokens: 4096,
      threads: 6,
      batchTokens: 512,
      gpuLayers: 0,
      acceleration: 'auto',
    });
  });

  it('informa los tokens de prompt reutilizados desde la caché KV nativa', async () => {
    queueGeneration([
      generation({
        text: 'Primera parte del estudio sobre la fe.',
        finishReason: 'length',
        generatedTokens: 400,
        promptTokens: 1100,
        cacheReusedTokens: 900,
      }),
      generation({
        text: 'Segunda parte del estudio sobre la fe.',
        generatedTokens: 120,
        promptTokens: 700,
        cacheReusedTokens: 300,
      }),
    ]);

    const adapter = new NativeLlamaAdapter('STANDARD');
    const result = await adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 1600 });

    expect(result.usage?.cacheReusedTokens).toBe(1200);
    expect(result.usage?.promptTokens).toBe(1100);
  });

  it('respeta el presupuesto del perfil y continúa una sola vez sin pasar del tope', async () => {
    queueGeneration([
      generation({
        text: 'La justificación es un acto judicial de Dios mediante la fe',
        finishReason: 'length',
        generatedTokens: 400,
      }),
      generation({
        text: 'La justificación es un acto judicial de Dios mediante la fe en Cristo, no por obras.',
        finishReason: 'stop',
        generatedTokens: 220,
      }),
    ]);

    const adapter = new NativeLlamaAdapter('STANDARD');
    const streamed: string[] = [];
    const result = await adapter.chat(
      { messages: MESSAGES, temperature: 0.4, maxTokens: 1600 },
      (token) => streamed.push(token)
    );

    const calls = vi.mocked(nativeBridge.generateNative).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].maxTokens).toBe(400);
    expect(calls[1][0].maxTokens).toBe(240);
    expect(calls[1][0].messages).toContainEqual({
      role: 'assistant',
      content: 'La justificación es un acto judicial de Dios mediante la fe',
    });
    expect(calls[1][0].messages[calls[1][0].messages.length - 1].role).toBe('user');

    expect(result.text).toBe(
      'La justificación es un acto judicial de Dios mediante la fe en Cristo, no por obras.'
    );
    expect(result.text.match(/La justificación es un acto judicial/g)).toHaveLength(1);
    expect(result.finishReason).toBe('stop');
    expect(result.usage?.completionTokens).toBe(620);
    expect(streamed.join('')).toContain('en Cristo');
  });

  it('en el 0.5B no encadena bloques: avisa y deja que el usuario amplíe', async () => {
    queueGeneration([
      generation({ text: 'Bloque corto.', finishReason: 'length', generatedTokens: 100 }),
      generation({ text: 'No debería usarse.', finishReason: 'stop', generatedTokens: 10 }),
    ]);

    const adapter = new NativeLlamaAdapter('ULTRALIGHT');
    const result = await adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 1600 });

    expect(nativeBridge.generateNative).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nativeBridge.generateNative).mock.calls[0][0].maxTokens).toBe(192);
    expect(result.finishReason).toBe('length');
    expect(result.text).toContain('Bloque corto.');
    expect(result.text).toContain('Pulsa «Ampliar»');
  });

  it('no continúa cuando el modelo termina antes del presupuesto', async () => {
    queueGeneration([
      generation({ text: 'Respuesta completa.', finishReason: 'stop', generatedTokens: 40 }),
    ]);

    const adapter = new NativeLlamaAdapter('STANDARD');
    const result = await adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 1600 });

    expect(nativeBridge.generateNative).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('Respuesta completa.');
    expect(result.finishReason).toBe('stop');
  });

  it('se detiene tras una continuación en 1.5B y avisa en vez de encadenar más', async () => {
    queueGeneration([
      generation({ text: 'Bloque uno.', finishReason: 'length', generatedTokens: 100 }),
      generation({ text: 'Bloque dos.', finishReason: 'length', generatedTokens: 100 }),
      generation({ text: 'No debería usarse.', finishReason: 'length', generatedTokens: 100 }),
    ]);

    const adapter = new NativeLlamaAdapter('STANDARD');
    const result = await adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 1600 });

    expect(nativeBridge.generateNative).toHaveBeenCalledTimes(2);
    expect(result.finishReason).toBe('length');
    expect(result.text).toContain('Bloque uno. Bloque dos.');
    expect(result.text).not.toContain('No debería usarse.');
    expect(result.text).toContain('continuar automáticamente');
    expect(result.text).not.toContain('Puedes pedir «continúa»');
  });
});

const GPU_INFO: NativeLlamaInfo = {
  ...INFO,
  gpu: { available: true, usable: true, software: false, name: 'Vulkan0', description: 'Adreno (TM) 750' },
  accelerationPolicy: {
    ...INFO.accelerationPolicy!,
    gpu: { usable: true, quarantined: false, skipped: false, reason: '', phase: '' },
  },
};

const GPU_LOAD: NativeLoadResult = {
  ...LOAD,
  acceleration: 'gpu',
  gpuLayers: 999,
  gpu: GPU_INFO.gpu,
  accelerationPolicy: GPU_INFO.accelerationPolicy,
};

function accelerationFailure(): Error & { code: string } {
  const error = new Error(
    'Vulkan no pudo procesar el prompt. Se reintentará en CPU; vuelve a enviar el mensaje.'
  ) as Error & { code: string };
  error.code = 'ACCELERATION_FAILED';
  return error;
}

describe('NativeLlamaAdapter · retroceso automático desde GPU', () => {
  beforeEach(() => {
    vi.mocked(nativeBridge.getNativeLlamaInfo).mockResolvedValue(GPU_INFO);
    vi.mocked(nativeBridge.listNativeModels).mockResolvedValue(GPU_INFO.models);
    vi.mocked(nativeBridge.loadNativeModel).mockReset();
    vi.mocked(nativeBridge.loadNativeModel)
      .mockResolvedValueOnce(GPU_LOAD)
      .mockResolvedValue(LOAD);
    vi.mocked(nativeBridge.releaseNativeModel).mockResolvedValue(undefined);
    vi.mocked(nativeBridge.generateNative).mockReset();
  });

  it('recarga en CPU y repite el bloque sin que el usuario reenvíe el mensaje', async () => {
    vi.mocked(nativeBridge.generateNative)
      .mockRejectedValueOnce(accelerationFailure())
      .mockResolvedValueOnce(generation({ text: 'Respuesta tras el retroceso.' }));

    const adapter = new NativeLlamaAdapter('STANDARD');
    const result = await adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 1600 });

    expect(nativeBridge.generateNative).toHaveBeenCalledTimes(2);
    expect(nativeBridge.releaseNativeModel).toHaveBeenCalled();
    expect(nativeBridge.loadNativeModel).toHaveBeenLastCalledWith(
      expect.objectContaining({ gpuLayers: 0, acceleration: 'cpu' })
    );
    expect(result.text).toBe('Respuesta tras el retroceso.');
  });

  it('no repite el bloque si ya mostró tokens, para no duplicar texto', async () => {
    vi.mocked(nativeBridge.generateNative).mockImplementationOnce(async (_request, onToken) => {
      onToken?.('Texto parcial que ya se mostró');
      throw accelerationFailure();
    });

    const adapter = new NativeLlamaAdapter('STANDARD');
    const streamed: string[] = [];

    await expect(
      adapter.chat({ messages: MESSAGES, temperature: 0.4, maxTokens: 1600 }, (token) =>
        streamed.push(token)
      )
    ).rejects.toThrow(/ya se mostraron tokens/i);

    expect(nativeBridge.generateNative).toHaveBeenCalledTimes(1);
    expect(streamed.join('')).toBe('Texto parcial que ya se mostró');
  });
});

describe('NativeLlamaAdapter · perfil 0.5B Q4_0 en GPU', () => {
  beforeEach(() => {
    vi.mocked(nativeBridge.getNativeLlamaInfo).mockResolvedValue(GPU_INFO);
    vi.mocked(nativeBridge.listNativeModels).mockResolvedValue(GPU_INFO.models);
    vi.mocked(nativeBridge.loadNativeModel).mockReset();
    vi.mocked(nativeBridge.releaseNativeModel).mockResolvedValue(undefined);
    vi.mocked(nativeBridge.generateNative).mockReset();
  });

  it('pide Vulkan explícito con todas las capas aunque la política general omita la GPU', async () => {
    vi.mocked(nativeBridge.loadNativeModel).mockResolvedValue(GPU_LOAD);
    queueGeneration([generation({ text: 'Respuesta rápida.' })]);

    const adapter = new NativeLlamaAdapter('ULTRALIGHT_GPU');
    const result = await adapter.chat({
      messages: MESSAGES,
      temperature: 0.65,
      maxTokens: 512,
    });

    expect(nativeBridge.loadNativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'verbovivo_0.5b_q4_0.gguf',
        gpuLayers: 999,
        acceleration: 'gpu',
      })
    );
    expect(result.text).toBe('Respuesta rápida.');
  });

  it('si la carga en Vulkan falla, carga en CPU sin impedir la respuesta', async () => {
    vi.mocked(nativeBridge.loadNativeModel)
      .mockRejectedValueOnce(new Error('No se pudo cargar el modelo nativo con ningún acelerador.'))
      .mockResolvedValueOnce(LOAD);
    queueGeneration([generation({ text: 'Respuesta en CPU.' })]);

    const adapter = new NativeLlamaAdapter('ULTRALIGHT_GPU');
    const result = await adapter.chat({
      messages: MESSAGES,
      temperature: 0.65,
      maxTokens: 512,
    });

    expect(nativeBridge.loadNativeModel).toHaveBeenCalledTimes(2);
    expect(nativeBridge.loadNativeModel).toHaveBeenLastCalledWith(
      expect.objectContaining({ gpuLayers: 0, acceleration: 'cpu' })
    );
    expect(result.text).toBe('Respuesta en CPU.');
  });

  it('no pide Vulkan si la GPU está en cuarentena', async () => {
    vi.mocked(nativeBridge.getNativeLlamaInfo).mockResolvedValue({
      ...GPU_INFO,
      accelerationPolicy: {
        ...GPU_INFO.accelerationPolicy!,
        gpu: {
          usable: false,
          quarantined: true,
          skipped: false,
          reason: 'La GPU cerró la app antes.',
          phase: 'runtime',
        },
      },
    });
    vi.mocked(nativeBridge.loadNativeModel).mockResolvedValue(LOAD);
    queueGeneration([generation({ text: 'Respuesta en CPU.' })]);

    const adapter = new NativeLlamaAdapter('ULTRALIGHT_GPU');
    await adapter.chat({ messages: MESSAGES, temperature: 0.65, maxTokens: 512 });

    expect(nativeBridge.loadNativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ gpuLayers: 0, acceleration: 'auto' })
    );
  });
});
