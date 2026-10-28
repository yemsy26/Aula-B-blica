import {
  BrainAdapter,
  BrainCapabilities,
  BrainChatRequest,
  BrainChatResult,
  BrainHealth,
} from './types.js';
import { LineStreamBuffer, linkAbort, parseOpenAiSseLine } from './streamParser.js';

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
 * Adaptador para cualquier servidor compatible con OpenAI:
 * LM Studio, llama-server, vLLM, LocalAI, etc.
 */
export class OpenAICompatibleAdapter implements BrainAdapter {
  readonly id: string;
  readonly kind = 'openai-compatible' as const;
  readonly capabilities = CAPABILITIES;

  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(endpoint: string, model: string, timeoutMs = 45000) {
    this.endpoint = trimBase(endpoint);
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.id = `openai-compatible:${this.model}`;
  }

  get label(): string {
    return `OpenAI-compatible · ${this.model || 'sin modelo'}`;
  }

  private get base(): string {
    return this.endpoint.endsWith('/v1') ? this.endpoint.slice(0, -3) : this.endpoint;
  }

  async health(signal?: AbortSignal): Promise<BrainHealth> {
    const started = Date.now();
    const linked = linkAbort(signal, Math.min(this.timeoutMs, 4000));

    try {
      const response = await fetch(`${this.base}/v1/models`, {
        method: 'GET',
        signal: linked.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          detail: `El servidor respondió HTTP ${response.status} en /v1/models.`,
        };
      }

      const payload = (await response.json()) as {
        data?: Array<{ id?: string; name?: string }>;
        models?: Array<{ name?: string; id?: string }>;
      };
      const models = (payload.data ?? payload.models ?? [])
        .map((item) => item.id ?? item.name ?? '')
        .filter(Boolean);

      const wanted = this.model.trim().toLowerCase();
      const modelAvailable =
        !wanted ||
        models.some((name) => {
          const current = name.toLowerCase();
          return current === wanted || current.includes(wanted) || wanted.includes(current);
        });

      return {
        ok: true,
        latencyMs: Date.now() - started,
        models,
        modelAvailable,
        detail: modelAvailable
          ? `Conectado. Modelo ${this.model || '(sin especificar)'} disponible.`
          : `Conectado, pero el modelo "${this.model}" no aparece en /v1/models.`,
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
      const response = await fetch(`${this.base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: linked.signal,
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          stream: request.stream !== false,
          temperature: request.temperature,
          top_p: request.topP ?? 0.9,
          max_tokens: request.maxTokens,
          stop: request.stop,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Servidor OpenAI-compatible HTTP ${response.status}${
            detail ? `: ${detail.slice(0, 400)}` : ''
          }`
        );
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as {
          choices?: Array<{
            message?: { content?: string };
            text?: string;
            finish_reason?: string;
          }>;
          error?: { message?: string } | string;
        };

        if (payload.error) {
          throw new Error(
            typeof payload.error === 'string' ? payload.error : payload.error.message
          );
        }

        const choice = payload.choices?.[0];
        const text = choice?.message?.content ?? choice?.text ?? '';
        if (onToken && text) onToken(text);

        return {
          text,
          brainId: this.id,
          provider: 'openai-compatible',
          model: this.model,
          finishReason: choice?.finish_reason === 'length' ? 'length' : 'stop',
          latencyMs: Date.now() - started,
        };
      }

      if (!response.body) {
        throw new Error('El servidor no devolvió cuerpo de respuesta.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const buffer = new LineStreamBuffer();
      let fullText = '';
      let done = false;

      const consume = (line: string) => {
        const parsed = parseOpenAiSseLine(line);
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
        provider: 'openai-compatible',
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
