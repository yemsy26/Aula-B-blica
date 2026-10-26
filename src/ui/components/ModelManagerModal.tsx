import React, { useState, useEffect } from 'react';
import { DeviceSystemInfo } from '../../core/native-bridge/types.js';
import { nativeBridge } from '../../core/native-bridge/bridge.js';
import { AVAILABLE_MODELS, selectAdaptiveModel, assessDeviceCapabilities } from '../../core/inference/modelRegistry.js';
import { ChunkedDownloader } from '../../core/inference/chunkedDownloader.js';
import { ModelManifest, DownloadProgress } from '../../core/inference/types.js';
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
} from 'lucide-react';
import { realModelBridge, RealBackendType } from '../../core/inference/realModelBridge.js';
import { ModelProfileId } from '../../core/inference/types.js';

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModelId: string;
  onModelActivated: (modelId: ModelProfileId) => void;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
  activeModelId,
  onModelActivated,
}) => {
  const [sysInfo, setSysInfo] = useState<DeviceSystemInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelManifest>(AVAILABLE_MODELS.STANDARD);
  const [downloader, setDownloader] = useState<ChunkedDownloader | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [backendType, setBackendType] = useState<RealBackendType>(realModelBridge.getBackendType());
  const [serverEndpoint, setServerEndpoint] = useState(realModelBridge.getServerConfig().endpoint);
  const [serverModel, setServerModel] = useState(realModelBridge.getServerConfig().modelName);
  const [pingStatus, setPingStatus] = useState<'IDLE' | 'CHECKING' | 'CONNECTED' | 'DISCONNECTED'>('IDLE');

  const handleTestPing = async () => {
    setPingStatus('CHECKING');
    realModelBridge.setServerConfig({ endpoint: serverEndpoint, modelName: serverModel });
    const ok = await realModelBridge.pingLocalServer();
    setPingStatus(ok ? 'CONNECTED' : 'DISCONNECTED');
  };

  const handleToggleBackend = (type: RealBackendType) => {
    setBackendType(type);
    realModelBridge.setBackendType(type);
    realModelBridge.setServerConfig({ endpoint: serverEndpoint, modelName: serverModel });
  };

  useEffect(() => {
    async function fetchSystem() {
      const info = await nativeBridge.getSystemInfo();
      setSysInfo(info);
      const recommended = selectAdaptiveModel(info);
      setSelectedModel(recommended);
    }
    if (isOpen) {
      fetchSystem();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    const dl = new ChunkedDownloader(selectedModel, (p) => {
      setProgress({ ...p });
    });
    setDownloader(dl);
    const success = await dl.start();
    if (success) {
      onModelActivated(selectedModel.id);
    }
  };

  const handlePause = () => {
    downloader?.pause();
  };

  const handleResume = () => {
    downloader?.resume();
  };

  const handleCancel = () => {
    downloader?.cancel();
    setProgress(null);
  };

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
                Gestor del Cerebro Maestro (Edge AI)
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Modelos GGUF locales · Descarga fraccionada · 100% On-Device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-nocturne-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnóstico de Hardware */}
        <div className="p-4 sm:p-5 border-b border-nocturne-800 bg-nocturne-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sacred-gold" />
              Diagnóstico de Capacidad del Dispositivo
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
                {sysInfo?.platform.toUpperCase() || 'WEB'}
              </span>
              {sysInfo && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sacred-gold/15 text-sacred-gold border border-sacred-gold/30 font-semibold">
                  {assessDeviceCapabilities(sysInfo).tierName}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-nocturne-950 border border-nocturne-800">
              <span className="block text-zinc-400 text-[11px]">RAM Estimada</span>
              <strong className="text-zinc-100 font-mono text-sm">
                {sysInfo ? `${(sysInfo.estimatedRamMb / 1024).toFixed(1)} GB` : 'Detectando...'}
              </strong>
              <span className="block text-[9px] text-zinc-400 mt-0.5">
                {sysInfo ? (sysInfo.cpuCores ? `${sysInfo.cpuCores} núcleos CPU` : 'Memoria física') : 'Detectando...'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-nocturne-950 border border-nocturne-800">
              <span className="block text-zinc-400 text-[11px]">Almacenamiento</span>
              <strong className="text-zinc-100 font-mono text-sm">
                {sysInfo?.storageFreeMb !== undefined
                  ? `${(sysInfo.storageFreeMb / 1024).toFixed(1)} GB libre`
                  : 'Suficiente'}
              </strong>
              <span className="block text-[9px] text-zinc-400 mt-0.5">Para modelos GGUF</span>
            </div>

            <div className="p-3 rounded-xl bg-nocturne-950 border border-nocturne-800">
              <span className="block text-zinc-400 text-[11px]">Cerebro Óptimo</span>
              <strong className="text-sacred-gold font-mono text-sm">
                {sysInfo ? assessDeviceCapabilities(sysInfo).recommendedModel.tamanoParametros : '1.5B'}
              </strong>
              <span className="block text-[9px] text-emerald-400 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Máxima fluidez
              </span>
            </div>

            <div className="p-3 rounded-xl bg-nocturne-950 border border-nocturne-800">
              <span className="block text-zinc-400 text-[11px]">Límite Máximo</span>
              <strong className="text-zinc-200 font-mono text-sm">
                {sysInfo ? assessDeviceCapabilities(sysInfo).maxSupportedModel.tamanoParametros : '4B / 8B'}
              </strong>
              <span className="block text-[9px] text-zinc-400 mt-0.5">
                {sysInfo?.estimatedRamMb && sysInfo.estimatedRamMb >= 7500
                  ? 'Soporta hasta 8B'
                  : sysInfo?.estimatedRamMb && sysInfo.estimatedRamMb >= 5500
                  ? 'Soporta hasta 4B'
                  : 'Soporta hasta 1.5B'}
              </span>
            </div>
          </div>

          {/* Mensaje diagnóstico contextual */}
          {sysInfo && (
            <div className="p-2.5 rounded-lg bg-sacred-gold/10 border border-sacred-gold/25 flex items-center gap-2 text-[11px] text-parchment-200">
              <Sparkles className="w-4 h-4 text-sacred-gold shrink-0" />
              <span>{assessDeviceCapabilities(sysInfo).statusMessage}</span>
            </div>
          )}
        </div>

        {/* Selector de Modelos */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Alternador de Modo de Inferencia */}
          <div className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-sacred-gold" />
                Modo de Inferencia Activo
              </span>
              <div className="flex items-center gap-1 bg-nocturne-900 p-0.5 rounded-lg border border-nocturne-800 text-[11px]">
                <button
                  onClick={() => handleToggleBackend('DETERMINISTIC')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    backendType === 'DETERMINISTIC'
                      ? 'bg-sacred-gold/20 text-sacred-gold border border-sacred-gold/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  On-Device (0 MB)
                </button>
                <button
                  onClick={() => handleToggleBackend('LOCAL_SERVER')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    backendType === 'LOCAL_SERVER'
                      ? 'bg-sacred-gold/20 text-sacred-gold border border-sacred-gold/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Servidor Local (PC)
                </button>
              </div>
            </div>

            {backendType === 'LOCAL_SERVER' && (
              <div className="p-3 rounded-lg bg-nocturne-900 border border-nocturne-750 space-y-2.5 text-xs animate-in fade-in duration-150">
                <p className="text-[11px] text-zinc-400">
                  Conexión directa a Ollama, LM Studio o llama-server en tu PC para calibrar modelos durante el desarrollo:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Endpoint Local</label>
                    <input
                      type="text"
                      value={serverEndpoint}
                      onChange={(e) => setServerEndpoint(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full px-2.5 py-1.5 bg-nocturne-950 border border-nocturne-700 rounded-lg font-mono text-xs text-zinc-200 focus:outline-none focus:border-sacred-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Nombre del Modelo</label>
                    <input
                      type="text"
                      value={serverModel}
                      onChange={(e) => setServerModel(e.target.value)}
                      placeholder="tinyllama, phi3, qwen"
                      className="w-full px-2.5 py-1.5 bg-nocturne-950 border border-nocturne-700 rounded-lg font-mono text-xs text-zinc-200 focus:outline-none focus:border-sacred-gold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={handleTestPing}
                    className="flex items-center gap-1.5 px-3 py-1 bg-nocturne-800 hover:bg-nocturne-750 text-zinc-200 text-xs rounded-lg transition-colors"
                  >
                    <span>Probar Conexión</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    {pingStatus === 'CHECKING' && <span className="text-zinc-400">Comprobando...</span>}
                    {pingStatus === 'CONNECTED' && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5" /> Servidor Activo
                      </span>
                    )}
                    {pingStatus === 'DISCONNECTED' && (
                      <span className="text-rose-400 flex items-center gap-1">
                        <WifiOff className="w-3.5 h-3.5" /> Sin Respuesta (Fallback Activo)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {Object.values(AVAILABLE_MODELS).map((m) => {
              const isSelected = selectedModel.id === m.id;
              const isActive = activeModelId === m.id;
              const assessment = sysInfo ? assessDeviceCapabilities(sysInfo) : null;
              const isRecommended = assessment?.recommendedModel.id === m.id;
              const isCompatible = sysInfo ? sysInfo.estimatedRamMb >= m.ramMinimaRequeridaMb : true;
              const sizeLabel = m.tamanoMb >= 1000 ? `${(m.tamanoMb / 1024).toFixed(1)} GB` : `${m.tamanoMb} MB`;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-nocturne-850 border-sacred-gold/50 shadow-md ring-1 ring-sacred-gold/30'
                      : 'bg-nocturne-950/60 border-nocturne-800 hover:border-nocturne-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 flex-1 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-parchment-100">{m.nombre}</h4>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                            ACTIVO
                          </span>
                        )}
                        {isRecommended && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sacred-gold/20 text-sacred-gold border border-sacred-gold/40 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> ÓPTIMO PARA TU EQUIPO
                          </span>
                        )}
                        {!isCompatible && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40 font-mono">
                            REQ. {(m.ramMinimaRequeridaMb / 1024).toFixed(0)} GB RAM
                          </span>
                        )}
                        {isCompatible && !isRecommended && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                            COMPATIBLE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">{m.descripcion}</p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono pt-0.5">
                        <span>Parámetros: <strong className="text-zinc-200">{m.tamanoParametros}</strong></span>
                        <span>Cuantización: <strong className="text-zinc-200">{m.cuantizacion}</strong></span>
                        <span>Contexto: <strong className="text-zinc-200">{m.contextoMaxTokens} tokens</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-mono font-bold text-sacred-gold block">
                        {sizeLabel}
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">
                        {m.totalChunks} bloques de {m.tamanoChunkMb} MB
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Advertencia si el modelo seleccionado excede la RAM del dispositivo */}
          {sysInfo && sysInfo.estimatedRamMb < selectedModel.ramMinimaRequeridaMb && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold text-amber-300">
                  Advertencia de Capacidad de Memoria
                </strong>
                <span>
                  El modelo seleccionado ({selectedModel.tamanoParametros}) requiere un mínimo de{' '}
                  {(selectedModel.ramMinimaRequeridaMb / 1024).toFixed(0)} GB de RAM. Tu dispositivo cuenta con{' '}
                  {(sysInfo.estimatedRamMb / 1024).toFixed(1)} GB. Podrías experimentar ralentizaciones o cierres de la
                  app por falta de memoria física disponible.
                </span>
              </div>
            </div>
          )}

          {/* Barra de Progreso Fraccionado (Chunks de 50MB) */}
          {progress && (
            <div className="p-4 rounded-xl bg-nocturne-850/80 border border-nocturne-750 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                  <DownloadCloud className="w-4 h-4 text-sacred-gold animate-bounce" />
                  Descarga Fraccionada: Bloque {progress.chunksDescargados} de {progress.totalChunks}
                </span>
                <span className="font-mono text-sacred-gold font-bold">{progress.porcentaje}%</span>
              </div>

              {/* Barra de progreso */}
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
                <span className="font-mono uppercase text-zinc-300">Estado: {progress.status}</span>
              </div>

              {/* Botones de control de descarga */}
              <div className="flex items-center gap-2 pt-1">
                {progress.status === 'DOWNLOADING' && (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-nocturne-800 hover:bg-nocturne-700 text-xs text-zinc-200 transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar</span>
                  </button>
                )}

                {progress.status === 'PAUSED' && (
                  <button
                    onClick={handleResume}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sacred-gold text-nocturne-950 font-semibold text-xs hover:bg-sacred-gold-light transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Reanudar</span>
                  </button>
                )}

                {progress.status === 'COMPLETED' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Cerebro verificado por SHA-256 e instalado en almacenamiento privado.</span>
                  </div>
                )}

                <button
                  onClick={handleCancel}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 transition-colors ml-auto"
                  title="Cancelar"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="p-4 border-t border-nocturne-800 bg-nocturne-950 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Zap className="w-3.5 h-3.5 text-sacred-gold" />
            <span>Motor Determinista Edge activo como respaldo continuo</span>
          </div>

          <div className="flex items-center gap-2">
            {!progress || progress.status === 'IDLE' ? (
              <button
                onClick={handleStartDownload}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-xs rounded-xl transition-all shadow-md ${
                  sysInfo && sysInfo.estimatedRamMb < selectedModel.ramMinimaRequeridaMb
                    ? 'bg-amber-600 text-nocturne-950 hover:bg-amber-500'
                    : 'bg-sacred-gold text-nocturne-950 hover:bg-sacred-gold-light'
                }`}
              >
                <DownloadCloud className="w-4 h-4" />
                <span>
                  {sysInfo && sysInfo.estimatedRamMb < selectedModel.ramMinimaRequeridaMb
                    ? `Descargar de todos modos (${selectedModel.tamanoMb >= 1000 ? (selectedModel.tamanoMb / 1024).toFixed(1) + ' GB' : selectedModel.tamanoMb + ' MB'})`
                    : `Descargar Cerebro (${selectedModel.tamanoMb >= 1000 ? (selectedModel.tamanoMb / 1024).toFixed(1) + ' GB' : selectedModel.tamanoMb + ' MB'})`}
                </span>
              </button>
            ) : progress.status === 'COMPLETED' ? (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-500 transition-colors"
              >
                Listo para Usar 100% Offline
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
