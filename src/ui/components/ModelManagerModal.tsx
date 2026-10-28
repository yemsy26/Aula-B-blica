import React, { useState, useEffect } from 'react';
import { DeviceSystemInfo } from '../../core/native-bridge/types.js';
import { nativeBridge } from '../../core/native-bridge/bridge.js';
import {
  AVAILABLE_MODELS,
  buildDeviceCatalog,
  selectAdaptiveModel,
} from '../../core/inference/modelRegistry.js';
import { createModelDownloader } from '../../core/inference/modelDownloader.js';
import type { ModelDownloader } from '../../core/inference/modelDownloader.js';
import {
  getNativeLlamaInfo,
  hasNativeModel,
  listInstalledNativeModelIds,
  resetNativeAcceleration,
} from '../../core/native-bridge/llamaNative.js';
import { DownloadProgress, ModelManifest, ModelProfileId } from '../../core/inference/types.js';
import { BrainHealth, BrainProvider } from '../../core/inference/brain/types.js';
import { brainRegistry } from '../../core/inference/brain/brainRegistry.js';
import { resolveOnDeviceManifest } from '../../core/inference/brain/wllamaAdapter.js';
import {
  Cpu,
  HardDrive,
  DownloadCloud,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
  Zap,
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  Sparkles,
  Save,
  FlaskConical,
  Smartphone,
  Laptop,
  Loader2,
} from 'lucide-react';

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrainChanged?: (label: string) => void;
}

const PROVIDERS: {
  id: BrainProvider;
  name: string;
  short: string;
  description: string;
  endpoint: string;
  model: string;
}[] = [
  {
    id: 'deterministic',
    name: 'Motor determinista',
    short: 'Offline · sin modelo',
    description:
      'No usa red ni descargas. Compone respuestas teológicas verificadas con el catálogo y las citas de SQLite. No es un modelo generativo libre.',
    endpoint: '',
    model: 'teologia-verificada',
  },
  {
    id: 'on-device',
    name: 'En el dispositivo',
    short: 'GGUF · llama.cpp · PC y Android',
    description:
      'Ejecuta un archivo GGUF descargado dentro de la app, sin servidor ni internet. En Android usa llama.cpp nativo (varios hilos reales, NPU Hexagon en Snapdragon compatible; en Adreno, Vulkan se omite en modo automático porque ese driver no compila los K-quant del catálogo y solo un Q4_0 pequeño se ha verificado acelerado, así que el respaldo es CPU). Si un acelerador cierra la aplicación, se pone en cuarentena y el siguiente arranque usa otro. En PC/web usa wllama/WASM o Ollama para aprovechar la GPU. El gestor solo ofrece los tamaños que este equipo puede ejecutar según su RAM, ABI y espacio libre.',
    endpoint: '',
    model: 'ULTRALIGHT',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    short: 'Servidor local o LAN',
    description:
      'Conecta con Ollama en tu equipo. Úsalo para modelos grandes y redacción libre. En Android necesitas la misma Wi-Fi, permitir HTTP local y exponer Ollama en 0.0.0.0.',
    endpoint: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI-compatible',
    short: 'LM Studio / vLLM',
    description:
      'LM Studio, llama-server, vLLM, LocalAI u otro servidor compatible con la API de OpenAI. Indica la URL base que termina en /v1.',
    endpoint: 'http://localhost:1234/v1',
    model: 'local-model',
  },
];

const PROVIDER_LABELS: Record<BrainProvider, string> = {
  deterministic: 'Motor determinista',
  'on-device': 'En el dispositivo',
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI-compatible',
};

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
  onBrainChanged,
}) => {
  const [sysInfo, setSysInfo] = useState<DeviceSystemInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelManifest>(
    AVAILABLE_MODELS.ULTRALIGHT
  );
  const [downloader, setDownloader] = useState<ModelDownloader | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<BrainProvider>(
    () => brainRegistry.getConfig().provider
  );
  const [endpoint, setEndpoint] = useState(() => brainRegistry.getConfig().endpoint);
  const [model, setModel] = useState(() => brainRegistry.getConfig().model);
  const [timeoutMs, setTimeoutMs] = useState(() => brainRegistry.getConfig().timeoutMs);
  const [temperature, setTemperature] = useState(() => brainRegistry.getConfig().temperature);
  const [maxTokens, setMaxTokens] = useState(() => brainRegistry.getConfig().maxTokens);

  const [health, setHealth] = useState<BrainHealth | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isWarming, setIsWarming] = useState(false);
  const [warmMessage, setWarmMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [installedModels, setInstalledModels] = useState<ModelProfileId[]>(() => {
    try {
      const raw = localStorage.getItem('verbovivo_installed_models');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const activeLabel = brainRegistry.describeActive();
  const activeConfig = brainRegistry.getConfig();

  useEffect(() => {
    if (!isOpen) return;

    const config = brainRegistry.getConfig();
    setSelectedProvider(config.provider);
    setEndpoint(config.endpoint);
    setModel(config.provider === 'on-device' ? resolveOnDeviceManifest(config.model).id : config.model);
    setTimeoutMs(config.timeoutMs);
    setTemperature(config.temperature);
    setMaxTokens(config.maxTokens);
    setHealth(null);
    setSaveMessage(null);
    setWarmMessage(null);

    async function fetchSystem() {
      const info = await nativeBridge.getSystemInfo();
      setSysInfo(info);
      const recommended = selectAdaptiveModel(info);

      // La lista guardada puede quedar obsoleta si el usuario borró datos.
      // Confirmamos contra el almacenamiento real del motor que se usará:
      // filesDir nativo en Android o OPFS/wllama en PC/web.
      const native = await getNativeLlamaInfo();
      let found: ModelProfileId[] = [];
      if (native?.available) {
        found = await listInstalledNativeModelIds();
      } else {
        await Promise.all(
          Object.values(AVAILABLE_MODELS).map(async (manifest) => {
            if (await nativeBridge.hasPrivateFile(manifest.archivoDestino)) {
              found.push(manifest.id);
            }
          })
        );
      }

      found.sort(
        (a, b) =>
          Object.keys(AVAILABLE_MODELS).indexOf(a) - Object.keys(AVAILABLE_MODELS).indexOf(b)
      );
      setInstalledModels(found);

      // El botón de descarga debe apuntar al cerebro que el usuario ya usa,
      // no al modelo recomendado. Antes, en un PC de 32 GB, abrir el gestor
      // preseleccionaba 7B y «Descargar» iniciaba 4.4 GB sin querer.
      const activeOnDevice =
        config.provider === 'on-device' ? resolveOnDeviceManifest(config.model) : null;
      setSelectedModel(
        activeOnDevice && found.includes(activeOnDevice.id) ? activeOnDevice : recommended
      );

      try {
        localStorage.setItem('verbovivo_installed_models', JSON.stringify(found));
      } catch {
        // Sin localStorage, el estado sigue siendo válido para esta sesión.
      }
    }

    void fetchSystem();
  }, [isOpen]);

  if (!isOpen) return null;

  // Catálogo real de este equipo: la UI nunca ofrece un tamaño que el runtime
  // (WebView de un hilo, falta de COOP/COEP, RAM o espacio) no pueda sostener.
  const deviceCatalog = sysInfo ? buildDeviceCatalog(sysInfo, installedModels) : null;
  const recommendedModelId = deviceCatalog?.recommended.id ?? null;
  const recommendedModel = deviceCatalog?.recommended ?? AVAILABLE_MODELS.ULTRALIGHT;
  const selectedEntry =
    deviceCatalog?.entries.find((entry) => entry.id === selectedModel.id) ?? null;
  const selectedModelUsable = selectedEntry?.usable ?? false;
  const activeOnDeviceId =
    activeConfig.provider === 'on-device' ? resolveOnDeviceManifest(activeConfig.model).id : null;
  const activeOnDeviceEntry =
    deviceCatalog?.entries.find((entry) => entry.id === activeOnDeviceId) ?? null;

  const accelerationPolicy = deviceCatalog?.runtime.accelerationPolicy;
  const npuPolicy = accelerationPolicy?.npu;
  const gpuPolicy = accelerationPolicy?.gpu;
  const npuAutoUsable =
    deviceCatalog?.runtime.npu?.usable === true && npuPolicy?.usable !== false;
  const gpuAutoUsable =
    deviceCatalog?.runtime.gpu?.usable === true && gpuPolicy?.usable !== false;
  const hasAccelerationQuarantine = !!(npuPolicy?.quarantined || gpuPolicy?.quarantined);

  const gpuProfileReady =
    deviceCatalog?.entries.some((entry) => entry.id === 'ULTRALIGHT_GPU' && entry.usable) === true &&
    gpuPolicy?.quarantined !== true;

  // El gestor debe explicar la política real, no lo que el driver «podría»
  // hacer: si Vulkan se omite en Adreno o un acelerador está en cuarentena,
  // el usuario lo ve antes de cargar y no interpreta un cierre como azar.
  const nativeAccelerationText = (() => {
    const runtime = deviceCatalog?.runtime;
    if (!runtime) return '';
    if (!runtime.native) {
      return runtime.isMobile
        ? 'Esta instalación no incluye el motor nativo: el WebView ejecuta wllama con un solo hilo; por eso solo se ofrece 0.5B.'
        : runtime.multithread
          ? `Wllama puede usar ${runtime.threads} hilo(s) y CPU (WASM), sin GPU.`
          : 'Este servidor no envía COOP/COEP, así que wllama usa un solo hilo; por eso el catálogo se limita a los tamaños viables.';
    }
    if (npuAutoUsable) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. NPU Hexagon v${runtime.npu?.arch || '?'} (${runtime.npu?.name || 'HTP'}) utilizable: el modelo se intentará cargar primero ahí; si falla sin cerrar la app, se reintenta en ${gpuAutoUsable ? 'Vulkan' : 'CPU'}. La NPU acelera el cálculo, pero no amplía la RAM.`;
    }
    if (npuPolicy?.quarantined) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. La NPU Hexagon está en cuarentena: ${npuPolicy.reason || 'cerró la app en una carga anterior'}. Se usará ${gpuAutoUsable ? 'Vulkan' : 'CPU'}.`;
    }
    if (runtime.npu?.available) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. La NPU Hexagon está presente pero no se pudo abrir (${runtime.npu.reason || 'sin sesión HTP'}); se usará ${gpuAutoUsable ? 'Vulkan' : 'CPU'}.`;
    }
    if (gpuAutoUsable) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales y memoria fuera del WebView. Vulkan detectado: ${runtime.gpu?.name || 'GPU'}; el modelo se cargará con offload de capas.`;
    }
    if (gpuPolicy?.quarantined) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. La GPU Vulkan está en cuarentena: ${gpuPolicy.reason || 'cerró la app en una carga anterior'}. Todo el cálculo irá a CPU.`;
    }
    if (gpuProfileReady) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. Vulkan verificado en ${runtime.gpu?.name || 'Adreno 750'}: el perfil 0.5B Q4_0 se carga con todas las capas en GPU (unas 2,4× sobre CPU). El resto del catálogo sigue en CPU porque este driver no compila los K-quant.`;
    }
    if (gpuPolicy?.skipped) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. ${gpuPolicy.reason || 'Vulkan se omite en este driver; se usará CPU.'}`;
    }
    if (runtime.gpu?.software) {
      return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. Vulkan existe, pero es un rasterizador de software; se usará CPU.`;
    }
    return `llama.cpp nativo (${runtime.nativeAbi ?? 'ABI local'}) usa ${runtime.threads} hilo(s) reales. No hay una NPU ni una GPU Vulkan utilizables; se usará CPU.`;
  })();

  const handleResetAcceleration = async () => {
    try {
      await resetNativeAcceleration();
      const info = await nativeBridge.getSystemInfo();
      setSysInfo(info);
      setWarmMessage(
        gpuPolicy?.skipped
          ? 'Cuarentena restablecida. La próxima carga volverá a probar la NPU; el perfil 0.5B Q4_0 volverá a intentar Vulkan. Los demás modelos siguen en CPU en Adreno.'
          : 'Aceleración restablecida. La próxima carga volverá a probar NPU y GPU; si el driver vuelve a cerrar la app, se pondrán en cuarentena otra vez.'
      );
    } catch {
      setWarmMessage('No se pudo restablecer la aceleración nativa.');
    }
  };

  const handleSelectProvider = (provider: BrainProvider) => {
    setSelectedProvider(provider);
    setHealth(null);
    setSaveMessage(null);
    setWarmMessage(null);

    const preset = PROVIDERS.find((item) => item.id === provider);
    if (!preset) return;

    if (provider === 'deterministic') {
      setEndpoint('');
      setModel(preset.model);
      return;
    }

    if (provider === 'on-device') {
      setEndpoint('');
      // Preferimos un archivo ya instalado que además sea viable. Un 7B
      // descargado en un teléfono no debe seleccionarse solo por existir.
      const catalog = sysInfo ? buildDeviceCatalog(sysInfo, installedModels) : null;
      const usableInstalled = catalog?.entries.find((entry) => entry.usable && entry.installed);
      const chosen = usableInstalled?.manifest ?? catalog?.recommended ?? AVAILABLE_MODELS.ULTRALIGHT;
      setModel(chosen.id);
      setSelectedModel(chosen);
      return;
    }

    setEndpoint(preset.endpoint);
    setModel(preset.model);
  };

  const normalizedModel =
    selectedProvider === 'on-device' ? resolveOnDeviceManifest(model).id : model.trim();

  const handleTestConnection = async () => {
    setIsTesting(true);
    setHealth(null);
    setWarmMessage(null);

    const result = await brainRegistry.health(selectedProvider, {
      provider: selectedProvider,
      endpoint: selectedProvider === 'on-device' ? '' : endpoint,
      model: normalizedModel,
      timeoutMs,
    });

    setHealth(result);
    setIsTesting(false);
  };

  const handleWarmUp = async () => {
    setIsWarming(true);
    setHealth(null);
    setWarmMessage(null);

    const config = {
      provider: selectedProvider,
      endpoint: selectedProvider === 'on-device' ? '' : endpoint,
      model: normalizedModel,
      timeoutMs,
      temperature,
      maxTokens,
    };

    const result = await brainRegistry.warmUp(selectedProvider, config);

    if (!result.ok) {
      setHealth(result);
      setWarmMessage(result.detail || 'No se pudo cargar el modelo.');
      setIsWarming(false);
      return;
    }

    // Cargar el archivo no demuestra que el cerebro sepa responder. En el
    // dispositivo ejecutamos una generación mínima y mostramos la latencia
    // real; así el usuario no confunde «archivo presente» con «modelo útil».
    if (selectedProvider === 'on-device') {
      try {
        const adapter = brainRegistry.getAdapter(selectedProvider, config);
        const started = Date.now();
        const probe = await adapter.chat({
          // Un turno mínimo: mide inferencia real sin gastar el presupuesto de
          // un contrato completo. Si el modelo responde algo distinto, la
          // muestra lo deja ver; no se presenta como prueba de calidad.
          messages: [{ role: 'user', content: 'Responde solo con la palabra: amén.' }],
          temperature: 0.2,
          maxTokens: 8,
          stream: true,
        });
        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        const normalized = probe.text.trim().replace(/\s+/g, ' ');
        const sample = normalized.slice(0, 80) || '(respuesta vacía)';
        const ellipsis = normalized.length > sample.length ? '…' : '';
        // wllama no siempre publica `usage`; omitimos el dato en vez de mostrar «?».
        const usageNote = probe.usage?.promptTokens
          ? ` Contexto ${probe.usage.promptTokens} tokens de entrada.`
          : '';

        setWarmMessage(
          `Modelo cargado y respuesta real en ${elapsed} s: «${sample}${ellipsis}».${usageNote}`
        );
      } catch (error) {
        setWarmMessage(
          `El archivo cargó, pero la generación de prueba falló: ${
            error instanceof Error ? error.message : 'error desconocido'
          }`
        );
      }
    } else {
      setWarmMessage('El modelo cargó y quedó listo para responder.');
    }

    setHealth(result);
    setIsWarming(false);
  };

  const onDeviceFileExists = async (fileName: string): Promise<boolean> => {
    const native = await getNativeLlamaInfo();
    if (native?.available) return hasNativeModel(fileName);
    return nativeBridge.hasPrivateFile(fileName);
  };

  const handleSaveBrain = async () => {
    if (selectedProvider === 'on-device') {
      const manifest = resolveOnDeviceManifest(model);
      const entry = deviceCatalog?.entries.find((item) => item.id === manifest.id);
      if (entry && !entry.usable) {
        setSaveMessage(
          `No se puede activar ${manifest.tamanoParametros} en este dispositivo. ${entry.blocker ?? ''}`.trim()
        );
        return;
      }
      const exists = await onDeviceFileExists(manifest.archivoDestino);
      if (!exists) {
        setSaveMessage('Descarga y ensambla el archivo GGUF antes de activar este cerebro.');
        return;
      }
    }

    const next = brainRegistry.configure({
      provider: selectedProvider,
      endpoint: selectedProvider === 'deterministic' || selectedProvider === 'on-device'
        ? ''
        : endpoint.trim(),
      model: normalizedModel,
      timeoutMs,
      temperature,
      maxTokens,
    });

    setEndpoint(next.endpoint);
    setModel(next.model);
    const label = brainRegistry.describeActive();
    setSaveMessage(`Cerebro activo: ${label}`);
    onBrainChanged?.(label);
  };

  const handleActivateInstalled = async (manifest: ModelManifest) => {
    const exists = await onDeviceFileExists(manifest.archivoDestino);
    if (!exists) {
      setSaveMessage('El archivo ya no está en el almacenamiento. Vuelve a descargarlo.');
      return;
    }

    setSelectedProvider('on-device');
    setEndpoint('');
    setModel(manifest.id);
    setSelectedModel(manifest);
    setHealth(null);
    setWarmMessage(null);

    const next = brainRegistry.configure({
      provider: 'on-device',
      endpoint: '',
      model: manifest.id,
      timeoutMs,
      temperature,
      maxTokens,
    });

    setEndpoint(next.endpoint);
    setModel(next.model);
    const label = brainRegistry.describeActive();
    setSaveMessage(`Cerebro activo: ${label}`);
    onBrainChanged?.(label);
  };

  const handleStartDownload = async () => {
    if (!selectedModel.url) return;

    const entry = deviceCatalog?.entries.find((item) => item.id === selectedModel.id);
    if (entry && !entry.usable) {
      setSaveMessage(
        `No se descarga ${selectedModel.tamanoParametros}: no sería usable en este equipo. ${entry.blocker ?? ''}`.trim()
      );
      return;
    }

    const dl = createModelDownloader(selectedModel, (p) => setProgress({ ...p }));
    setDownloader(dl);
    const success = await dl.start();

    if (success) {
      const updated = Array.from(new Set([...installedModels, selectedModel.id]));
      setInstalledModels(updated);
      try {
        localStorage.setItem('verbovivo_installed_models', JSON.stringify(updated));
      } catch {
        // Sin localStorage, el archivo sigue en almacenamiento privado.
      }
    }
  };

  const handlePause = () => downloader?.pause();
  const handleResume = () => downloader?.resume();
  const handleCancel = async () => {
    const current = downloader;
    await current?.cancel();
    setProgress(null);
  };

  const selectedProviderInfo = PROVIDERS.find((item) => item.id === selectedProvider);
  const selectedOnDeviceManifest = resolveOnDeviceManifest(model);
  const selectedOnDeviceInstalled = installedModels.includes(selectedOnDeviceManifest.id);
  const isMobile = sysInfo?.platform === 'android';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-nocturne-900 border border-nocturne-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-200">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-nocturne-800 flex items-center justify-between bg-nocturne-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sacred-gold/15 border border-sacred-gold/30 flex items-center justify-center text-sacred-gold shrink-0">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-parchment-100">
                Cerebro y conexión de inferencia
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Modelo en el dispositivo, servidor local o motor determinista · el diálogo y las citas no cambian
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-nocturne-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {/* Cerebro activo */}
          <div className="p-3.5 rounded-xl bg-nocturne-950 border border-sacred-gold/30 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                Cerebro activo
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 font-mono">
                {PROVIDER_LABELS[activeConfig.provider]}
              </span>
            </div>
            <p className="text-sm font-semibold text-sacred-gold-light break-words">{activeLabel}</p>
            <p className="text-[11px] text-zinc-400">
              Modelo: <span className="font-mono">{activeConfig.model || 'sin especificar'}</span>
              {activeConfig.provider === 'on-device' && (
                <>
                  {' '}· Archivo:{' '}
                  <span className="font-mono">
                    {resolveOnDeviceManifest(activeConfig.model).archivoDestino}
                  </span>
                </>
              )}
              {activeConfig.provider !== 'deterministic' && activeConfig.provider !== 'on-device' && (
                <>
                  {' '}· Endpoint: <span className="font-mono">{activeConfig.endpoint}</span>
                </>
              )}
            </p>
            <p className="text-[11px] text-zinc-500">
              Si el cerebro falla o no responde, el motor determinista responde y lo indica en el mensaje.
            </p>

            {activeOnDeviceEntry && !activeOnDeviceEntry.usable && (
              <div className="mt-1.5 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-[11px] text-rose-100 space-y-1.5">
                <p className="flex items-start gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  El cerebro activo ({activeOnDeviceEntry.manifest.tamanoParametros}) no es viable en este equipo.
                </p>
                <p className="text-rose-200/90">{activeOnDeviceEntry.blocker}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider('on-device');
                    setEndpoint('');
                    setModel(recommendedModel.id);
                    setSelectedModel(recommendedModel);
                    setHealth(null);
                    setWarmMessage(null);
                    setSaveMessage(
                      `Seleccionado ${recommendedModel.tamanoParametros}. Descárgalo o actívalo en la sección «En el dispositivo».`
                    );
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-50 font-semibold transition-colors cursor-pointer"
                >
                  Cambiar a {recommendedModel.tamanoParametros} (óptimo aquí)
                </button>
              </div>
            )}
          </div>

          {/* Proveedor */}
          <div className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800 space-y-3">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-sacred-gold" />
              Proveedor de inferencia
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelectProvider(provider.id)}
                  className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    selectedProvider === provider.id
                      ? 'bg-sacred-gold/15 border-sacred-gold/50 ring-1 ring-sacred-gold/20'
                      : 'bg-nocturne-900 border-nocturne-800 hover:border-nocturne-700'
                  }`}
                >
                  <span className="block text-xs font-semibold text-parchment-100">
                    {provider.name}
                  </span>
                  <span className="block text-[10px] text-zinc-400 mt-0.5">{provider.short}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-zinc-400">{selectedProviderInfo?.description}</p>

            {(selectedProvider === 'ollama' || selectedProvider === 'openai-compatible') && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Endpoint</label>
                    <input
                      type="text"
                      value={endpoint}
                      onChange={(event) => setEndpoint(event.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full px-2.5 py-1.5 bg-nocturne-950 border border-nocturne-700 rounded-lg font-mono text-xs text-zinc-200 focus:outline-none focus:border-sacred-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Modelo</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="qwen2.5:1.5b"
                      className="w-full px-2.5 py-1.5 bg-nocturne-950 border border-nocturne-700 rounded-lg font-mono text-xs text-zinc-200 focus:outline-none focus:border-sacred-gold"
                    />
                  </div>
                </div>

                {isMobile && selectedProvider === 'ollama' && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-zinc-500">Atajos:</span>
                    <button
                      type="button"
                      onClick={() => setEndpoint('http://10.0.2.2:11434')}
                      className="px-2 py-1 rounded-md bg-nocturne-900 border border-nocturne-700 text-zinc-300 hover:border-sacred-gold/50 hover:text-sacred-gold"
                    >
                      Emulador → PC (10.0.2.2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndpoint('http://localhost:11434')}
                      className="px-2 py-1 rounded-md bg-nocturne-900 border border-nocturne-700 text-zinc-300 hover:border-sacred-gold/50 hover:text-sacred-gold"
                    >
                      Ollama en este teléfono
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Timeout (ms)</label>
                    <input
                      type="number"
                      min={1000}
                      max={300000}
                      step={1000}
                      value={timeoutMs}
                      onChange={(event) => setTimeoutMs(Number(event.target.value))}
                      className="w-full px-2 py-1.5 bg-nocturne-950 border border-nocturne-700 rounded-lg font-mono text-xs text-zinc-200 focus:outline-none focus:border-sacred-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Temperatura</label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      value={temperature}
                      onChange={(event) => setTemperature(Number(event.target.value))}
                      className="w-full px-2 py-1.5 bg-nocturne-950 border border-nocturne-700 rounded-lg font-mono text-xs text-zinc-200 focus:outline-none focus:border-sacred-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Máx. tokens</label>
                    <input
                      type="number"
                      min={64}
                      max={32768}
                      step={64}
                      value={maxTokens}
                      onChange={(event) => setMaxTokens(Number(event.target.value))}
                      className="w-full px-2 py-1.5 bg-nocturne-950 border border-nocturne-700 rounded-lg font-mono text-xs text-zinc-200 focus:outline-none focus:border-sacred-gold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-nocturne-800 hover:bg-nocturne-750 disabled:opacity-50 text-zinc-200 text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-sacred-gold" />
                    <span>{isTesting ? 'Comprobando...' : 'Probar conexión'}</span>
                  </button>

                  {health && (
                    <span
                      className={`text-[11px] font-mono flex items-center gap-1 ${
                        health.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {health.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                      {health.ok
                        ? `Conectado · ${health.latencyMs} ms`
                        : 'Sin respuesta'}
                    </span>
                  )}
                </div>

                {health && (
                  <div
                    className={`p-2.5 rounded-lg border text-[11px] ${
                      health.ok
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-100'
                        : 'bg-rose-950/30 border-rose-800/50 text-rose-100'
                    }`}
                  >
                    <p>{health.detail || (health.ok ? 'Conexión correcta.' : 'No se pudo conectar.')}</p>
                    {health.models && health.models.length > 0 && (
                      <p className="mt-1 text-zinc-400 font-mono break-words">
                        Modelos: {health.models.slice(0, 8).join(', ')}
                        {health.models.length > 8 ? ` … (+${health.models.length - 8})` : ''}
                      </p>
                    )}
                    {health.ok && health.modelAvailable === false && (
                      <p className="mt-1 text-amber-300">
                        El modelo indicado no aparece en el servidor. Puedes escribirlo igual si lo cargas después.
                      </p>
                    )}
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-nocturne-900 border border-nocturne-800 text-[11px] text-zinc-300 space-y-1.5">
                  <p className="flex items-center gap-1.5 font-semibold text-zinc-200">
                    {isMobile ? (
                      <Smartphone className="w-3.5 h-3.5 text-sacred-gold" />
                    ) : (
                      <Laptop className="w-3.5 h-3.5 text-sacred-gold" />
                    )}
                    {isMobile ? 'Conectar el teléfono con tu PC' : 'Servidor en tu equipo'}
                  </p>
                  <p>
                    PC con Ollama: <span className="font-mono">http://localhost:11434</span>. Emulador Android:{' '}
                    <span className="font-mono">http://10.0.2.2:11434</span>. Teléfono real:{' '}
                    <span className="font-mono">http://IP-DE-TU-PC:11434</span>.
                  </p>
                  <p className="text-zinc-400">
                    Para aceptar conexiones de la red local, inicia Ollama con{' '}
                    <span className="font-mono text-zinc-300">OLLAMA_HOST=0.0.0.0</span> y{' '}
                    <span className="font-mono text-zinc-300">OLLAMA_ORIGINS=*</span>, abre el puerto 11434 en el
                    firewall y mantén ambos equipos en la misma Wi-Fi.
                  </p>
                  <p className="text-amber-300">
                    En Android, la app necesita permitir HTTP local. Si no conecta, revisa la configuración de red
                    de la app antes de culpar al modelo.
                  </p>
                </div>
              </div>
            )}

            {selectedProvider === 'on-device' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-[10px] text-zinc-400">
                    Cerebro en el dispositivo · elige uno
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {installedModels.length} descargado(s)
                  </span>
                </div>

                {!deviceCatalog ? (
                  <p className="text-[11px] text-zinc-500 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Detectando qué tamaños puede ejecutar este equipo...
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {deviceCatalog.visibleEntries.map((entry) => {
                      const manifest = entry.manifest;
                      const isSelected = selectedOnDeviceManifest.id === manifest.id;
                      const isRecommended = recommendedModelId === manifest.id;
                      const sizeLabel =
                        manifest.tamanoMb >= 1000
                          ? `${(manifest.tamanoMb / 1024).toFixed(1)} GB`
                          : `${manifest.tamanoMb} MB`;

                      return (
                        <button
                          key={manifest.id}
                          type="button"
                          onClick={() => {
                            setModel(manifest.id);
                            setSelectedModel(manifest);
                            setHealth(null);
                            setWarmMessage(null);
                            setSaveMessage(null);
                          }}
                          aria-pressed={isSelected}
                          title={entry.blocker}
                          className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sacred-gold/15 border-sacred-gold/50 ring-1 ring-sacred-gold/20'
                              : 'bg-nocturne-900 border-nocturne-800 hover:border-nocturne-700'
                          } ${entry.usable ? '' : 'opacity-70'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-semibold text-parchment-100 leading-tight">
                              {manifest.tamanoParametros} · {manifest.cuantizacion}
                            </span>
                            {entry.installed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <span className="text-[9px] font-mono text-amber-400 shrink-0">sin archivo</span>
                            )}
                          </div>
                          <span className="block text-[10px] text-zinc-500 mt-1 leading-snug">
                            {manifest.gamaRecomendada} · {sizeLabel}
                          </span>
                          <span className="flex flex-wrap gap-1 mt-1">
                            {activeOnDeviceId === manifest.id && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sacred-gold/20 text-sacred-gold-light border border-sacred-gold/40 font-semibold">
                                En uso
                              </span>
                            )}
                            {isSelected && activeOnDeviceId !== manifest.id && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-nocturne-800 text-zinc-300 border border-nocturne-600">
                                Seleccionado · pulsa Guardar y activar
                              </span>
                            )}
                            {isRecommended && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                                Recomendado para este equipo
                              </span>
                            )}
                            {!entry.usable && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40">
                                No viable aquí
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {deviceCatalog?.hiddenSummary && (
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    {deviceCatalog.hiddenSummary}
                  </p>
                )}

                {!selectedOnDeviceInstalled && (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-start gap-2 text-[11px] text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Este archivo aún no está descargado. Descárgalo en la sección inferior; la app no puede
                      activar un cerebro que no existe.
                    </span>
                  </div>
                )}

                {selectedEntry && !selectedEntry.usable && (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-start gap-2 text-[11px] text-rose-100">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold">No viable en este equipo.</strong>{' '}
                      {selectedEntry.blocker}
                    </span>
                  </div>
                )}

                {selectedEntry?.usable && selectedEntry.warning && (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-start gap-2 text-[11px] text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{selectedEntry.warning}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !selectedModelUsable}
                    title={!selectedModelUsable ? selectedEntry?.blocker : undefined}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-nocturne-800 hover:bg-nocturne-750 disabled:opacity-50 text-zinc-200 text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-sacred-gold" />
                    <span>{isTesting ? 'Comprobando...' : 'Comprobar archivo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWarmUp}
                    disabled={isWarming || !selectedOnDeviceInstalled || !selectedModelUsable}
                    title={!selectedModelUsable ? selectedEntry?.blocker : undefined}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sacred-gold text-nocturne-950 font-semibold text-xs rounded-lg hover:bg-sacred-gold-light disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isWarming ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isWarming
                        ? selectedProvider === 'on-device'
                          ? 'Cargando y generando...'
                          : 'Comprobando...'
                        : 'Cargar y probar'}
                    </span>
                  </button>
                </div>

                {health && (
                  <div
                    className={`p-2.5 rounded-lg border text-[11px] ${
                      health.ok
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-100'
                        : 'bg-rose-950/30 border-rose-800/50 text-rose-100'
                    }`}
                  >
                    <p>{health.detail || (health.ok ? 'Archivo listo.' : 'El archivo no está listo.')}</p>
                    {health.models && health.models.length > 0 && (
                      <p className="mt-1 text-zinc-400 font-mono break-words">
                        Archivo: {health.models.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {warmMessage && (
                  <p
                    className={`text-[11px] ${
                      health?.ok ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {warmMessage}
                  </p>
                )}

                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {deviceCatalog
                    ? `${nativeAccelerationText} El archivo se guarda en el almacenamiento privado de la app. La primera carga tarda más que las siguientes. Si falla, el motor determinista responde y lo indica.`
                    : 'Detectando el runtime disponible...'}
                </p>

                {hasAccelerationQuarantine && (
                  <button
                    type="button"
                    onClick={() => void handleResetAcceleration()}
                    className="self-start flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/60 text-amber-200 text-[11px] rounded-lg transition-colors cursor-pointer"
                    title="Vuelve a probar los aceleradores después de una actualización de firmware o del APK. El perfil 0.5B Q4_0 intentará Vulkan de nuevo; los demás modelos siguen en CPU en Adreno."
                  >
                    <RotateCcw size={13} />
                    Restablecer cuarentena de aceleradores
                  </button>
                )}

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  El modelo local escribe el diálogo y, si la respuesta es larga, continúa automáticamente hasta el
                  límite del turno. Los documentos completos siguen siendo más fiables con el compositor verificado;
                  para redacción libre extensa, conecta Ollama o LM Studio en un PC.
                </p>
              </div>
            )}

            {selectedProvider === 'deterministic' && (
              <div className="p-2.5 rounded-lg bg-sacred-gold/10 border border-sacred-gold/25 text-[11px] text-parchment-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-sacred-gold shrink-0 mt-0.5" />
                <span>
                  El motor determinista no genera texto libre: responde con el catálogo teológico, la exégesis
                  verificada y las citas literales de SQLite. Es la red de seguridad del sistema.
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveBrain}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-sacred-gold text-nocturne-950 font-bold text-xs rounded-xl hover:bg-sacred-gold-light transition-colors shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar y activar</span>
              </button>
              {saveMessage && (
                <span className="text-[11px] text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {saveMessage}
                </span>
              )}
            </div>
          </div>

          {/* Archivos GGUF de referencia */}
          <div className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-sacred-gold" />
                Archivos GGUF para ejecutar en el dispositivo
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono">
                Runtime WASM integrado
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              La descarga usa HTTP Range real y falla si el servidor no entrega los bloques. El archivo se
              ensambla por streaming y solo se marca como verificado cuando el catálogo publica un SHA-256
              comprobable. Al terminar puedes activarlo como cerebro{' '}
              <strong>en este mismo dispositivo</strong>, sin Ollama ni internet.
            </p>

            <p className="text-[11px] text-zinc-500">
              {deviceCatalog
                ? deviceCatalog.statusMessage
                : 'Detectando hardware y runtime para decidir qué tamaños ofrecer...'}
            </p>

            {!deviceCatalog ? (
              <p className="text-[11px] text-zinc-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Detectando hardware...
              </p>
            ) : (
              <div className="p-2.5 rounded-lg bg-nocturne-900 border border-nocturne-800 text-[11px] text-zinc-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400">Archivo que se descargará:</span>
                  <strong className="text-parchment-100 text-right">
                    {selectedModel.nombre} · {selectedModel.tamanoParametros}
                  </strong>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Corresponde al cerebro seleccionado arriba. Para descargar otro, selecciónalo primero
                  en la lista de cerebros.
                </p>
              </div>
            )}

            {deviceCatalog?.hiddenSummary && (
              <p className="text-[10px] text-zinc-500 leading-relaxed">{deviceCatalog.hiddenSummary}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-500">
                {deviceCatalog
                  ? `RAM: ${(deviceCatalog.runtime.ramMb / 1024).toFixed(1)} GB · ${
                      deviceCatalog.runtime.tierName
                    } · ${
                      deviceCatalog.runtime.native
                        ? `nativo ${deviceCatalog.runtime.threads} hilo(s) · ${
                            npuAutoUsable
                              ? `NPU v${deviceCatalog.runtime.npu?.arch || '?'}`
                              : gpuAutoUsable
                                ? `GPU ${deviceCatalog.runtime.gpu?.name || 'Vulkan'}`
                                : gpuProfileReady
                                  ? `GPU ${deviceCatalog.runtime.gpu?.name || 'Vulkan'} (perfil Q4_0)`
                                  : hasAccelerationQuarantine
                                    ? 'CPU (acelerador en cuarentena)'
                                    : gpuPolicy?.skipped
                                      ? 'CPU (Vulkan omitido para el resto del catálogo)'
                                      : 'CPU'
                          }`
                        : deviceCatalog.runtime.multithread
                          ? `${deviceCatalog.runtime.threads} hilo(s) WASM`
                          : 'WASM 1 hilo'
                    }`
                  : 'Detectando hardware...'}
              </span>
              <button
                type="button"
                onClick={handleStartDownload}
                disabled={
                  !selectedModelUsable ||
                  progress?.status === 'DOWNLOADING' ||
                  progress?.status === 'VERIFYING'
                }
                title={!selectedModelUsable ? selectedEntry?.blocker : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-nocturne-800 hover:bg-nocturne-750 disabled:opacity-50 text-zinc-200 text-xs rounded-lg transition-colors cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>
                  {!selectedModelUsable
                    ? 'No disponible aquí'
                    : installedModels.includes(selectedModel.id)
                      ? 'Re-descargar archivo'
                      : 'Descargar archivo'}
                </span>
              </button>
            </div>

            {progress && (
              <div className="p-3 rounded-xl bg-nocturne-900 border border-nocturne-750 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <DownloadCloud className="w-4 h-4 text-sacred-gold" />
                    Bloque {progress.chunksDescargados} de {progress.totalChunks}
                  </span>
                  <span className="font-mono text-sacred-gold font-bold">{progress.porcentaje}%</span>
                </div>

                <div className="w-full h-2.5 bg-nocturne-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sacred-gold-dark via-sacred-gold to-sacred-gold-light transition-all duration-200"
                    style={{ width: `${progress.porcentaje}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    {(progress.bytesDescargados / (1024 * 1024)).toFixed(1)} MB /{' '}
                    {(progress.bytesTotales / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <span className="font-mono uppercase text-zinc-300">{progress.status}</span>
                </div>

                {progress.status === 'ERROR' && (
                  <p className="text-[11px] text-rose-300">
                    {downloader?.getErrorDetail() || progress.error || 'La descarga falló.'}
                  </p>
                )}

                {progress.status === 'COMPLETED' && (
                  <div className="text-[11px] text-zinc-300 space-y-1.5">
                    <p className="flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Archivo descargado y ensamblado.
                    </p>
                    <p className="text-zinc-400">{downloader?.getVerificationNote()}</p>
                    <p className="text-zinc-300">
                      Ya puede ejecutarse en este dispositivo con el runtime WASM integrado. La primera carga
                      tarda más que las siguientes.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void handleActivateInstalled(resolveOnDeviceManifest(progress.modelId))
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sacred-gold text-nocturne-950 font-bold text-xs rounded-lg hover:bg-sacred-gold-light transition-colors cursor-pointer"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Activar en el dispositivo</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                  {progress.status === 'DOWNLOADING' && (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-nocturne-800 hover:bg-nocturne-700 text-xs text-zinc-200 transition-colors cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pausar</span>
                    </button>
                  )}

                  {progress.status === 'PAUSED' && (
                    <button
                      type="button"
                      onClick={handleResume}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sacred-gold text-nocturne-950 font-semibold text-xs hover:bg-sacred-gold-light transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Reanudar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCancel}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 transition-colors ml-auto cursor-pointer"
                    title="Cancelar descarga"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-zinc-500">
            <Sparkles className="w-3.5 h-3.5 text-sacred-gold shrink-0 mt-0.5" />
            <span>
              El diálogo ministerial, la decisión de preguntar o proponer y la inyección de citas funcionan
              igual con cualquier cerebro. El modelo solo redacta; la verdad bíblica se verifica en SQLite.
            </span>
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-nocturne-800 bg-nocturne-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Zap className="w-3.5 h-3.5 text-sacred-gold" />
            <span>Respaldo determinista siempre disponible</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-nocturne-800 hover:bg-nocturne-750 text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
