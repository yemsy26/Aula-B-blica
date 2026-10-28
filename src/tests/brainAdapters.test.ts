import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LineStreamBuffer,
  parseOllamaLine,
  parseOpenAiSseLine,
} from '../core/inference/brain/streamParser.js';
import { OllamaAdapter } from '../core/inference/brain/ollamaAdapter.js';
import { OpenAICompatibleAdapter } from '../core/inference/brain/openAiCompatAdapter.js';

function streamResponse(chunks: string[], contentType: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Streaming robusto', () => {
  it('reconstruye líneas partidas entre chunks', () => {
    const buffer = new LineStreamBuffer();
    expect(buffer.push('{"a":')).toEqual([]);
    expect(buffer.push('1}\n{"b":2}\n{"c"')).toEqual(['{"a":1}', '{"b":2}']);
    expect(buffer.flush()).toEqual(['{"c"']);
  });

  it('parsea NDJSON de Ollama y SSE de OpenAI', () => {
    expect(parseOllamaLine('{"message":{"content":"Hola"},"done":false}')).toEqual({
      text: 'Hola',
      done: false,
    });
    expect(parseOllamaLine('{"done":true}')).toEqual({ text: undefined, done: true });
    expect(parseOllamaLine('{"error":"model not found"}')).toEqual({
      error: 'model not found',
    });

    expect(parseOpenAiSseLine('data: {"choices":[{"delta":{"content":"Hola"}}]}')).toEqual({
      text: 'Hola',
      done: false,
    });
    expect(parseOpenAiSseLine('data: [DONE]')).toEqual({ done: true });
    expect(parseOpenAiSseLine('event: ping')).toEqual({});
  });
});

describe('Adaptador Ollama', () => {
  it('envía el historial completo a /api/chat y transmite tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse(
        [
          '{"message":{"content":"Hola "},"done":false}\n{"message":',
          '{"content":"hermano"},"done":false}\n{"done":true}\n',
        ],
        'application/x-ndjson'
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new OllamaAdapter('http://localhost:11434/', 'qwen2.5:1.5b', 5000);
    const tokens: string[] = [];

    const result = await adapter.chat(
      {
        messages: [
          { role: 'system', content: 'Eres VerboVivo' },
          { role: 'user', content: 'Hola' },
          { role: 'assistant', content: '¿En qué te ayudo?' },
          { role: 'user', content: 'Explícame Juan 3:16' },
        ],
        temperature: 0.3,
        maxTokens: 1200,
        stream: true,
      },
      (token) => tokens.push(token)
    );

    expect(result.text).toBe('Hola hermano');
    expect(tokens).toEqual(['Hola ', 'hermano']);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('qwen2.5:1.5b');
    expect(body.messages).toHaveLength(4);
    expect(body.messages[3]).toEqual({ role: 'user', content: 'Explícame Juan 3:16' });
    expect(body.options.temperature).toBe(0.3);
    expect(body.options.num_predict).toBe(1200);
    expect(body.stream).toBe(true);
  });

  it('acepta una respuesta JSON completa aunque se pidiera streaming', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: 'Respuesta completa' }, done: true }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5:1.5b');
    const result = await adapter.chat({
      messages: [{ role: 'user', content: 'Hola' }],
      temperature: 0.2,
      maxTokens: 500,
    });

    expect(result.text).toBe('Respuesta completa');
    expect(result.provider).toBe('ollama');
  });

  it('reporta salud y disponibilidad del modelo en /api/tags', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'qwen2.5:1.5b' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5:1.5b');
    const health = await adapter.health();

    expect(health.ok).toBe(true);
    expect(health.modelAvailable).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/tags');
  });
});

describe('Adaptador OpenAI-compatible', () => {
  it('normaliza /v1, conserva el historial y parsea SSE partido', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse(
        [
          'data: {"choices":[{"delta":{"content":"La "}}]}\n',
          'data: {"choices":[{"delta":{"content":"gracia"}}]}\n',
          'data: [DONE]\n',
        ],
        'text/event-stream'
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new OpenAICompatibleAdapter('http://localhost:1234/v1', 'local-model', 5000);
    const tokens: string[] = [];

    const result = await adapter.chat(
      {
        messages: [
          { role: 'system', content: 'Eres VerboVivo' },
          { role: 'user', content: '¿Qué es la gracia?' },
        ],
        temperature: 0.4,
        maxTokens: 900,
        stream: true,
      },
      (token) => tokens.push(token)
    );

    expect(result.text).toBe('La gracia');
    expect(tokens).toEqual(['La ', 'gracia']);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
    const body = JSON.parse(init.body as string);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].content).toBe('¿Qué es la gracia?');
    expect(body.max_tokens).toBe(900);
  });

  it('acepta endpoints sin /v1 y respuestas JSON completas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Respuesta' }, finish_reason: 'stop' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new OpenAICompatibleAdapter('http://localhost:1234', 'local-model');
    const result = await adapter.chat({
      messages: [{ role: 'user', content: 'Hola' }],
      temperature: 0.4,
      maxTokens: 500,
    });

    expect(result.text).toBe('Respuesta');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
  });

  it('propaga errores HTTP con detalle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('modelo no cargado', { status: 500 })
      )
    );

    const adapter = new OpenAICompatibleAdapter('http://localhost:1234/v1', 'local-model');
    await expect(
      adapter.chat({
        messages: [{ role: 'user', content: 'Hola' }],
        temperature: 0.4,
        maxTokens: 500,
      })
    ).rejects.toThrow(/HTTP 500/);
  });

  it('respeta la cancelación del usuario', async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new OpenAICompatibleAdapter('http://localhost:1234/v1', 'local-model');
    await expect(
      adapter.chat(
        {
          messages: [{ role: 'user', content: 'Hola' }],
          temperature: 0.4,
          maxTokens: 500,
        },
        undefined,
        controller.signal
      )
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
