import { ModelManifest } from '../types.js';
import { getNativeLlamaInfo } from '../../native-bridge/llamaNative.js';
import {
  BrainAdapter,
  BrainCapabilities,
  BrainChatRequest,
  BrainChatResult,
  BrainHealth,
} from './types.js';
import { NativeLlamaAdapter } from './nativeLlamaAdapter.js';
import {
  CONTEXT_BY_MODEL,
  OUTPUT_CAP_BY_MODEL,
  WllamaAdapter,
  resolveOnDeviceManifest,
} from './wllamaAdapter.js';

/**
 * Cerebro GGUF del dispositivo con dos motores reales:
 *
 * - Android con bibliotecas empaquetadas: llama.cpp nativo (JNI, varios hilos,
 *   memoria fuera del WebView).
 * - PC/web o APK sin biblioteca: wllama/WASM (un hilo si no hay COOP/COEP).
 *
 * La elección se hace una sola vez por adaptador y sin fingir: si el plugin
 * nativo no está disponible, se usa WASM; si el modelo no existe en el
 * almacenamiento del motor elegido, la salud lo dice.
 */
export class OnDeviceAdapter implements BrainAdapter {
  readonly id: string;
  readonly kind = 'on-device' as const;
  readonly capabilities: BrainCapabilities;

  private readonly manifest: ModelManifest;
  private mode: 'native' | 'wasm' | null = null;
  private native: NativeLlamaAdapter | null = null;
  private wasm: WllamaAdapter | null = null;
  private selection: Promise<BrainAdapter> | null = null;

  constructor(modelId: string) {
    this.manifest = resolveOnDeviceManifest(modelId);
    this.id = `on-device:${this.manifest.id}`;
    this.capabilities = {
      contextWindow: CONTEXT_BY_MODEL[this.manifest.id],
      streaming: true,
      chat: true,
      jsonMode: false,
      languages: ['es', 'en'],
      local: true,
      maxOutputTokens: OUTPUT_CAP_BY_MODEL[this.manifest.id],
    };
  }

  get label(): string {
    const runtime = this.mode === 'native' ? 'nativo' : this.mode === 'wasm' ? 'WASM' : null;
    const suffix = runtime ? ` · ${runtime}` : '';
    return `En el dispositivo · ${this.manifest.tamanoParametros} ${this.manifest.cuantizacion}${suffix}`;
  }

  private selected(): Promise<BrainAdapter> {
    if (this.mode === 'native' && this.native) return Promise.resolve(this.native);
    if (this.mode === 'wasm' && this.wasm) return Promise.resolve(this.wasm);
    if (this.selection) return this.selection;

    this.selection = (async () => {
      const info = await getNativeLlamaInfo();
      if (info?.available) {
        this.mode = 'native';
        this.native = new NativeLlamaAdapter(this.manifest.id);
        return this.native;
      }

      this.mode = 'wasm';
      this.wasm = new WllamaAdapter(this.manifest.id);
      return this.wasm;
    })().catch((error) => {
      this.selection = null;
      throw error;
    });

    return this.selection;
  }

  async health(signal?: AbortSignal): Promise<BrainHealth> {
    return (await this.selected()).health(signal);
  }

  async warmUp(signal?: AbortSignal): Promise<BrainHealth> {
    const adapter = await this.selected();
    return adapter.warmUp ? adapter.warmUp(signal) : adapter.health(signal);
  }

  async chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult> {
    return (await this.selected()).chat(request, onToken, signal);
  }

  async release(): Promise<void> {
    const adapters = [this.native, this.wasm].filter(
      (adapter): adapter is NativeLlamaAdapter | WllamaAdapter => adapter !== null
    );
    this.native = null;
    this.wasm = null;
    this.mode = null;
    this.selection = null;
    await Promise.all(adapters.map((adapter) => adapter.release?.()));
  }
}
