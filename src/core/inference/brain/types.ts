import { MinistryFormat, TheologicalRoute, UserTheologicalLevel } from '../../shield/types.js';
import { ChatMessage, UserEvolutionProfile } from '../../database/usuarioMemoriaService.js';

/**
 * Capa de cerebros intercambiables.
 *
 * VerboVivo no debe depender de un modelo concreto. Cada proveedor implementa
 * el mismo contrato (chat + health) y recibe siempre el historial completo.
 */

export type BrainProvider = 'deterministic' | 'on-device' | 'ollama' | 'openai-compatible';

export interface BrainCapabilities {
  contextWindow: number;
  streaming: boolean;
  chat: boolean;
  jsonMode: boolean;
  languages: string[];
  local: boolean;
  maxOutputTokens?: number;
}

export interface BrainChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Contexto adicional que solo necesita el motor determinista.
 * Los adaptadores de modelos reales ignoran este bloque.
 */
export interface DeterministicRequestContext {
  route: TheologicalRoute;
  level: UserTheologicalLevel;
  availableCitations?: string[];
  groundTruthContext?: string;
  userProfile?: UserEvolutionProfile | null;
  format?: MinistryFormat;
  chatHistory?: ChatMessage[];
  mode?: 'answer' | 'document' | 'proposal' | 'clarification';
  directive?: string;
}

/**
 * Etapa real de un turno, para que la interfaz no muestre «Generando…»
 * mientras el modelo todavía se está cargando en el dispositivo.
 */
export type BrainActivity = 'loading' | 'prefill' | 'generating' | 'done';

export interface BrainChatRequest {
  messages: BrainChatMessage[];
  temperature: number;
  maxTokens: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  deterministic?: DeterministicRequestContext;
  onActivity?: (activity: BrainActivity) => void;
}

export interface BrainUsage {
  promptTokens?: number;
  completionTokens?: number;
  /** Tokens del prompt reutilizados desde la caché KV nativa. */
  cacheReusedTokens?: number;
}

export interface BrainChatResult {
  text: string;
  brainId: string;
  provider: BrainProvider;
  model?: string;
  finishReason?: 'stop' | 'length' | 'abort' | 'error' | 'unknown';
  usage?: BrainUsage;
  latencyMs: number;
}

export interface BrainHealth {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
  models?: string[];
  modelAvailable?: boolean;
}

export interface BrainAdapter {
  readonly id: string;
  readonly kind: BrainProvider;
  readonly label: string;
  readonly capabilities: BrainCapabilities;
  health(signal?: AbortSignal): Promise<BrainHealth>;
  /**
   * Carga el modelo y confirma que puede generar. Es opcional porque los
   * cerebros remotos ya responden en `health`.
   */
  warmUp?(signal?: AbortSignal): Promise<BrainHealth>;
  chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult>;
  /** Libera memoria del modelo. Solo lo implementan los cerebros locales. */
  release?(): Promise<void>;
}

export interface BrainConfig {
  provider: BrainProvider;
  endpoint: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
  updatedAt?: string;
}

export interface BrainStatus {
  config: BrainConfig;
  label: string;
  provider: BrainProvider;
  model: string;
  isRealModel: boolean;
  health?: BrainHealth;
}
