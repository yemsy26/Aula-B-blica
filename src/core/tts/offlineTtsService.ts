import { TtsController, TtsState, TtsVoiceOption } from './types.js';
import { rankVoices, RankedVoiceOption, buildDeviceVoiceOptions } from './voiceRanker.js';
import { cleanPhonetics, ProsodyChunker, ProsodyChunk } from './prosodyChunker.js';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const VOICE_STORAGE_KEY = 'verbovivo_tts_voice_v1';

function readStoredVoice(): string | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem(VOICE_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function persistVoice(voiceId: string | undefined): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (voiceId) localStorage.setItem(VOICE_STORAGE_KEY, voiceId);
    else localStorage.removeItem(VOICE_STORAGE_KEY);
  } catch {
    // Almacenamiento no disponible (modo privado): la selección vive solo en memoria.
  }
}

/**
 * Motor de lectura offline.
 *
 * Usa exclusivamente las voces instaladas en el dispositivo. Antes existía un
 * catálogo de nombres "naturales" que no correspondían a ninguna voz real: al
 * seleccionarlos el motor caía en la voz por defecto y todo sonaba igual. Aquí
 * solo se ofrece lo que `getSupportedVoices()` devuelve de verdad.
 */
export class OfflineTtsService implements TtsController {
  private state: TtsState = {
    isPlaying: false,
    isPaused: false,
    rate: 1.0,
    pitch: 1.0,
    currentChunkIndex: 0,
    totalChunks: 0,
    selectedVoiceName: readStoredVoice(),
  };

  private onStateChangeListeners: ((state: TtsState) => void)[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private activeUtterancesSet = new Set<SpeechSynthesisUtterance>();
  private activeChunks: ProsodyChunk[] = [];
  private activeChunkIndex: number = 0;
  private onPlaybackComplete?: () => void;
  private pauseTimeoutId: any = null;
  private chunkTimeoutId: any = null;
  private nativeLang: string = 'es-ES';
  private nativeVoicesCache: RankedVoiceOption[] = [];
  private nativeInitPromise: Promise<void> | null = null;
  private playChunkRetryCount: number = 0;

  constructor() {
    // Resto de la simulación Piper de versiones anteriores: no descargaba
    // ningún modelo y solo servía para mostrar una opción que no existía.
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('biblia_piper_downloaded');
      }
    } catch {
      // Sin almacenamiento disponible.
    }
    this.initVoices();
  }

  private initVoices(): void {
    if (Capacitor.isNativePlatform()) {
      this.initNativeTts();
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateBestVoice = () => {
        this.ensureSelectedVoice();
        this.notifyState();
      };

      window.speechSynthesis.onvoiceschanged = updateBestVoice;
      updateBestVoice();
    }
  }

  private initNativeTts(retries = 6, delayMs = 400): Promise<void> {
    if (this.nativeInitPromise) return this.nativeInitPromise;

    this.nativeInitPromise = this.loadNativeVoices(retries, delayMs).finally(() => {
      this.nativeInitPromise = null;
    });
    return this.nativeInitPromise;
  }

  private async loadNativeVoices(retries: number, delayMs: number): Promise<void> {
    try {
      const res = await TextToSpeech.getSupportedLanguages();
      if (res && res.languages && res.languages.length > 0) {
        const preferred = res.languages.find(
          (l) => /^es[-_]/i.test(l) || l.toLowerCase() === 'es'
        );
        if (preferred) {
          this.nativeLang = preferred;
        }
      }

      const voiceRes = await TextToSpeech.getSupportedVoices();
      if (voiceRes && voiceRes.voices && voiceRes.voices.length > 0) {
        // Se conservan los índices originales que espera el plugin y se
        // descartan alias y duplicados local/red.
        this.nativeVoicesCache = rankVoices(
          buildDeviceVoiceOptions(voiceRes.voices as any[])
        );

        if (this.nativeVoicesCache.length > 0) {
          this.ensureSelectedVoice();
          this.notifyState();
          return;
        }
      }

      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await this.loadNativeVoices(retries - 1, Math.min(delayMs * 1.5, 2000));
      }
    } catch (e) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await this.loadNativeVoices(retries - 1, Math.min(delayMs * 1.5, 2000));
      } else {
        console.warn('[TTS Nativo] No se pudo inicializar voces nativas:', e);
      }
    }
  }

  /**
   * Mantiene una voz válida: si la guardada ya no existe en el dispositivo,
   * elige la mejor disponible en lugar de dejar el motor en la voz por defecto.
   */
  private ensureSelectedVoice(): void {
    const voices = this.getVoices();
    if (voices.length === 0) return;

    const current = this.state.selectedVoiceName;
    const stillExists =
      !!current &&
      voices.some((v) => v.name === current || v.voiceURI === current);
    if (stillExists) return;

    this.state.selectedVoiceName = voices[0].name;
    persistVoice(this.state.selectedVoiceName);
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
   * Voces en español realmente instaladas, ordenadas por calidad y proximidad.
   */
  getVoices(): RankedVoiceOption[] {
    if (Capacitor.isNativePlatform()) {
      if (this.nativeVoicesCache.length === 0) {
        this.initNativeTts();
      }
      return this.nativeVoicesCache;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const rawVoices = window.speechSynthesis.getVoices();
      const voiceOptions: TtsVoiceOption[] = rawVoices.map((v, idx) => ({
        voiceIndex: idx,
        name: v.name,
        voiceURI: v.voiceURI,
        lang: v.lang,
        isDefault: v.default,
        isLocalService: v.localService,
      }));
      return rankVoices(voiceOptions);
    }

    return [];
  }

  setRate(rate: number): void {
    const nextRate = Math.min(Math.max(rate, 0.7), 1.6);
    const changed = Math.abs(nextRate - this.state.rate) > 0.001;
    this.state.rate = nextRate;
    this.notifyState();

    // Aplicar el cambio al segmento en curso para que se note de inmediato.
    if (changed && this.state.isPlaying && !this.state.isPaused && this.activeChunks.length > 0) {
      this.restartCurrentChunk();
    }
  }

  setVoice(voiceName: string): void {
    if (!voiceName) return;

    const voices = this.getVoices();
    // Ignorar identificadores que no existen en este dispositivo (por ejemplo,
    // nombres del antiguo catálogo ficticio guardados en versiones previas).
    if (voices.length > 0 && !voices.some((v) => v.name === voiceName || v.voiceURI === voiceName)) {
      return;
    }

    const isDifferent = this.state.selectedVoiceName !== voiceName;
    this.state.selectedVoiceName = voiceName;
    persistVoice(voiceName);
    this.notifyState();

    if (isDifferent && this.state.isPlaying && !this.state.isPaused) {
      this.restartCurrentChunk();
    }
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

    if (Capacitor.isNativePlatform() && this.nativeVoicesCache.length === 0) {
      // Esperar a conocer las voces evita arrancar con la voz por defecto.
      this.initNativeTts().finally(() => {
        if (this.state.isPlaying && !this.state.isPaused && this.state.currentChunkIndex === 0) {
          this.playChunk(0);
        }
      });
      return;
    }

    this.playChunk(0);
  }

  private findSelectedVoice(): RankedVoiceOption | undefined {
    const selected = this.state.selectedVoiceName;
    if (!selected) return undefined;

    const voices = this.getVoices();
    return voices.find(
      (v) => v.name === selected || v.voiceURI === selected || String(v.voiceIndex) === selected
    );
  }

  private playChunk(index: number): void {
    if (index >= this.activeChunks.length) {
      this.finishPlayback();
      return;
    }

    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
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

    const selectedVoice = this.findSelectedVoice();
    const targetLang = selectedVoice?.lang || this.nativeLang || 'es-ES';

    this.playChunkWithDeviceEngine(chunk, index, targetLang);
  }

  private playChunkWithDeviceEngine(
    chunk: ProsodyChunk,
    index: number,
    targetLang: string
  ): void {
    // 1. Android/iOS nativo: motor TTS del sistema. El plugin direcciona las
    // voces por índice; la URI solo sirve para identificarlas en la lista.
    if (Capacitor.isNativePlatform()) {
      const selectedVoice = this.findSelectedVoice();
      const targetVoiceIndex = selectedVoice?.voiceIndex ?? -1;
      if (selectedVoice?.lang) targetLang = selectedVoice.lang;

      const rateMultiplier = chunk.kind === 'verse' ? 0.95 : 1.0;
      const rate = Math.min(Math.max(this.state.rate * rateMultiplier, 0.7), 1.4);
      const pitch = 1.0;

      const speakPromise = TextToSpeech.speak({
        text: chunk.text,
        lang: targetLang,
        rate,
        pitch,
        volume: 1.0,
        voice: targetVoiceIndex >= 0 ? targetVoiceIndex : undefined,
        category: 'playback',
      });

      const maxTimeoutMs = Math.max(chunk.text.length * 400, 45000);
      const timeoutPromise = new Promise<void>((_, reject) => {
        this.chunkTimeoutId = setTimeout(() => {
          this.chunkTimeoutId = null;
          reject(new Error('TTS_CHUNK_TIMEOUT'));
        }, maxTimeoutMs);
      });

      Promise.race([speakPromise, timeoutPromise])
        .then(() => {
          if (this.chunkTimeoutId) {
            clearTimeout(this.chunkTimeoutId);
            this.chunkTimeoutId = null;
          }
          this.playChunkRetryCount = 0;
          if (!this.state.isPlaying || this.state.isPaused) return;
          this.pauseTimeoutId = setTimeout(() => {
            if (this.state.isPlaying && !this.state.isPaused) {
              this.playChunk(index + 1);
            }
          }, chunk.pauseAfterMs || 250);
        })
        .catch((err) => {
          if (this.chunkTimeoutId) {
            clearTimeout(this.chunkTimeoutId);
            this.chunkTimeoutId = null;
          }
          console.warn(`[TTS Nativo Android] Error o reconexión en chunk ${index}:`, err);
          if (!this.state.isPlaying || this.state.isPaused) return;
          if (this.activeChunkIndex !== index) return;

          if (this.playChunkRetryCount < 3) {
            this.playChunkRetryCount++;
            this.pauseTimeoutId = setTimeout(() => {
              if (this.state.isPlaying && !this.state.isPaused) {
                this.playChunk(index);
              }
            }, 1400);
            return;
          }
          this.playChunkRetryCount = 0;
          this.pauseTimeoutId = setTimeout(() => {
            if (this.state.isPlaying && !this.state.isPaused) {
              this.playChunk(index + 1);
            }
          }, 400);
        });
      return;
    }

    // 2. Entorno Node/Vitest (sin Web Speech API)
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.pauseTimeoutId = setTimeout(() => {
        this.playChunk(index + 1);
      }, 35);
      return;
    }

    // 3. Navegador Web
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.lang = targetLang || 'es-ES';
    utterance.rate = Math.min(Math.max(chunk.rate * this.state.rate, 0.6), 1.6);
    utterance.pitch = Math.min(Math.max(chunk.pitch * this.state.pitch, 0.7), 1.4);

    const rawVoices = window.speechSynthesis.getVoices();
    const selected = this.state.selectedVoiceName;
    const matchedVoice =
      rawVoices.find((x) => x.name === selected || x.voiceURI === selected) ||
      (this.getVoices()[0]
        ? rawVoices.find((x) => x.name === this.getVoices()[0].name)
        : undefined);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang || utterance.lang;
    }

    this.activeUtterancesSet.add(utterance);

    utterance.onend = () => {
      this.activeUtterancesSet.delete(utterance);
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

  private restartCurrentChunk(): void {
    if (this.activeChunks.length === 0) return;
    const index = this.activeChunkIndex;

    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
    if (this.pauseTimeoutId) {
      clearTimeout(this.pauseTimeoutId);
      this.pauseTimeoutId = null;
    }
    this.playChunkRetryCount = 0;

    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop()
        .catch(() => {})
        .finally(() => {
          if (this.state.isPlaying && !this.state.isPaused) {
            this.playChunk(index);
          }
        });
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (this.state.isPlaying && !this.state.isPaused) {
        this.playChunk(index);
      }
    }
  }

  private finishPlayback(): void {
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
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
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
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
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
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

    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentUtteranceText = undefined;
    this.activeChunks = [];
    this.activeChunkIndex = 0;
    this.notifyState();
  }

  nextChunk(): void {
    if (this.activeChunks.length === 0) return;
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
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
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
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
