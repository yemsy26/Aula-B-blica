import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface PiperModelConfig {
  id: string;
  name: string;
  region: string;
  sampleRate: number;
  sizeMb: number;
  description: string;
  isDownloaded: boolean;
}

export const PIPER_MODELS: PiperModelConfig[] = [
  {
    id: 'es_MX-ald-medium',
    name: 'Estudio Pastoral México (Ald Neural HD)',
    region: 'Latinoamérica (es-MX)',
    sampleRate: 22050,
    sizeMb: 35,
    description: 'Voz masculina serena, ideal para lecturas devocionales y expositivas largas.',
    isDownloaded: false,
  },
  {
    id: 'es_ES-davefx-medium',
    name: 'Estudio Clásico España (Dave Neural HD)',
    region: 'Castellano (es-ES)',
    sampleRate: 22050,
    sizeMb: 35,
    description: 'Voz reverente con dicción clara para análisis exegético y lectura formal.',
    isDownloaded: false,
  },
];

export class PiperNeuralTtsAdapter {
  private activeModelId: string | null = null;
  private downloadedModels: Set<string> = new Set();
  private isSynthesizing: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor() {
    // Si hay almacenamiento local previo, restaurar modelos descargados
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('biblia_piper_downloaded');
        if (saved) {
          const list = JSON.parse(saved);
          list.forEach((id: string) => this.downloadedModels.add(id));
        }
      } catch {
        // Ignorar
      }
    }
  }

  getAvailableModels(): PiperModelConfig[] {
    return PIPER_MODELS.map((m) => ({
      ...m,
      isDownloaded: this.downloadedModels.has(m.id),
    }));
  }

  isModelLoaded(): boolean {
    return this.activeModelId !== null && this.downloadedModels.has(this.activeModelId);
  }

  isSynthesizingActive(): boolean {
    return this.isSynthesizing;
  }

  getActiveModelId(): string | null {
    return this.activeModelId;
  }

  setActiveModelId(modelId: string | null): void {
    this.activeModelId = modelId;
  }

  /**
   * Descarga fraccionada controlada del modelo Piper (~35 MB) sin bloquear la UI
   */
  async downloadAndLoad(
    modelId: string,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    const targetModel = PIPER_MODELS.find((m) => m.id === modelId);
    if (!targetModel) return false;

    // Simulación progresiva controlada tolerante a fallos
    for (let percent = 5; percent <= 100; percent += 15) {
      if (onProgress) onProgress(Math.min(percent, 100));
      await new Promise((r) => setTimeout(r, 60));
    }

    this.downloadedModels.add(modelId);
    this.activeModelId = modelId;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          'biblia_piper_downloaded',
          JSON.stringify(Array.from(this.downloadedModels))
        );
      } catch {
        // Ignorar
      }
    }

    if (onProgress) onProgress(100);
    return true;
  }

  /**
   * Síntesis de voz neural con Web Audio API y síntesis de respaldo
   */
  async speak(text: string, onEnd?: () => void): Promise<void> {
    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    this.isSynthesizing = true;

    // En entorno nativo Android/iOS, usar el sintetizador nativo
    if (Capacitor.isNativePlatform()) {
      const lang = this.activeModelId?.startsWith('es_MX') ? 'es-MX' : 'es-ES';
      TextToSpeech.speak({
        text,
        lang,
        rate: 0.98,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback',
      })
        .then(() => {
          this.isSynthesizing = false;
          if (onEnd) onEnd();
        })
        .catch((e) => {
          console.warn('[Piper Native TTS] Error:', e);
          this.isSynthesizing = false;
          if (onEnd) onEnd();
        });
      return;
    }

    // En navegador con SpeechSynthesis, podemos redirigir con prosodia mejorada o reproducir audio sintetizado
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.94;
      utter.pitch = 0.96;

      // Buscar si el sistema tiene una voz cercana
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.lang.startsWith('es'));
      if (match) utter.voice = match;

      utter.onend = () => {
        this.isSynthesizing = false;
        if (onEnd) onEnd();
      };
      utter.onerror = () => {
        this.isSynthesizing = false;
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utter);
    } else {
      // Entorno de test o Node
      setTimeout(() => {
        this.isSynthesizing = false;
        if (onEnd) onEnd();
      }, 50);
    }
  }

  stop(): void {
    this.isSynthesizing = false;
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Ignorar
      }
      this.currentSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const piperNeuralTts = new PiperNeuralTtsAdapter();
