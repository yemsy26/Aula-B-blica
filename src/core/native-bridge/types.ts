import { TheologicalRoute, UserTheologicalLevel } from '../shield/types.js';

export interface DeviceSystemInfo {
  platform: 'web' | 'android' | 'tauri' | 'capacitor';
  estimatedRamMb: number;
  isLowEndDevice: boolean; // < 4GB RAM
  batteryLevel?: number;
  isCharging?: boolean;
  cpuCores?: number;
  storageFreeMb?: number;
  storageTotalMb?: number;
  /** COOP/COEP activos: habilita SharedArrayBuffer y el multihilo de wllama. */
  crossOriginIsolated?: boolean;
  sharedArrayBuffer?: boolean;
  /** Hay una API WebGPU disponible; hoy no la usa el runtime GGUF. */
  webGpu?: boolean;
  /**
   * llama.cpp nativo empaquetado en el APK. Cuando existe, el catálogo puede
   * ofrecer modelos más grandes y usar varios hilos reales; cuando no, se
   * mantiene wllama/WASM de un solo hilo.
   */
  nativeInference?: {
    available: boolean;
    abi: string;
    threads: number;
    ramMb: number;
    runtime?: string;
    /** Vulkan detectado por llama.cpp; `usable` excluye rasterizadores de software. */
    gpu?: {
      available: boolean;
      usable: boolean;
      software: boolean;
      name: string;
      /** Nombre real del adaptador; en Vulkan `name` es el dispositivo lógico (Vulkan0). */
      description?: string;
      memoryTotalMb?: number;
    };
    /** NPU Hexagon detectada y cargada por llama.cpp (solo Qualcomm compatible). */
    npu?: {
      available: boolean;
      usable: boolean;
      vendor: string;
      soc: string;
      arch: number;
      name: string;
      memoryTotalMb?: number;
      reason?: string;
    };
    /** Aceleración del último modelo cargado (npu/gpu/cpu). */
    acceleration?: 'npu' | 'gpu' | 'cpu';
    /**
     * Política del plugin: qué acelerador se usará de verdad, cuál se omite
     * por un driver problemático y cuál quedó en cuarentena tras un cierre.
     */
    accelerationPolicy?: {
      mode?: 'auto' | 'cpu' | 'npu' | 'gpu';
      npu?: {
        usable: boolean;
        quarantined: boolean;
        skipped: boolean;
        reason?: string;
        phase?: string;
      };
      gpu?: {
        usable: boolean;
        quarantined: boolean;
        skipped: boolean;
        reason?: string;
        phase?: string;
      };
    };
  };
}

export interface LocalInferenceRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  route: TheologicalRoute;
  level: UserTheologicalLevel;
  stopSequences?: string[];
  groundTruthContext?: string;
}

export interface LocalInferenceStreamChunk {
  token: string;
  isDone: boolean;
  tokensPerSecond?: number;
}

export interface NativeBridge {
  getSystemInfo(): Promise<DeviceSystemInfo>;
  readPrivateFile(filePath: string): Promise<Uint8Array | null>;
  /** Devuelve el archivo como Blob para que un runtime GGUF lo lea sin duplicarlo en JS. */
  readPrivateBlob(filePath: string): Promise<Blob | null>;
  writePrivateFile(filePath: string, data: Uint8Array): Promise<boolean>;
  deletePrivateFile(filePath: string): Promise<boolean>;
  hasPrivateFile(filePath: string): Promise<boolean>;
  getPrivateFileSize(filePath: string): Promise<number | null>;
  /**
   * Ensambla bloques en un archivo final. En navegador/Android usa streaming
   * a OPFS para no mantener cientos de MB en memoria. En Node/pruebas devuelve
   * también los bytes para conservar la semántica anterior.
   */
  assemblePrivateFiles(
    destination: string,
    sources: string[]
  ): Promise<{ size: number; data?: Uint8Array } | null>;
  runLocalInference(
    request: LocalInferenceRequest,
    onToken?: (chunk: LocalInferenceStreamChunk) => void
  ): Promise<string>;
}
