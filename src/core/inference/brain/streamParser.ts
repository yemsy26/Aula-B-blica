/**
 * Utilidades de streaming robustas.
 *
 * Los chunks de red no respetan los límites de línea ni de evento SSE.
 * Sin un buffer, un JSON parcial se descarta y se pierden tokens.
 */

export class LineStreamBuffer {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    return lines;
  }

  flush(): string[] {
    if (!this.buffer) return [];
    const remaining = this.buffer;
    this.buffer = '';
    return [remaining];
  }
}

export interface ParsedStreamLine {
  text?: string;
  done?: boolean;
  error?: string;
}

/** Extrae el delta de una línea NDJSON de Ollama. */
export function parseOllamaLine(line: string): ParsedStreamLine {
  const trimmed = line.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as {
      response?: string;
      message?: { content?: string };
      done?: boolean;
      error?: string;
    };

    if (parsed.error) return { error: parsed.error };

    const text = parsed.message?.content ?? parsed.response;
    return {
      text: typeof text === 'string' ? text : undefined,
      done: parsed.done === true,
    };
  } catch {
    // Línea incompleta o ruido del servidor. El buffer ya la reconstruyó.
    return {};
  }
}

/** Extrae el delta de una línea SSE de OpenAI-compatible. */
export function parseOpenAiSseLine(line: string): ParsedStreamLine {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return {};

  const data = trimmed.slice(5).trim();
  if (!data) return {};
  if (data === '[DONE]') return { done: true };

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{
        delta?: { content?: string };
        message?: { content?: string };
        text?: string;
        finish_reason?: string | null;
      }>;
      error?: { message?: string } | string;
    };

    if (parsed.error) {
      return {
        error: typeof parsed.error === 'string' ? parsed.error : parsed.error.message,
      };
    }

    const choice = parsed.choices?.[0];
    const text = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
    return {
      text: typeof text === 'string' ? text : undefined,
      done: choice?.finish_reason === 'stop' || choice?.finish_reason === 'length',
    };
  } catch {
    return {};
  }
}

export interface LinkedAbort {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeout: () => boolean;
}

/**
 * Combina la cancelación del usuario con un timeout propio.
 * Permite distinguir "el usuario canceló" de "el cerebro tardó demasiado".
 */
export function linkAbort(parent: AbortSignal | undefined, timeoutMs: number): LinkedAbort {
  const controller = new AbortController();
  let timedOut = false;

  const onAbort = () => controller.abort();
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', onAbort, { once: true });
  }

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
