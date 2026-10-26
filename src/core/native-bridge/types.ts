export interface DeviceSystemInfo {
  platform: 'web' | 'android' | 'tauri' | 'capacitor';
  estimatedRamMb: number;
  isLowEndDevice: boolean; // < 4GB RAM
  batteryLevel?: number;
  isCharging?: boolean;
}

export interface LocalInferenceRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  route: string;
  level: string;
  stopSequences?: string[];
}

export interface LocalInferenceStreamChunk {
  token: string;
  isDone: boolean;
  tokensPerSecond?: number;
}

export interface NativeBridge {
  getSystemInfo(): Promise<DeviceSystemInfo>;
  readPrivateFile(filePath: string): Promise<Uint8Array | null>;
  writePrivateFile(filePath: string, data: Uint8Array): Promise<boolean>;
  deletePrivateFile(filePath: string): Promise<boolean>;
  runLocalInference(
    request: LocalInferenceRequest,
    onToken?: (chunk: LocalInferenceStreamChunk) => void
  ): Promise<string>;
}
