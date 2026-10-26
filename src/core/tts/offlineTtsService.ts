import { TtsController, TtsState, TtsVoiceOption, TtsEngineMode } from './types.js';
import { rankVoices, RankedVoiceOption } from './voiceRanker.js';
import { cleanPhonetics, ProsodyChunker, ProsodyChunk } from './prosodyChunker.js';
import { piperNeuralTts } from './piperNeuralTtsAdapter.js';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

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
  private activeUtterancesSet = new Set<SpeechSynthesisUtterance>();
  private activeChunks: ProsodyChunk[] = [];
  private activeChunkIndex: number = 0;
  private onPlaybackComplete?: () => void;
  private pauseTimeoutId: any = null;
  private nativeLang: string = 'es-ES';
  private nativeVoicesCache: RankedVoiceOption[] = [];
  private playChunkRetryCount: number = 0;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (Capacitor.isNativePlatform()) {
      this.initNativeTts();
      return;
    }

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

  private async initNativeTts(): Promise<void> {
    try {
      const res = await TextToSpeech.getSupportedLanguages();
      if (res && res.languages) {
        const preferred = res.languages.find(
          (l) => /^es[-_]/i.test(l) || l.toLowerCase() === 'es'
        );
        if (preferred) {
          this.nativeLang = preferred;
        }
      }

      const voiceRes = await TextToSpeech.getSupportedVoices();
      if (voiceRes && voiceRes.voices && voiceRes.voices.length > 0) {
        // Filtrar voces en español
        const spanishVoices = voiceRes.voices.filter((v: any) =>
          (v.lang || '').toLowerCase().startsWith('es')
        );

        const voiceList = spanishVoices.length > 0 ? spanishVoices : voiceRes.voices;

        const voiceOpts: TtsVoiceOption[] = voiceList.map((v: any, idx: number) => {
          const originalIdx = voiceRes.voices.indexOf(v);
          return {
            voiceIndex: originalIdx >= 0 ? originalIdx : idx,
            name: v.voiceURI || v.name || `Android Voice ${idx + 1}`,
            lang: v.lang || this.nativeLang,
            isDefault: !!v.default,
            isLocalService: v.localService !== false,
          };
        });

        this.nativeVoicesCache = rankVoices(voiceOpts);
        if (this.nativeVoicesCache.length > 0 && !this.state.selectedVoiceName) {
          this.state.selectedVoiceName = this.nativeVoicesCache[0].name;
        }
        this.notifyState();
      }
    } catch (e) {
      console.warn('[TTS Nativo] No se pudo inicializar voces nativas:', e);
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
    if (Capacitor.isNativePlatform() && this.nativeVoicesCache.length > 0) {
      return this.nativeVoicesCache;
    }
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

    if (this.activeChunkIndex !== index) {
      this.playChunkRetryCount = 0;
    }

    const chunk = this.activeChunks[index];
    this.activeChunkIndex = index;
    this.state.currentChunkIndex = index;
    this.state.currentChunkKind = chunk.kind;
    this.state.currentUtteranceText = chunk.text;
    this.notifyState();

    // 1. En entorno Android/iOS nativo, utilizar el motor TTS nativo del sistema
    if (Capacitor.isNativePlatform()) {
      let targetVoiceIndex: number = -1;
      let targetLang = this.nativeLang || 'es-ES';

      if (this.state.selectedVoiceName && this.nativeVoicesCache.length > 0) {
        const found = this.nativeVoicesCache.find(
          (v) =>
            v.name === this.state.selectedVoiceName ||
            v.displayName === this.state.selectedVoiceName ||
            v.voiceIndex.toString() === this.state.selectedVoiceName
        );
        if (found) {
          targetVoiceIndex = found.voiceIndex;
          if (found.lang) targetLang = found.lang;
        }
      } else if (this.nativeVoicesCache.length > 0) {
        targetVoiceIndex = this.nativeVoicesCache[0].voiceIndex;
        if (this.nativeVoicesCache[0].lang) targetLang = this.nativeVoicesCache[0].lang;
      }

      // Velocidad adaptativa: ritmo general del usuario ajustado ligeramente por tipo de fragmento
      const rateMultiplier = chunk.kind === 'verse' ? 0.95 : 1.0;
      const rate = Math.min(Math.max(this.state.rate * rateMultiplier, 0.7), 1.4);
      // En Android nativo, 1.0 mantiene la resonancia humana pura sin distorsión metálica por cambio de tono
      const pitch = 1.0;

      TextToSpeech.speak({
        text: chunk.text,
        lang: targetLang,
        rate,
        pitch,
        volume: 1.0,
        voice: targetVoiceIndex >= 0 ? targetVoiceIndex : undefined,
        category: 'playback',
      })
        .then(() => {
          this.playChunkRetryCount = 0;
          if (!this.state.isPlaying || this.state.isPaused) return;
          this.pauseTimeoutId = setTimeout(() => {
            if (this.state.isPlaying && !this.state.isPaused) {
              this.playChunk(index + 1);
            }
          }, chunk.pauseAfterMs || 250);
        })
        .catch((err) => {
          console.warn(`[TTS Nativo Android] Error en chunk ${index}:`, err);
          if (!this.state.isPlaying || this.state.isPaused) return;
          // Reintentar el mismo chunk si el servicio nativo aún estaba inicializándose
          if (this.playChunkRetryCount < 2) {
            this.playChunkRetryCount++;
            this.pauseTimeoutId = setTimeout(() => {
              if (this.state.isPlaying && !this.state.isPaused) {
                this.playChunk(index);
              }
            }, 450);
            return;
          }
          this.playChunkRetryCount = 0;
          this.pauseTimeoutId = setTimeout(() => {
            if (this.state.isPlaying && !this.state.isPaused) {
              this.playChunk(index + 1);
            }
          }, 350);
        });
      return;
    }

    // 2. Simulación en entorno Node/Vitest
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.pauseTimeoutId = setTimeout(() => {
        this.playChunk(index + 1);
      }, 35);
      return;
    }

    // 3. Entorno Navegador Web
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.lang = 'es-ES';
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

    this.activeUtterancesSet.add(utterance);

    utterance.onend = () => {
      this.activeUtterancesSet.delete(utterance);
      // Pausa respiratoria natural antes del siguiente chunk
      this.pauseTimeoutId = setTimeout(() => {
        if (this.state.isPlaying && !this.state.isPaused) {
          this.playChunk(index + 1);
        }
      }, chunk.pauseAfterMs || 250);
    };

    utterance.onerror = (e) => {
      this.activeUtterancesSet.delete(utterance);
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }
      console.warn('[Web SpeechSynthesis] Error:', e.error);
      this.pauseTimeoutId = setTimeout(() => {
        if (this.state.isPlaying && !this.state.isPaused) {
          this.playChunk(index + 1);
        }
      }, 350);
    };

    this.currentUtterance = utterance;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.speak(utterance);
  }

  private finishPlayback(): void {
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentUtteranceText = undefined;
    this.activeChunks = [];
    this.activeChunkIndex = 0;
    this.playChunkRetryCount = 0;
    this.notifyState();

    if (this.onPlaybackComplete) {
      this.onPlaybackComplete();
    }
  }

  pause(): void {
    if (this.pauseTimeoutId) {
      clearTimeout(this.pauseTimeoutId);
      this.pauseTimeoutId = null;
    }
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => {});
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    this.state.isPaused = true;
    this.notifyState();
  }

  resume(): void {
    if (!this.state.isPlaying) return;
    this.state.isPaused = false;
    this.notifyState();

    if (Capacitor.isNativePlatform()) {
      if (this.activeChunks.length > 0) {
        this.playChunk(this.activeChunkIndex);
      }
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else if (this.activeChunks.length > 0) {
        this.playChunk(this.activeChunkIndex);
      }
    }
  }

  stop(): void {
    if (this.pauseTimeoutId) {
      clearTimeout(this.pauseTimeoutId);
      this.pauseTimeoutId = null;
    }
    this.playChunkRetryCount = 0;
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => {});
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterancesSet.clear();
    this.currentUtterance = null;
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
    if (this.pauseTimeoutId) {
      clearTimeout(this.pauseTimeoutId);
      this.pauseTimeoutId = null;
    }
    this.playChunkRetryCount = 0;
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => {});
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterancesSet.clear();

    const nextIdx = Math.min(this.activeChunkIndex + 1, this.activeChunks.length - 1);
    this.playChunk(nextIdx);
  }

  previousChunk(): void {
    if (this.activeChunks.length === 0) return;
    if (this.pauseTimeoutId) {
      clearTimeout(this.pauseTimeoutId);
      this.pauseTimeoutId = null;
    }
    this.playChunkRetryCount = 0;
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => {});
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterancesSet.clear();

    const prevIdx = Math.max(this.activeChunkIndex - 1, 0);
    this.playChunk(prevIdx);
  }
}

export const offlineTts = new OfflineTtsService();
