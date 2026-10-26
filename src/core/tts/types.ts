export type VoiceTier = 'TIER_1_NEURAL' | 'TIER_2_REGIONAL' | 'TIER_3_STANDARD';

export interface TtsVoiceOption {
  voiceIndex: number;
  name: string;
  lang: string;
  isDefault: boolean;
  isLocalService: boolean;
  score?: number;
  tier?: VoiceTier;
  tierLabel?: string;
  isNeural?: boolean;
  displayName?: string;
}

export type TtsEngineMode = 'SYSTEM_NEURAL' | 'PIPER_HD_OFFLINE';

export interface TtsState {
  isPlaying: boolean;
  isPaused: boolean;
  rate: number; // 0.8 a 1.5
  pitch: number;
  selectedVoiceName?: string;
  currentUtteranceText?: string;
  currentChunkIndex: number;
  totalChunks: number;
  currentChunkKind?: 'title' | 'verse' | 'narrative';
  activeEngineMode: TtsEngineMode;
  activePiperModelId?: string;
  piperDownloadProgress?: number;
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
  setEngineMode(mode: TtsEngineMode): void;
  getVoices(): TtsVoiceOption[];
  getState(): TtsState;
  cleanTextForSpeech(text: string): string;
}
