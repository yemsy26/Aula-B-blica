import {
  BrainAdapter,
  BrainCapabilities,
  BrainChatRequest,
  BrainChatResult,
  BrainHealth,
} from './types.js';
import { LineStreamBuffer, linkAbort, parseOllamaLine } from './streamParser.js';

const CAPABILITIES: BrainCapabilities = {
  contextWindow: 8192,
  streaming: true,
  chat: true,
  jsonMode: true,
  languages: ['es', 'en'],
  local: true,
};

function trimBase(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

/**
 * Adaptador para Ollama.
 * Usa /api/chat (no /api/generate) para conservar el historial de la conversación.
 */
export class OllamaAdapter implements BrainAdapter {
  readonly id: string;
  readonly kind = 'ollama' as const;
  readonly capabilities = CAPABILITIES;

  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(endpoint: string, model: string, timeoutMs = 45000) {
    this.endpoint = trimBase(endpoint);
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.id = `ollama:${this.model}`;
  }

  get label(): string {
    return `Ollama · ${this.model || 'sin modelo'}`;
  }

  async health(signal?: AbortSignal): Promise<BrainHealth> {
    const started = Date.now();
    const linked = linkAbort(signal, Math.min(this.timeoutMs, 4000));

    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        signal: linked.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          detail: `Ollama respondió HTTP ${response.status}.`,
        };
      }

      const payload = (await response.json()) as {
        models?: Array<{ name?: string; model?: string }>;
      };
      const models = (payload.models ?? [])
        .map((item) => item.name ?? item.model ?? '')
        .filter(Boolean);

      const wanted = this.model.trim().toLowerCase();
      const modelAvailable =
        !wanted ||
        models.some((name) => {
          const current = name.toLowerCase();
          return current === wanted || current.startsWith(`${wanted}:`) || current.startsWith(wanted);
        });

      return {
        ok: true,
        latencyMs: Date.now() - started,
        models,
        modelAvailable,
        detail: modelAvailable
          ? `Conectado. Modelo ${this.model || '(sin especificar)'} disponible.`
          : `Conectado, pero el modelo "${this.model}" no aparece en /api/tags.`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail:
          error instanceof Error
            ? `No se pudo conectar con ${this.endpoint}: ${error.message}`
            : `No se pudo conectar con ${this.endpoint}.`,
      };
    } finally {
      linked.cleanup();
    }
  }

  async chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult> {
    const started = Date.now();
    const linked = linkAbort(signal, this.timeoutMs);

    try {
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: linked.signal,
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          stream: request.stream !== false,
          options: {
            temperature: request.temperature,
            top_p: request.topP ?? 0.9,
            num_predict: request.maxTokens,
            stop: request.stop ?? [],
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Ollama HTTP ${response.status}${detail ? `: ${detail.slice(0, 400)}` : ''}`
        );
      }

      const contentType = response.headers.get('content-type') ?? '';

      // Algunos servidores ignoran stream=true y devuelven JSON completo.
      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as {
          message?: { content?: string };
          response?: string;
          done?: boolean;
          error?: string;
        };
        if (payload.error) throw new Error(payload.error);

        const text = payload.message?.content ?? payload.response ?? '';
        if (onToken && text) onToken(text);

        return {
          text,
          brainId: this.id,
          provider: 'ollama',
          model: this.model,
          finishReason: payload.done === false ? 'length' : 'stop',
          latencyMs: Date.now() - started,
        };
      }

      if (!response.body) {
        throw new Error('Ollama no devolvió cuerpo de respuesta.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const buffer = new LineStreamBuffer();
      let fullText = '';
      let done = false;

      const consume = (line: string) => {
        const parsed = parseOllamaLine(line);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) {
          fullText += parsed.text;
          onToken?.(parsed.text);
        }
        if (parsed.done) done = true;
      };

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of buffer.push(chunk)) consume(line);
      }

      for (const line of buffer.flush()) consume(line);

      return {
        text: fullText,
        brainId: this.id,
        provider: 'ollama',
        model: this.model,
        finishReason: done ? 'stop' : 'length',
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      if (signal?.aborted) {
        throw new DOMException('Generación cancelada', 'AbortError');
      }
      throw error;
    } finally {
      linked.cleanup();
    }
  }
}
