import {
  BrainAdapter,
  BrainCapabilities,
  BrainChatRequest,
  BrainChatResult,
  BrainHealth,
} from './types.js';

export type DeterministicComposer = (request: BrainChatRequest) => string;

const CAPABILITIES: BrainCapabilities = {
  contextWindow: 8192,
  streaming: true,
  chat: false,
  jsonMode: false,
  languages: ['es'],
  local: true,
  maxOutputTokens: 6000,
};

/**
 * Cerebro determinista local.
 *
 * No es un modelo generativo: es el compositor teológico de VerboVivo.
 * Se etiqueta como tal para no venderlo como IA generativa.
 */
export class DeterministicAdapter implements BrainAdapter {
  readonly id = 'deterministic-edge';
  readonly kind = 'deterministic' as const;
  readonly label = 'Motor determinista VerboVivo (offline)';
  readonly capabilities = CAPABILITIES;

  private composer: DeterministicComposer | null = null;

  constructor(composer?: DeterministicComposer) {
    this.composer = composer ?? null;
  }

  setComposer(composer: DeterministicComposer): void {
    this.composer = composer;
  }

  async health(): Promise<BrainHealth> {
    return {
      ok: true,
      latencyMs: 0,
      detail: this.composer
        ? 'Disponible sin red ni descargas.'
        : 'Compositor aún no registrado.',
      modelAvailable: Boolean(this.composer),
    };
  }

  async chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult> {
    const started = Date.now();

    if (!this.composer) {
      throw new Error(
        'El motor determinista no tiene compositor registrado. Importa localEngine antes de usarlo.'
      );
    }

    if (signal?.aborted) {
      throw new DOMException('Generación cancelada', 'AbortError');
    }

    const text = this.composer(request);

    if (onToken) {
      const tokens = text.split(/(\s+)/);
      for (let i = 0; i < tokens.length; i++) {
        if (signal?.aborted) {
          throw new DOMException('Generación cancelada', 'AbortError');
        }
        onToken(tokens[i]);
        if (i % 8 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }
    }

    return {
      text,
      brainId: this.id,
      provider: 'deterministic',
      model: 'deterministic-edge',
      finishReason: 'stop',
      latencyMs: Date.now() - started,
    };
  }
}
