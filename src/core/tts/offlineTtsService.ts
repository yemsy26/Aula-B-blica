import { TtsController, TtsState, TtsVoiceOption, TtsEngineMode } from './types.js';
import { rankVoices, RankedVoiceOption } from './voiceRanker.js';
import { cleanPhonetics, ProsodyChunker, ProsodyChunk } from './prosodyChunker.js';
import { piperNeuralTts } from './piperNeuralTtsAdapter.js';

export class OfflineTtsService implements TtsController {
  private state: TtsState = {
    isPlaying: false,
    isPaused: false,
    rate: 1.0,
    pitch: 1.0,
    currentChunkIndex: 0,
    totalChunks: 0,
    activeEngineMode: 'SYSTEM_NEURAL',
  };

  private onStateChangeListeners: ((state: TtsState) => void)[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private activeChunks: ProsodyChunk[] = [];
  private activeChunkIndex: number = 0;
  private onPlaybackComplete?: () => void;
  private pauseTimeoutId: any = null;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateBestVoice = () => {
        const ranked = this.getVoices();
        if (ranked.length > 0 && !this.state.selectedVoiceName) {
          // Seleccionar automáticamente la voz con mayor ranking (Tier 1 Neural HD)
          this.state.selectedVoiceName = ranked[0].name;
        }
        this.notifyState();
      };

      window.speechSynthesis.onvoiceschanged = updateBestVoice;
      // Intento inmediato por si las voces ya están listas
      updateBestVoice();
    }
  }

  subscribe(listener: (state: TtsState) => void): () => void {
    this.onStateChangeListeners.push(listener);
    listener(this.getState());
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener);
    };
  }

  private notifyState(): void {
    for (const listener of this.onStateChangeListeners) {
      listener({ ...this.state });
    }
  }

  getState(): TtsState {
    return { ...this.state };
  }

  getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  /**
   * Obtiene la lista de voces en español clasificadas y ordenadas por calidad humana (Tier 1 a Tier 3)
   */
  getVoices(): RankedVoiceOption[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    const rawVoices = window.speechSynthesis.getVoices();
    const voiceOptions: TtsVoiceOption[] = rawVoices.map((v, idx) => ({
      voiceIndex: idx,
      name: v.name,
      lang: v.lang,
      isDefault: v.default,
      isLocalService: v.localService,
    }));

    return rankVoices(voiceOptions);
  }

  setRate(rate: number): void {
    this.state.rate = Math.min(Math.max(rate, 0.7), 1.6);
    this.notifyState();
  }

  setVoice(voiceName: string): void {
    this.state.selectedVoiceName = voiceName;
    this.notifyState();
  }

  setEngineMode(mode: TtsEngineMode): void {
    this.state.activeEngineMode = mode;
    this.notifyState();
  }

  /**
   * Limpiador fonético y teológico para lectura humana fluida
   */
  cleanTextForSpeech(text: string): string {
    return cleanPhonetics(text);
  }

  /**
   * Reproducción con modulación prosódica pastoral por chunks
   */
  speak(text: string, onEnd?: () => void): void {
    this.stop();

    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    // Si está activo el motor Piper Neural HD Offline y el modelo está listo
    if (this.state.activeEngineMode === 'PIPER_HD_OFFLINE' && piperNeuralTts.isModelLoaded()) {
      const cleanText = this.cleanTextForSpeech(text);
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.state.currentUtteranceText = cleanText;
      this.notifyState();

      piperNeuralTts.speak(cleanText, () => {
        this.state.isPlaying = false;
        this.state.isPaused = false;
        this.state.currentUtteranceText = undefined;
        this.notifyState();
        if (onEnd) onEnd();
      });
      return;
    }

    // Segmentar con el ProsodyChunker
    const chunks = ProsodyChunker.chunk(text);
    if (chunks.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    this.activeChunks = chunks;
    this.activeChunkIndex = 0;
    this.onPlaybackComplete = onEnd;

    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.totalChunks = chunks.length;
    this.state.currentChunkIndex = 0;
    this.notifyState();

    this.playChunk(0);
  }

  private playChunk(index: number): void {
    if (index >= this.activeChunks.length) {
      this.finishPlayback();
      return;
    }

    const chunk = this.activeChunks[index];
    this.activeChunkIndex = index;
    this.state.currentChunkIndex = index;
    this.state.currentChunkKind = chunk.kind;
    this.state.currentUtteranceText = chunk.text;
    this.notifyState();

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      // Simulación en vitest / Node
      this.pauseTimeoutId = setTimeout(() => {
        this.playChunk(index + 1);
      }, 35);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    // Aplicar modulación prosódica combinada con la velocidad elegida por el usuario
    utterance.rate = Math.min(Math.max(chunk.rate * this.state.rate, 0.6), 1.6);
    utterance.pitch = Math.min(Math.max(chunk.pitch * this.state.pitch, 0.7), 1.4);

    // Asignar voz seleccionada o la de mayor ranking
    const rawVoices = window.speechSynthesis.getVoices();
    if (this.state.selectedVoiceName) {
      const v = rawVoices.find((x) => x.name === this.state.selectedVoiceName);
      if (v) utterance.voice = v;
    } else {
      const ranked = this.getVoices();
      if (ranked.length > 0) {
        const topVoice = rawVoices.find((x) => x.name === ranked[0].name);
        if (topVoice) utterance.voice = topVoice;
      }
    }

    utterance.onend = () => {
      // Pausa respiratoria natural antes del siguiente chunk
      this.pauseTimeoutId = setTimeout(() => {
        if (this.state.isPlaying && !this.state.isPaused) {
          this.playChunk(index + 1);
        }
      }, chunk.pauseAfterMs || 250);
    };

    utterance.onerror = () => {
      // Continuar al siguiente chunk en caso de error en uno de ellos
      this.playChunk(index + 1);
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  private finishPlayback(): void {
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentUtteranceText = undefined;
    this.activeChunks = [];
    this.activeChunkIndex = 0;
    this.notifyState();

    if (this.onPlaybackComplete) {
      this.onPlaybackComplete();
    }
  }

  pause(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    if (this.pauseTimeoutId) {
      clearTimeout(this.pauseTimeoutId);
    }
    this.state.isPaused = true;
    this.notifyState();
  }

  resume(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    this.state.isPaused = false;
    this.notifyState();

    // Si estaba pausado durante un intermedio de pausa
    if (this.state.isPlaying && this.activeChunks.length > 0) {
      this.playChunk(this.activeChunkIndex);
    }
  }

  stop(): void {
    if (this.pauseTimeoutId) {
      clearTimeout(this.pauseTimeoutId);
      this.pauseTimeoutId = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    piperNeuralTts.stop();

    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentUtteranceText = undefined;
    this.activeChunks = [];
    this.activeChunkIndex = 0;
    this.notifyState();
  }

  nextChunk(): void {
    if (this.activeChunks.length === 0) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.pauseTimeoutId) clearTimeout(this.pauseTimeoutId);

    const nextIdx = Math.min(this.activeChunkIndex + 1, this.activeChunks.length - 1);
    this.playChunk(nextIdx);
  }

  previousChunk(): void {
    if (this.activeChunks.length === 0) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.pauseTimeoutId) clearTimeout(this.pauseTimeoutId);

    const prevIdx = Math.max(this.activeChunkIndex - 1, 0);
    this.playChunk(prevIdx);
  }
}

export const offlineTts = new OfflineTtsService();
