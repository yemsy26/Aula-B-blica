import { DeviceSystemInfo } from '../native-bridge/types.js';
import { ModelManifest, ModelProfileId } from './types.js';

export const CHUNK_SIZE_MB = 50;

/**
 * Catálogo de archivos GGUF que la app puede ejecutar localmente.
 *
 * Los identificadores de perfil (ULTRALIGHT, STANDARD, ADVANCED_4B, MAX_8B)
 * se conservan por compatibilidad con datos ya guardados, pero los nombres,
 * tamaños y URLs describen el archivo real que se descarga.
 *
 * `sha256` queda vacío a propósito: no publicamos hashes que no hayamos
 * verificado contra el archivo real. El descargador informa si pudo verificar
 * integridad o si solo completó y ensambló el archivo.
 *
 * Runtime: wllama (WASM) en PC y en el WebView de Android; llama.cpp nativo
 * con Vulkan en el APK. La GPU acelera el cálculo cuando el backend la acepta,
 * pero no amplía la RAM: los mínimos de memoria siguen mandando.
 */
export const AVAILABLE_MODELS: Record<ModelProfileId, ModelManifest> = {
  ULTRALIGHT: {
    id: 'ULTRALIGHT',
    nombre: 'VerboVivo Micro Edge (0.5B Q4_K_M)',
    descripcion:
      'Modelo para Android de gama de entrada (2GB - 3GB RAM). Se ejecuta dentro de la app con wllama/WASM, sin servidor. Respuestas más breves y lentas que un modelo mayor.',
    tamanoMb: 469,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '0.5B',
    contextoMaxTokens: 1024,
    ramMinimaRequeridaMb: 2048,
    totalChunks: Math.ceil(469 / CHUNK_SIZE_MB), // 10 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '',
    archivoDestino: 'verbovivo_0.5b_q4km.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    gamaRecomendada: 'Gama Entrada (2GB - 3GB RAM)',
    esMaximoNivel: false,
  },
  STANDARD: {
    id: 'STANDARD',
    nombre: 'VerboVivo Standard Edge (1.5B Q4_K_M)',
    descripcion:
      'Equilibrio entre velocidad y fidelidad para PC y móviles con 4GB de RAM o más. Se ejecuta dentro de la app con wllama/WASM.',
    tamanoMb: 1066,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '1.5B',
    contextoMaxTokens: 2048,
    ramMinimaRequeridaMb: 4096,
    totalChunks: Math.ceil(1066 / CHUNK_SIZE_MB), // 22 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '',
    archivoDestino: 'verbovivo_1.5b_q4km.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    gamaRecomendada: 'Gama Media (4GB RAM)',
    esMaximoNivel: false,
  },
  ADVANCED_4B: {
    id: 'ADVANCED_4B',
    nombre: 'VerboVivo Exégesis Pro (3B Q4_K_M)',
    descripcion:
      'Modelo para PC con 8GB de RAM o más. El identificador de perfil conserva el nombre histórico, pero el archivo descargado es Qwen2.5 3B Q4_K_M. Se ejecuta dentro de la app con wllama/WASM.',
    tamanoMb: 2008,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '3B',
    contextoMaxTokens: 4096,
    ramMinimaRequeridaMb: 6144,
    totalChunks: Math.ceil(2008 / CHUNK_SIZE_MB), // 41 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '',
    archivoDestino: 'verbovivo_3.0b_q4km.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    gamaRecomendada: 'Gama Media-Alta (6GB RAM)',
    esMaximoNivel: false,
  },
  MAX_8B: {
    id: 'MAX_8B',
    nombre: 'VerboVivo Sovereign Master (7B Q4_K_M)',
    descripcion:
      'Modelo para PC potente (16GB de RAM recomendados). El identificador de perfil conserva el nombre histórico, pero el archivo descargado es Qwen2.5 7B Q4_K_M. No es práctico en un teléfono; se ejecuta con wllama/WASM.',
    tamanoMb: 4467,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '7B',
    contextoMaxTokens: 8192,
    ramMinimaRequeridaMb: 8192,
    totalChunks: Math.ceil(4467 / CHUNK_SIZE_MB), // 90 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '',
    archivoDestino: 'verbovivo_7.0b_q4km.gguf',
    // El repositorio oficial de Qwen publica el 7B Q4_K_M dividido en dos
    // archivos; wllama carga un solo GGUF, así que usamos una conversión
    // single-file verificable del mismo modelo y cuantización.
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    gamaRecomendada: 'Gama Alta / Flagship (8GB+ RAM)',
    esMaximoNivel: true,
  },
  /**
   * Variante de 0.5B en Q4_0. Es la única combinación que el driver Vulkan del
   * Adreno 750 ejecutó con resultados correctos en pruebas: los K-quant no
   * compilan y el 1.5B Q4_0 se corrompe. Se ofrece solo en teléfonos con ese
   * driver (o si ya está descargado) para no llenar el catálogo de opciones
   * que en otros equipos no aportan nada frente al 0.5B Q4_K_M.
   */
  ULTRALIGHT_GPU: {
    id: 'ULTRALIGHT_GPU',
    nombre: 'VerboVivo Micro GPU (0.5B Q4_0)',
    descripcion:
      'Perfil rápido: Qwen2.5 0.5B Q4_0 con todas las capas en Vulkan. Verificado en Adreno 750 con texto coherente y unas 2,4× más velocidad de generación que la CPU. Su contexto es de 2048 tokens y su calidad es de gama de entrada: sirve para consultas breves y devocionales, no para exégesis o informes largos (para eso usa 1.5B o 3B en CPU).',
    tamanoMb: 429,
    cuantizacion: 'Q4_0',
    tamanoParametros: '0.5B',
    contextoMaxTokens: 2048,
    ramMinimaRequeridaMb: 2048,
    totalChunks: Math.ceil(429 / CHUNK_SIZE_MB), // 9 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '',
    archivoDestino: 'verbovivo_0.5b_q4_0.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_0.gguf',
    gamaRecomendada: 'Adreno 750 con Vulkan (modo rápido)',
    esMaximoNivel: false,
  },
};

/** Orden estable del catálogo: de menor a mayor exigencia. */
export const MODEL_ORDER: ModelProfileId[] = [
  'ULTRALIGHT',
  'STANDARD',
  'ADVANCED_4B',
  'MAX_8B',
  'ULTRALIGHT_GPU',
];

/**
 * Nombre del dispositivo que verifica la aceleración Vulkan con Q4_0. La
 * comprobación es deliberadamente estricta: solo se promete aceleración donde
 * se midió, no en cualquier Adreno.
 */
const GPU_PROFILE_DEVICE = 'adreno (tm) 750';

export function isGpuProfileSupported(sysInfo: DeviceSystemInfo): boolean {
  const runtime = resolveInferenceRuntime(sysInfo);
  if (!runtime.isMobile || !runtime.native) return false;
  const gpu = runtime.gpu;
  if (!gpu || !gpu.usable || gpu.software) return false;
  // En Vulkan, `name` es el dispositivo lógico («Vulkan0») y el adaptador real
  // viene en `description` («Adreno (TM) 750»). Se revisan ambos para no negar
  // la aceleración en el teléfono donde sí se verificó.
  const adapter = `${gpu.name} ${gpu.description ?? ''}`.toLowerCase();
  return adapter.includes(GPU_PROFILE_DEVICE);
}

export type DeviceTierName =
  | 'Gama Entrada'
  | 'Gama Media'
  | 'Gama Media-Alta'
  | 'Gama Alta / Flagship';

export type DeviceModelStorageStatus = 'unknown' | 'ok' | 'tight' | 'insufficient';

export interface InferenceRuntimeProfile {
  platform: DeviceSystemInfo['platform'];
  isMobile: boolean;
  /** llama.cpp nativo empaquetado: no depende del WebView ni de WASM. */
  native: boolean;
  nativeAbi?: string;
  /** GPU Vulkan detectada por llama.cpp (solo nativo Android). */
  gpu?: NonNullable<DeviceSystemInfo['nativeInference']>['gpu'];
  /** NPU Hexagon detectada por llama.cpp (solo Snapdragon compatible). */
  npu?: NonNullable<DeviceSystemInfo['nativeInference']>['npu'];
  /** Aceleración del último modelo cargado. */
  acceleration?: 'npu' | 'gpu' | 'cpu';
  /** Política automática: omisiones por driver y cuarentenas por cierre. */
  accelerationPolicy?: NonNullable<DeviceSystemInfo['nativeInference']>['accelerationPolicy'];
  /** COOP/COEP permiten SharedArrayBuffer y por tanto el multihilo de wllama. */
  isolated: boolean;
  /** Multihilo real disponible (nativo o aislamiento + SharedArrayBuffer). */
  multithread: boolean;
  threads: number;
  ramMb: number;
  cpuCores: number;
  tierName: DeviceTierName;
  /** El navegador puede topar `navigator.deviceMemory` en 8 GB; si informa justo 8, quizá haya más RAM real. */
  ramMayBeHigher: boolean;
}

export interface DeviceModelEntry {
  manifest: ModelManifest;
  id: ModelProfileId;
  installed: boolean;
  usable: boolean;
  recommended: boolean;
  /** Motivo por el que no debe ofrecerse en este equipo. */
  blocker?: string;
  /** Advertencia no bloqueante (RAM al límite, espacio justo). */
  warning?: string;
  storageStatus: DeviceModelStorageStatus;
}

export interface DeviceModelCatalog {
  runtime: InferenceRuntimeProfile;
  /** Los cuatro perfiles, con estado y motivo, para auditoría y pruebas. */
  entries: DeviceModelEntry[];
  /** Perfiles que este equipo puede ejecutar de verdad. */
  usableEntries: DeviceModelEntry[];
  /** Lo que la UI puede mostrar: viables o ya descargados (aunque no sean viables). */
  visibleEntries: DeviceModelEntry[];
  /** Perfiles ocultos por inviables y no descargados. */
  hiddenEntries: DeviceModelEntry[];
  recommended: ModelManifest;
  /** Frase breve que explica por qué faltan tamaños en el catálogo. */
  hiddenSummary?: string;
  statusMessage: string;
}

function readCrossOriginIsolated(sysInfo: DeviceSystemInfo): boolean {
  if (typeof sysInfo.crossOriginIsolated === 'boolean') {
    return sysInfo.crossOriginIsolated;
  }
  return (
    typeof globalThis !== 'undefined' &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true
  );
}

function readSharedArrayBuffer(sysInfo: DeviceSystemInfo): boolean {
  if (typeof sysInfo.sharedArrayBuffer === 'boolean') {
    return sysInfo.sharedArrayBuffer;
  }
  return typeof SharedArrayBuffer !== 'undefined';
}

function resolveTier(ramMb: number): DeviceTierName {
  if (ramMb >= 7500) return 'Gama Alta / Flagship';
  if (ramMb >= 5500) return 'Gama Media-Alta';
  if (ramMb >= 3500) return 'Gama Media';
  return 'Gama Entrada';
}

/**
 * Resume el runtime real que tendrá el motor GGUF. Android (WebView) carece
 * de aislamiento y SharedArrayBuffer; en PC depende de COOP/COEP.
 */
export function resolveInferenceRuntime(sysInfo: DeviceSystemInfo): InferenceRuntimeProfile {
  const platform = sysInfo.platform;
  const isMobile = platform === 'android' || platform === 'capacitor';
  const native = sysInfo.nativeInference?.available === true;
  const isolated = readCrossOriginIsolated(sysInfo);
  const hasSharedMemory = readSharedArrayBuffer(sysInfo);
  const multithread = native || (isolated && hasSharedMemory);
  const cpuCores =
    typeof sysInfo.cpuCores === 'number' && sysInfo.cpuCores > 0 ? sysInfo.cpuCores : 4;
  // En nativo el plugin ya recomienda hilos según los núcleos reales. En WASM
  // un núcleo queda para la interfaz, el WebView y la síntesis de voz.
  const nativeThreads = sysInfo.nativeInference?.threads ?? 0;
  const threads = native
    ? Math.max(1, Math.min(8, nativeThreads > 0 ? nativeThreads : cpuCores - 1))
    : multithread
      ? Math.max(1, Math.min(isMobile ? 4 : 8, cpuCores - 1))
      : 1;

  return {
    platform,
    isMobile,
    native,
    nativeAbi: sysInfo.nativeInference?.abi,
    gpu: sysInfo.nativeInference?.gpu,
    npu: sysInfo.nativeInference?.npu,
    acceleration: sysInfo.nativeInference?.acceleration,
    accelerationPolicy: sysInfo.nativeInference?.accelerationPolicy,
    isolated,
    multithread,
    threads,
    ramMb: sysInfo.estimatedRamMb,
    cpuCores,
    tierName: resolveTier(sysInfo.estimatedRamMb),
    // `navigator.deviceMemory` puede estar topado en 8 GB según la versión y
    // la plataforma. Solo advertimos cuando el valor es exactamente 8; si el
    // navegador informa 16 o 32 GB, no hay motivo para dudar del dato.
    ramMayBeHigher: platform === 'web' && sysInfo.estimatedRamMb === 8192,
  };
}

function preferredProfile(runtime: InferenceRuntimeProfile): ModelProfileId {
  if (runtime.isMobile) {
    if (runtime.native) {
      // El estándar en un teléfono es 1.5B, no el tamaño que quepa. 3B y 7B
      // son viables en equipos de 8-16 GB, pero el primer token tarda varios
      // segundos, consumen más batería y compiten con Android por memoria; se
      // quedan como elección explícita en el gestor, nunca como recomendación.
      // 0.5B solo cuando 1.5B no cabe: mide respuestas breves y puede inventar
      // referencias, así que no sirve como estándar.
      return runtime.ramMb >= 4096 ? 'STANDARD' : 'ULTRALIGHT';
    }

    // Sin motor nativo, el WebView de un solo hilo solo sostiene 0.5B con
    // honestidad (o 1.5B si ya hay multihilo experimental).
    return runtime.multithread && runtime.ramMb >= 6144 ? 'STANDARD' : 'ULTRALIGHT';
  }

  if (!runtime.multithread) {
    // Sin SharedArrayBuffer, 3B y 7B tardan demasiado para una conversación.
    return runtime.ramMb >= 4096 ? 'STANDARD' : 'ULTRALIGHT';
  }

  if (runtime.ramMb >= 12288) return 'MAX_8B';
  if (runtime.ramMb >= 6144) return 'ADVANCED_4B';
  if (runtime.ramMb >= 4096) return 'STANDARD';
  return 'ULTRALIGHT';
}

const MOBILE_THREAD_BLOCKER =
  'Esta instalación no incluye el motor nativo y el WebView no permite SharedArrayBuffer: ' +
  'wllama ejecuta el modelo en un solo hilo. 1.5B tarda varios minutos por respuesta y 3B/7B ' +
  'no son prácticos. Instala el APK con llama.cpp nativo o conecta Ollama en tu PC por Wi-Fi.';

/**
 * Mínimos de RAM del motor nativo en Android. Son deliberadamente
 * conservadores: el sistema operativo, el WebView y la app también necesitan
 * memoria, y Android puede matar el proceso si el GGUF + KV cache no dejan
 * margen.
 */
const NATIVE_MOBILE_MIN_RAM_MB: Record<ModelProfileId, number> = {
  ULTRALIGHT: 2048,
  STANDARD: 4096,
  ADVANCED_4B: 6144,
  MAX_8B: 12288,
  ULTRALIGHT_GPU: 2048,
};

/**
 * Construye el catálogo que la UI debe mostrar. No basta con mirar la RAM:
 * en Android el límite real es el WebView de un solo hilo, y en la web el
 * aislamiento COOP/COEP. Los perfiles inviables se ocultan, salvo que ya
 * estén descargados (para que el usuario sepa qué ocupa espacio).
 */
export function buildDeviceCatalog(
  sysInfo: DeviceSystemInfo,
  installedModels: readonly ModelProfileId[] = []
): DeviceModelCatalog {
  const runtime = resolveInferenceRuntime(sysInfo);
  const installed = new Set(installedModels);
  const gpuProfileSupported = isGpuProfileSupported(sysInfo);
  // El perfil Q4_0 solo se muestra donde se verificó la aceleración o donde ya
  // está descargado. En el resto sería un duplicado peor del 0.5B Q4_K_M.
  const catalogIds = MODEL_ORDER.filter(
    (id) => id !== 'ULTRALIGHT_GPU' || gpuProfileSupported || installed.has(id)
  );

  const entries: DeviceModelEntry[] = catalogIds.map((id) => {
    const manifest = AVAILABLE_MODELS[id];
    const isInstalled = installed.has(id);
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (id === 'ULTRALIGHT_GPU') {
      if (gpuProfileSupported) {
        warnings.push(
          'Modo rápido verificado: Vulkan con Q4_0, unas 2,4× sobre CPU. Contexto de 2048 tokens y calidad de gama de entrada; para exégesis o informes largos usa 1.5B o 3B en CPU.'
        );
        if (runtime.accelerationPolicy?.gpu?.quarantined) {
          warnings.push(
            `La GPU está en cuarentena (${runtime.accelerationPolicy.gpu.reason || 'cerró la app antes'}): este perfil se ejecutará en CPU hasta restablecerla.`
          );
        }
      } else {
        warnings.push(
          'Este perfil solo acelera con Vulkan en Adreno 750; en este equipo se ejecutará en CPU como un 0.5B Q4_0.'
        );
      }
    }

    if (runtime.isMobile) {
      if (runtime.native) {
        const minimum = NATIVE_MOBILE_MIN_RAM_MB[id];
        if (runtime.ramMb < minimum) {
          blockers.push(
            `Con el motor nativo, ${manifest.tamanoParametros} exige al menos ${(minimum / 1024).toFixed(0)} GB de RAM; este teléfono reporta ${(runtime.ramMb / 1024).toFixed(1)} GB.`
          );
        } else if (id === 'MAX_8B') {
          warnings.push(
            'No es un cerebro de teléfono: 4,4 GB de archivo y un primer token mucho más lento que en 1.5B. ' +
              'Queda como experimento opcional; el estándar es 1.5B.'
          );
          if (runtime.ramMb < 16384) {
            warnings.push(
              'Con menos de 16 GB deja poco margen a Android: cierra otras apps y mantén el cargador conectado.'
            );
          }
        } else if (id === 'ADVANCED_4B') {
          warnings.push(
            runtime.ramMb < 8192
              ? '3B está en el límite de RAM; cierra otras apps antes de cargarlo. El primer token tarda más que en 1.5B.'
              : 'Mejor calidad que 1.5B, pero más lento y con más consumo. Es una opción, no el estándar: en un teléfono se recomienda 1.5B.'
          );
        } else if (id === 'STANDARD') {
          if (runtime.ramMb < 6144) {
            warnings.push(
              '1.5B cabe, pero compite por memoria con Android. Si la app se reinicia al cargar, usa 0.5B.'
            );
          }
        } else if (id === 'ULTRALIGHT') {
          warnings.push(
            'Último recurso para teléfonos de 2-3 GB: da respuestas breves y puede inventar referencias. ' +
              'Si el equipo sostiene 1.5B, úsalo; para citas exactas está el motor verificado, que no necesita modelo.'
          );
        }
      } else if (id === 'ULTRALIGHT') {
        if (manifest.ramMinimaRequeridaMb > runtime.ramMb) {
          blockers.push(
            `Requiere ${(manifest.ramMinimaRequeridaMb / 1024).toFixed(0)} GB de RAM y este teléfono reporta ${(runtime.ramMb / 1024).toFixed(1)} GB.`
          );
        }
      } else if (runtime.multithread && id === 'STANDARD' && runtime.ramMb >= 6144) {
        warnings.push(
          'Multihilo disponible, pero 1.5B sigue siendo lento en un teléfono y consume más batería.'
        );
      } else if (runtime.multithread) {
        blockers.push(
          id === 'STANDARD'
            ? `1.5B en un teléfono exige al menos 6 GB de RAM; este equipo reporta ${(runtime.ramMb / 1024).toFixed(1)} GB.`
            : 'En un teléfono solo se ofrece hasta 1.5B; 3B y 7B agotan la memoria y la batería.'
        );
      } else {
        blockers.push(MOBILE_THREAD_BLOCKER);
      }
    } else {
      if (manifest.ramMinimaRequeridaMb > runtime.ramMb) {
        blockers.push(
          `Requiere ${(manifest.ramMinimaRequeridaMb / 1024).toFixed(0)} GB de RAM y el navegador reporta ${(runtime.ramMb / 1024).toFixed(1)} GB.`
        );
      }

      if (!runtime.multithread && (id === 'ADVANCED_4B' || id === 'MAX_8B')) {
        blockers.push(
          'Sin aislamiento COOP/COEP, wllama usa un solo hilo y este tamaño queda impracticable. ' +
            'Sirve la app con las cabeceras o conecta Ollama.'
        );
      }

      if (id === 'MAX_8B' && runtime.ramMb >= manifest.ramMinimaRequeridaMb) {
        if (runtime.ramMayBeHigher) {
          warnings.push(
            'El navegador informa justo 8 GB, que puede ser un tope de medición. En un equipo de 8 GB reales puede fallar por memoria; ciérralo todo antes de cargarlo.'
          );
        } else if (runtime.ramMb <= 8192) {
          warnings.push('Exige 8 GB o más y consume mucha memoria; en un equipo justo puede fallar.');
        }
      }

      if (id === 'ADVANCED_4B' && runtime.multithread && runtime.ramMb <= 6144) {
        warnings.push('Está en el límite de RAM: cierra otras pestañas antes de cargarlo.');
      }
    }

    let storageStatus: DeviceModelStorageStatus = 'unknown';
    if (isInstalled) {
      storageStatus = 'ok';
    } else if (typeof sysInfo.storageFreeMb === 'number') {
      if (sysInfo.storageFreeMb < manifest.tamanoMb) {
        storageStatus = 'insufficient';
        blockers.push(
          `Espacio libre insuficiente: necesita ${manifest.tamanoMb} MB y hay ${Math.round(sysInfo.storageFreeMb)} MB.`
        );
      } else if (sysInfo.storageFreeMb < manifest.tamanoMb * 2) {
        storageStatus = 'tight';
        warnings.push(
          `Quedarían menos de ${manifest.tamanoMb} MB libres; conviene liberar espacio antes de descargar.`
        );
      } else {
        storageStatus = 'ok';
      }
    }

    return {
      manifest,
      id,
      installed: isInstalled,
      usable: blockers.length === 0,
      recommended: false,
      blocker: blockers.length > 0 ? blockers.join(' ') : undefined,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined,
      storageStatus,
    };
  });

  const usableEntries = entries.filter((entry) => entry.usable);
  const preferred = preferredProfile(runtime);
  const preferredIndex = MODEL_ORDER.indexOf(preferred);

  // Si el tamaño preferido no cabe (espacio/RAM), bajamos al mayor viable que
  // no supere esa preferencia; si no hay ninguno, usamos el primero.
  const recommendedEntry =
    entries.find((entry) => entry.id === preferred && entry.usable) ??
    [...entries]
      .reverse()
      .find((entry) => entry.usable && MODEL_ORDER.indexOf(entry.id) <= preferredIndex) ??
    usableEntries[0] ??
    entries[0];

  recommendedEntry.recommended = true;
  const recommended = recommendedEntry.manifest;

  const visibleEntries = entries.filter((entry) => entry.usable || entry.installed);
  // Caso extremo (sin RAM/espacio ni siquiera para 0.5B): mostramos 0.5B con
  // su motivo para que el usuario sepa qué liberar, en vez de una lista vacía.
  if (visibleEntries.length === 0) visibleEntries.push(entries[0]);

  const hiddenEntries = entries.filter(
    (entry) => !entry.usable && !entry.installed && !visibleEntries.includes(entry)
  );

  let hiddenSummary: string | undefined;
  if (hiddenEntries.length > 0) {
    const names = hiddenEntries.map((entry) => entry.manifest.tamanoParametros).join(', ');
    if (runtime.isMobile) {
      if (runtime.native) {
        hiddenSummary = `No se ofrecen ${names} en este teléfono: con ${(runtime.ramMb / 1024).toFixed(1)} GB de RAM no hay margen para el modelo, el contexto y Android a la vez. Para modelos mayores, conecta Ollama en tu PC.`;
      } else {
        hiddenSummary = runtime.multithread
          ? `No se ofrecen ${names} en este teléfono: el hardware no los sostiene con holgura. Para modelos mayores, conecta Ollama en tu PC.`
          : `No se ofrecen ${names} en este teléfono: esta instalación no incluye llama.cpp nativo y el WebView ejecuta wllama en un solo hilo. Para modelos mayores, instala el APK nativo o conecta Ollama en tu PC por Wi-Fi.`;
      }
    } else if (!runtime.multithread) {
      hiddenSummary =
        `No se ofrecen ${names}: este servidor no envía las cabeceras COOP/COEP y wllama corre en un solo hilo. ` +
        'Usa `npm run dev`/`npm run preview` con aislamiento o conecta Ollama.';
    } else {
      hiddenSummary = `No se ofrecen ${names}: el navegador reporta ${(runtime.ramMb / 1024).toFixed(1)} GB de RAM o falta espacio. Para modelos mayores usa Ollama.`;
    }
  }

  let statusMessage: string;
  const ramLabel = `${(runtime.ramMb / 1024).toFixed(1)} GB`;
  if (runtime.isMobile) {
    if (runtime.native) {
      const npu = runtime.npu;
      const gpu = runtime.gpu;
      const policy = runtime.accelerationPolicy;
      const npuUsable = npu?.usable === true && policy?.npu?.usable !== false;
      const gpuUsable = gpu?.usable === true && policy?.gpu?.usable !== false;
      const npuBlocked = policy?.npu?.quarantined === true;
      const gpuBlocked = policy?.gpu?.quarantined === true;
      const gpuSkipped = policy?.gpu?.skipped === true;

      const acceleration = npuUsable
        ? `NPU Hexagon (${npu?.name || 'HTP'})`
        : gpuUsable
          ? `GPU Vulkan (${gpu?.name || 'detectada'})`
          : gpu?.software
            ? 'CPU (Vulkan de software, sin aceleración real)'
            : 'CPU (sin acelerador utilizable)';

      let accelNote: string;
      if (npuUsable) {
        accelNote =
          ' La NPU Hexagon acelera el cálculo, pero no amplía la RAM: los mínimos de memoria siguen mandando.';
      } else if (npuBlocked) {
        accelNote = ` La NPU Hexagon está en cuarentena tras un cierre (${policy?.npu?.reason || 'sin detalle'}); se usará ${gpuUsable ? 'Vulkan' : 'CPU'}. Puedes restablecerla desde este gestor.`;
      } else if (npu && !npu.usable) {
        accelNote = ` La NPU Hexagon no se puede usar aquí (${npu.reason || 'sin sesión Hexagon'}); se usará ${gpuUsable ? 'Vulkan' : 'CPU'}.`;
      } else if (gpuUsable) {
        accelNote = ' La GPU acelera el cálculo, pero no aumenta la RAM disponible.';
      } else if (gpuBlocked) {
        accelNote = ` La GPU Vulkan está en cuarentena tras un cierre (${policy?.gpu?.reason || 'sin detalle'}); todo el cálculo va a CPU. Puedes restablecerla desde este gestor.`;
      } else if (gpuSkipped) {
        accelNote = ` ${policy?.gpu?.reason || 'Vulkan se omite en este driver; todo el cálculo va a CPU.'}`;
      } else if (gpu?.software) {
        accelNote =
          ' Vulkan solo está disponible como rasterizador de software, así que no se usa para acelerar.';
      } else {
        accelNote = ' Sin GPU ni NPU utilizables, todo el cálculo va a CPU.';
      }
      statusMessage = `Tu teléfono reporta ${ramLabel} y el motor nativo (${runtime.nativeAbi ?? 'ABI local'}) puede usar ${runtime.threads} hilo(s) con ${acceleration}. El cerebro estándar es ${recommended.tamanoParametros}${recommended.id === 'STANDARD' ? '; 3B y 7B quedan como opción manual' : ''}. Solo se muestran los tamaños que caben con margen.${accelNote}`;
    } else {
      statusMessage = runtime.multithread
        ? `Tu teléfono reporta ${ramLabel} y el WebView permite ${runtime.threads} hilo(s). El cerebro óptimo es ${recommended.tamanoParametros}; 3B y 7B no se ofrecen en un teléfono.`
        : `Tu teléfono reporta ${ramLabel}, pero esta instalación no incluye llama.cpp nativo y el WebView ejecuta wllama en un solo hilo. El cerebro óptimo es ${recommended.tamanoParametros}; 1.5B, 3B y 7B no se ofrecen porque no serían usables. Para respuestas rápidas, instala el APK nativo o conecta Ollama en tu PC por Wi-Fi.`;
    }
  } else if (!runtime.multithread) {
    statusMessage =
      `Tu equipo reporta ${ramLabel}. Este servidor no envía COOP/COEP, así que wllama usa un solo hilo: ` +
      `se ofrece hasta ${recommended.tamanoParametros}. Para 3B/7B sirve la app con aislamiento o conecta Ollama.`;
  } else {
    statusMessage = `Tu equipo reporta ${ramLabel} y wllama puede usar ${runtime.threads} hilo(s). El cerebro óptimo es ${recommended.tamanoParametros}; se muestran solo los tamaños que este equipo puede ejecutar.`;
  }

  return {
    runtime,
    entries,
    usableEntries,
    visibleEntries,
    hiddenEntries,
    recommended,
    hiddenSummary,
    statusMessage,
  };
}

export interface DeviceCapabilityAssessment {
  recommendedModel: ModelManifest;
  maxSupportedModel: ModelManifest;
  tierName: DeviceTierName;
  canRun8B: boolean;
  canRun4B: boolean;
  canRunStandard: boolean;
  canRunUltralight: boolean;
  ramFormatted: string;
  storageAvailableMb?: number;
  statusMessage: string;
}

/**
 * Evaluación de capacidades basada en el catálogo real. Conserva la interfaz
 * histórica (canRun4B/canRun8B) pero ahora un 8 GB Android no recomienda 7B.
 */
export function assessDeviceCapabilities(sysInfo: DeviceSystemInfo): DeviceCapabilityAssessment {
  const catalog = buildDeviceCatalog(sysInfo);
  const byId = (id: ModelProfileId) =>
    catalog.entries.find((entry) => entry.id === id)?.usable ?? false;
  const maxSupportedModel =
    catalog.usableEntries[catalog.usableEntries.length - 1]?.manifest ??
    AVAILABLE_MODELS.ULTRALIGHT;

  return {
    recommendedModel: catalog.recommended,
    maxSupportedModel,
    tierName: catalog.runtime.tierName,
    canRun8B: byId('MAX_8B'),
    canRun4B: byId('ADVANCED_4B'),
    canRunStandard: byId('STANDARD'),
    canRunUltralight: byId('ULTRALIGHT'),
    ramFormatted: `${(catalog.runtime.ramMb / 1024).toFixed(1)} GB`,
    storageAvailableMb: sysInfo.storageFreeMb,
    statusMessage: catalog.statusMessage,
  };
}

/**
 * Selecciona el modelo de referencia óptimo automáticamente según la
 * telemetría del hardware y el runtime real disponible.
 */
export function selectAdaptiveModel(sysInfo: DeviceSystemInfo): ModelManifest {
  return buildDeviceCatalog(sysInfo).recommended;
}
