import { ChatMessage, UserEvolutionProfile } from '../database/usuarioMemoriaService.js';
import { BrainActivity, BrainChatMessage } from '../inference/brain/types.js';
import { brainRegistry } from '../inference/brain/brainRegistry.js';
import { effortForModel } from '../inference/brain/effortContract.js';
import { MinistryFormat, ShieldProcessingResult, UserTheologicalLevel, processShield } from '../shield/index.js';
import {
  composeCancellationNotice,
  composeCrisisAnswer,
  composeDeterministicAnswer,
  composeDocumentAnswer,
  composePlanProposal,
  composeSmallTalk,
  composeVerifiedVerseAnswer,
} from './deterministicAnswers.js';
import { VerifiedVerse, isSimpleVerseRequest } from '../rag/verseRequest.js';
import { decideTurn, markTurnCompleted } from './dialogueManager.js';
import { compositionCache } from './compositionCache.js';
import { shouldComposeVerifiedAnswer } from './executionPolicy.js';
import {
  buildBrainMessages,
  buildContinuationMessages,
  buildDocumentPromptFromSlots,
} from './promptContract.js';
import { extractContinuationContext, isContinuationRequest } from './continuation.js';
import { extractTurnContext } from './slotExtractor.js';
import {
  DetectedTurnContext,
  DialogueMode,
  DialogueState,
  DialogueTurnResult,
  TurnDecision,
} from './types.js';

export interface InjectedCitationLike {
  literalText: string;
  formattedReference?: string;
  foundInDatabase: boolean;
}

export interface RunDialogueTurnParams {
  prompt: string;
  state: DialogueState;
  mode?: DialogueMode;
  preferredLevel?: UserTheologicalLevel;
  preferredFormat?: MinistryFormat;
  history?: ChatMessage[];
  userProfile?: UserEvolutionProfile | null;
  groundTruthContext?: string;
  availableCitations?: string[];
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  /** 'loading' mientras el GGUF se carga; 'generating' cuando ya produce tokens. */
  onActivity?: (activity: BrainActivity) => void;
  shieldResult?: ShieldProcessingResult;
  injectCitations?: (text: string) => {
    processedText: string;
    citations: InjectedCitationLike[];
  };
  /** Fuerza el motor determinista (pruebas o modo sin modelo). */
  forceDeterministic?: boolean;
  /**
   * Cita ya resuelta contra SQLite. Para peticiones directas de versículo se
   * responde con ella y no se deja la transcripción al modelo.
   */
  verifiedVerse?: VerifiedVerse | null;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message)))
  );
}

function buildHistorySummary(history?: ChatMessage[]): string {
  if (!history || history.length === 0) return '';

  return history
    .slice(-8)
    .map((message) => {
      const speaker = message.role === 'assistant' ? 'Asistente' : 'Usuario';
      const content = message.content.replace(/\s+/g, ' ').trim().slice(0, 180);
      return `${speaker}: ${content}`;
    })
    .join('\n');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 180);
  return 'error desconocido';
}

function deterministicAnswer(params: {
  prompt: string;
  state: DialogueState;
  context: DetectedTurnContext;
  action: DialogueTurnResult['action'];
  availableCitations?: string[];
}): string {
  const { prompt, state, context, action, availableCitations } = params;

  if (action === 'GENERATE_DOCUMENT') {
    return composeDocumentAnswer({ prompt, state, context, availableCitations });
  }

  return composeDeterministicAnswer({ prompt, context, state, availableCitations });
}

/**
 * Las composiciones verificadas son reproducibles: el mismo pedido, nivel y
 * conjunto de citas produce el mismo texto. La caché evita repetir el recorrido
 * de catálogo y plantillas cuando el usuario vuelve a pedir lo mismo.
 */
function cachedDeterministicAnswer(params: {
  prompt: string;
  state: DialogueState;
  context: DetectedTurnContext;
  action: DialogueTurnResult['action'];
  availableCitations?: string[];
}): string {
  const key = [
    params.action,
    params.state.level,
    JSON.stringify(params.state.slots),
    params.prompt.trim().toLowerCase(),
    (params.availableCitations ?? []).join(','),
    params.context.passage
      ? `${params.context.passage.book} ${params.context.passage.chapter}:${
          params.context.passage.verseStart ?? ''
        }`
      : '',
    params.context.bookName ?? '',
    params.context.doctrineId ?? '',
    params.context.characterName ?? '',
    params.context.mirrorId ?? '',
  ].join('|');

  return compositionCache.getOrCreate(key, () => deterministicAnswer(params));
}

function noticeBlock(message: string): string {
  return `\n\n> **Nota:** ${message}`;
}

/**
 * Orquestador de un turno completo:
 * escudo -> extracción de slots -> decisión -> cerebro o motor determinista -> citas.
 *
 * Es agnóstico del modelo: el mismo flujo funciona con Ollama, LM Studio o el motor local.
 */
export async function runDialogueTurn(params: RunDialogueTurnParams): Promise<DialogueTurnResult> {
  const { prompt, signal, onToken } = params;
  const mode = params.mode ?? params.state.mode;

  const shield = params.shieldResult ?? processShield(prompt, params.preferredLevel, params.preferredFormat);
  const level = params.preferredLevel ?? shield.detectedLevel;

  const baseState: DialogueState = {
    ...params.state,
    mode,
    level,
    historySummary: buildHistorySummary(params.history),
    updatedAt: new Date().toISOString(),
  };

  const context = extractTurnContext(prompt, {
    preferredFormat: params.preferredFormat,
    previousPassage: baseState.lastPassage,
    previousTopic: baseState.lastTopic,
  });

  // «Continúa» se resuelve contra el último intercambio real del chat, no
  // contra el texto literal: un cerebro recién cargado no tiene memoria y, si
  // solo recibe «continúa», saluda o inventa un tema nuevo.
  const continuation = isContinuationRequest(prompt)
    ? extractContinuationContext(params.history)
    : null;

  let decision: TurnDecision = decideTurn({
    prompt,
    state: baseState,
    context,
    mode,
    crisisSeverity: shield.crisis.severity,
  });

  // La continuación solo cede ante una crisis. En cualquier otro caso es una
  // orden explícita de retomar, aunque el detector de slots no la reconozca.
  if (continuation && decision.action !== 'CRISIS_RESPONSE') {
    decision = {
      action: 'ANSWER',
      state: {
        ...decision.state,
        phase: 'FOLLOW_UP',
        pendingQuestion: undefined,
        updatedAt: new Date().toISOString(),
      },
      directive: [
        'Retoma la respuesta anterior en el punto exacto donde se cortó.',
        'Continúa el mismo desarrollo, con el mismo formato y nivel de detalle.',
        'No saludes, no repitas lo ya escrito y no cambies de tema.',
      ].join('\n'),
      reason: 'El usuario pidió continuar la respuesta anterior',
    };
  }

  const brainStatus = brainRegistry.getStatus();
  const provider = brainStatus.provider;
  const brainId = brainStatus.provider === 'deterministic' ? 'deterministic-edge' : brainStatus.model;
  const brainLabel = brainStatus.label;

  let text = '';
  let fallbackUsed = false;
  let notice: string | undefined;
  let cancelled = false;
  let continued = false;
  let truncated = false;

  const finish = (rawText: string): DialogueTurnResult => {
    let processedText = rawText;
    let citations: string[] = [];

    if (params.injectCitations) {
      const injected = params.injectCitations(rawText);
      processedText = injected.processedText;
      citations = injected.citations
        .filter((citation) => citation.foundInDatabase)
        .map((citation) => citation.literalText)
        .filter((literal) => literal.trim().length > 0);
    }

    const finalState = markTurnCompleted(decision.state, decision.action);

    return {
      text: processedText,
      state: finalState,
      action: decision.action,
      brainId,
      brainLabel,
      provider,
      fallbackUsed,
      notice,
      cancelled,
      continued,
      truncated,
      citations,
      shield,
    };
  };

  if (signal?.aborted) {
    cancelled = true;
    return {
      ...finish(composeCancellationNotice()),
      cancelled: true,
    };
  }

  // 1. Respuestas deterministas de control: no necesitan modelo.
  if (decision.action === 'SMALL_TALK') {
    text = composeSmallTalk();
    return finish(text);
  }

  if (decision.action === 'ASK_CLARIFICATION') {
    text =
      decision.state.pendingQuestion?.question ??
      '¿Puedes darme un poco más de contexto para responder con precisión?';
    return finish(text);
  }

  if (decision.action === 'PROPOSE_PLAN') {
    text = composePlanProposal(decision.state, context);
    return finish(text);
  }

  if (decision.action === 'CRISIS_RESPONSE') {
    text = composeCrisisAnswer(shield.crisis);
    return finish(text);
  }

  // 1a. Continuación sin cerebro real: el motor determinista no guarda
  // respuestas a medias, así que se explica en lugar de saludar o inventar.
  if (continuation && (params.forceDeterministic || provider === 'deterministic')) {
    text =
      '> **Nota:** El motor determinista responde con material verificado y no puede retomar una respuesta a medias.\n\n' +
      'Para continuar exactamente donde se cortó, activa un cerebro (Ollama, LM Studio o un GGUF en el dispositivo). ' +
      'Si prefieres seguir sin modelo, dime qué sección quieres ampliar y la preparo como una respuesta nueva.';
    if (onToken) onToken(text);
    return finish(text);
  }

  // 1b. Petición directa de versículo: la cita sale de SQLite, no del modelo.
  // Un 0.5B puede continuar el estilo bíblico e inventar palabras; aquí la
  // fidelidad textual pesa más que la fluidez.
  if (
    decision.action === 'ANSWER' &&
    params.verifiedVerse &&
    isSimpleVerseRequest(prompt)
  ) {
    text = composeVerifiedVerseAnswer(params.verifiedVerse);
    if (onToken && text.length > 0) onToken(text);

    notice =
      'Cita textual verificada en la Biblia local (SQLite). El modelo se usa para dialogar y explicar, no para recitar la Escritura de memoria.';

    return finish(text + noticeBlock(notice));
  }

  // 2. Motor determinista (offline o fallback).
  if (params.forceDeterministic || provider === 'deterministic') {
    text = cachedDeterministicAnswer({
      prompt,
      state: decision.state,
      context,
      action: decision.action,
      availableCitations: params.availableCitations,
    });

    if (onToken && text.length > 0) {
      onToken(text);
    }

    return finish(text);
  }

  // 3. Modelo real: contrato de prompt + historial completo + streaming.
  const documentMode = decision.action === 'GENERATE_DOCUMENT';

  // Un GGUF de bolsillo no puede redactar un documento largo: gastaría minutos
  // en el prefill y se cortaría a media sección. El compositor verificado genera
  // el documento completo con citas literales; el modelo local se reserva para
  // el diálogo, donde sí aporta.
  if (documentMode && provider === 'on-device') {
    text = cachedDeterministicAnswer({
      prompt,
      state: decision.state,
      context,
      action: decision.action,
      availableCitations: params.availableCitations,
    });

    notice =
      'Documento completo generado con el motor verificado (catálogo y citas de SQLite). ' +
      'El modelo local se usa para el diálogo; para redacción libre extensa conecta Ollama o LM Studio.';

    if (onToken && text.length > 0) onToken(text);
    return finish(text + noticeBlock(notice));
  }

  // 3b. Exégesis, estudio de pasaje, libro, doctrina, personaje o espejo
  // bíblico: el motor verificado ya sabe componerlo con citas literales. Pedirle
  // eso a un 0.5B cuesta minutos y produce citas inventadas. La regla solo se
  // aplica en on-device y nunca a una continuación o un seguimiento abierto.
  if (
    shouldComposeVerifiedAnswer({
      provider,
      action: decision.action,
      mode,
      context,
      continuation: Boolean(continuation),
    })
  ) {
    text = cachedDeterministicAnswer({
      prompt,
      state: decision.state,
      context,
      action: decision.action,
      availableCitations: params.availableCitations,
    });

    notice =
      'Estudio compuesto con el motor verificado (pasaje, catálogo y citas de SQLite). ' +
      'El modelo local se reserva para el diálogo abierto; si quieres una ampliación libre, pídela explícitamente.';

    if (onToken && text.length > 0) onToken(text);
    return finish(text + noticeBlock(notice));
  }

  const modelEffort = provider === 'on-device' ? effortForModel(brainStatus.model) : undefined;

  const systemDirective = documentMode
    ? [
        decision.directive,
        '',
        `Instrucción concreta de contenido: ${buildDocumentPromptFromSlots(decision.state, context, prompt)}`,
      ].join('\n')
    : decision.directive;

  const messages: BrainChatMessage[] = continuation
    ? buildContinuationMessages({
        prompt,
        previousUser: continuation.previousUser,
        previousAssistant: continuation.previousAssistant,
        state: decision.state,
        context,
        directive: systemDirective,
        mode,
        historySummary: baseState.historySummary,
        compact: provider === 'on-device',
        effort: modelEffort,
      })
    : buildBrainMessages({
        prompt,
        state: decision.state,
        context,
        directive: systemDirective,
        mode,
        groundTruthContext: params.groundTruthContext,
        historySummary: baseState.historySummary,
        history: params.history,
        compact: provider === 'on-device',
        effort: modelEffort,
        historyLimit: modelEffort?.historyMessages,
      });

  const config = brainRegistry.getConfig();
  let accumulated = '';

  try {
    const result = await brainRegistry.chat(
      {
        messages,
        temperature: documentMode ? Math.min(config.temperature, 0.4) : config.temperature,
        maxTokens: documentMode ? Math.max(config.maxTokens, 2600) : config.maxTokens,
        topP: 0.9,
        stream: true,
        onActivity: params.onActivity,
        deterministic: {
          route: shield.detectedRoute,
          level,
          availableCitations: params.availableCitations,
          groundTruthContext: params.groundTruthContext,
          userProfile: params.userProfile ?? null,
          format: decision.state.slots.format ?? context.slots.format,
          chatHistory: params.history,
          mode: documentMode ? 'document' : 'answer',
          directive: decision.directive,
        },
      },
      (token) => {
        accumulated += token;
        onToken?.(token);
      },
      signal
    );

    text = result.text.trim();
    truncated = result.finishReason === 'length';

    if (text.length === 0) {
      throw new Error('El modelo devolvió una respuesta vacía.');
    }

    if (continuation) continued = true;

    return finish(text);
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      cancelled = true;
      const partial = accumulated.trim();
      return {
        ...finish(partial.length > 0 ? partial : composeCancellationNotice()),
        cancelled: true,
      };
    }

    fallbackUsed = true;
    notice = `${brainLabel} no respondió (${errorMessage(
      error
    )}). Respondí con el motor determinista local para no dejarte sin respuesta.`;

    text = cachedDeterministicAnswer({
      prompt,
      state: decision.state,
      context,
      action: decision.action,
      availableCitations: params.availableCitations,
    });

    if (onToken) {
      onToken(text);
    }

    return finish(text + noticeBlock(notice));
  }
}
