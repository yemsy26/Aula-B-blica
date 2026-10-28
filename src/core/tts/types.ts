export type VoiceTier = 'TIER_1_NEURAL' | 'TIER_2_REGIONAL' | 'TIER_3_STANDARD';

export interface TtsVoiceOption {
  voiceIndex: number;
  /** Identificador estable con el que se selecciona y se recuerda la voz. */
  name: string;
  /** URI que espera el motor TTS del sistema (en Android coincide con el nombre del motor). */
  voiceURI?: string;
  lang: string;
  isDefault: boolean;
  isLocalService: boolean;
  score?: number;
  tier?: VoiceTier;
  tierLabel?: string;
  isNeural?: boolean;
  displayName?: string;
}

export interface TtsState {
  isPlaying: boolean;
  isPaused: boolean;
  rate: number; // 0.8 a 1.5
  pitch: number;
  /** URI de la voz elegida; se valida contra las voces reales del dispositivo. */
  selectedVoiceName?: string;
  currentUtteranceText?: string;
  currentChunkIndex: number;
  totalChunks: number;
  currentChunkKind?: 'title' | 'verse' | 'narrative';
}

export interface TtsController {
  speak(text: string, onEnd?: () => void): void;
  pause(): void;
  resume(): void;
  stop(): void;
  nextChunk(): void;
  previousChunk(): void;
  setRate(rate: number): void;
  setVoice(voiceName: string): void;
  getVoices(): TtsVoiceOption[];
  getState(): TtsState;
  cleanTextForSpeech(text: string): string;
}
