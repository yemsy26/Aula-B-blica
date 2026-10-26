import React, { useState, useEffect } from 'react';
import { BibliaCoreService } from '../../core/database/bibliaCoreService.js';
import { BibleImporter } from '../../core/importer/bibleImporter.js';
import { BibleImportResult } from '../../core/importer/types.js';
import {
  ONE_CLICK_BIBLE_CATALOG,
  BibleModuleEntry,
  downloadAndInstallModule,
  requiresLegalConsent,
  LEGAL_DISCLAIMER_TEXT,
} from '../../core/importer/oneClickCatalog.js';
import {
  FileUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  UploadCloud,
  Download,
  BookOpen,
  Sparkles,
  Layers,
  Lock,
  HeartHandshake,
} from 'lucide-react';

interface BibleImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  bibliaService: BibliaCoreService;
  onVersionImported: (versionTag: string) => void;
}

export const BibleImporterModal: React.FC<BibleImporterModalProps> = ({
  isOpen,
  onClose,
  bibliaService,
  onVersionImported,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'custom'>('catalog');
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'OPEN' | 'PERSONAL'>('ALL');

  // Estados de descarga 1 clic
  const [installingModuleId, setInstallingModuleId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<{ percent: number; message: string } | null>(null);
  const [pendingConsentModule, setPendingConsentModule] = useState<BibleModuleEntry | null>(null);

  // Estados de importación manual
  const [versionTag, setVersionTag] = useState('RVR60');
  const [pasteContent, setPasteContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<BibleImportResult | null>(null);

  useEffect(() => {
    if (isOpen && bibliaService) {
      setInstalledVersions(bibliaService.listAvailableVersions());
    }
  }, [isOpen, bibliaService]);

  if (!isOpen) return null;

  const handleStartDownload = async (module: BibleModuleEntry) => {
    if (requiresLegalConsent(module.id)) {
      setPendingConsentModule(module);
      return;
    }
    await executeOneClickInstall(module.id);
  };

  const handleConfirmLegalConsent = async () => {
    if (!pendingConsentModule) return;
    const modId = pendingConsentModule.id;
    setPendingConsentModule(null);
    await executeOneClickInstall(modId);
  };

  const executeOneClickInstall = async (moduleId: string) => {
    setInstallingModuleId(moduleId);
    setInstallProgress({ percent: 10, message: 'Iniciando descarga...' });
    setResult(null);

    try {
      const res = await downloadAndInstallModule(
        moduleId,
        bibliaService,
        (percent, message) => {
          setInstallProgress({ percent, message });
        }
      );

      setResult(res);
      const updated = bibliaService.listAvailableVersions();
      setInstalledVersions(updated);

      if (res.totalVersesImported > 0) {
        onVersionImported(res.versionTag);
      }
    } catch (err) {
      setResult({
        versionTag: moduleId,
        totalVersesImported: 0,
        errors: [err instanceof Error ? err.message : 'Error desconocido al instalar el módulo.'],
        executionTimeMs: 0,
      });
    } finally {
      setInstallingModuleId(null);
      setInstallProgress(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPasteContent(text);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!pasteContent.trim() || !versionTag.trim()) return;

    setIsProcessing(true);
    setResult(null);

    try {
      let records = [];
      const trimmed = pasteContent.trim();

      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        records = BibleImporter.parseJson(trimmed, versionTag);
      } else {
        records = BibleImporter.parseCsv(trimmed, versionTag);
      }

      const importRes = await BibleImporter.importBibleVersion(records, versionTag, bibliaService);
      setResult(importRes);

      const updated = bibliaService.listAvailableVersions();
      setInstalledVersions(updated);

      if (importRes.totalVersesImported > 0) {
        onVersionImported(importRes.versionTag);
      }
    } catch (err) {
      setResult({
        versionTag,
        totalVersesImported: 0,
        errors: [err instanceof Error ? err.message : 'Error desconocido al procesar el archivo'],
        executionTimeMs: 0,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sampleCsv = `Libro,Capitulo,Versiculo,Texto
Juan,3,16,"Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito..."
Salmos,23,1,"Jehová es mi pastor; nada me faltará."`;

  const filteredCatalog = ONE_CLICK_BIBLE_CATALOG.filter((m) => {
    if (filterCategory === 'OPEN') return m.categoria === 'OPEN_LICENSE';
    if (filterCategory === 'PERSONAL') return m.categoria === 'PERSONAL_STUDY';
    return true;
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-nocturne-900 border border-nocturne-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-200">
        
        {/* Cabecera Principal */}
        <div className="p-4 sm:p-5 border-b border-nocturne-800 flex items-center justify-between bg-nocturne-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sacred-gold/15 border border-sacred-gold/30 flex items-center justify-center text-sacred-gold shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-parchment-100 flex items-center gap-2">
                <span>Biblioteca de Módulos Bíblicos</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  100% Offline
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Descarga en 1 Clic · Licencias Abiertas · Sin suscripciones ni lucro
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-nocturne-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Insignia Open Source & Gratis para Siempre */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-950/50 via-nocturne-900 to-indigo-950/40 border-b border-nocturne-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Proyecto Open Source & Gratuito:</strong> Sin anuncios, sin rastreadores ni compras integradas.
            </span>
          </div>
          <span className="hidden sm:inline-block text-[10px] text-zinc-400 font-mono bg-nocturne-950/80 px-2 py-0.5 rounded border border-nocturne-800">
            Soberanía de Datos Local
          </span>
        </div>

        {/* Selector de Pestañas Principales */}
        <div className="flex items-center border-b border-nocturne-800 bg-nocturne-950/50 px-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'catalog'
                ? 'border-sacred-gold text-sacred-gold font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Biblioteca en 1 Clic</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-nocturne-800 text-zinc-300 font-mono">
              {ONE_CLICK_BIBLE_CATALOG.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'custom'
                ? 'border-sacred-gold text-sacred-gold font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileUp className="w-4 h-4" />
            <span>Subir Mi Propio Archivo (.CSV / .JSON)</span>
          </button>
        </div>

        {/* Contenido de Pestañas */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* ============================================================== */}
          {/* PESTAÑA 1: CATÁLOGO EN 1 CLIC                                  */}
          {/* ============================================================== */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-zinc-400 mr-1">Filtrar:</span>
                <button
                  type="button"
                  onClick={() => setFilterCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border cursor-pointer ${
                    filterCategory === 'ALL'
                      ? 'bg-sacred-gold text-nocturne-950 border-sacred-gold font-bold'
                      : 'bg-nocturne-950 text-zinc-400 border-nocturne-800 hover:text-white'
                  }`}
                >
                  Todas las versiones
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('OPEN')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border cursor-pointer ${
                    filterCategory === 'OPEN'
                      ? 'bg-emerald-500 text-nocturne-950 border-emerald-400 font-bold'
                      : 'bg-nocturne-950 text-zinc-400 border-nocturne-800 hover:text-white'
                  }`}
                >
                  Dominio Público & Abiertas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('PERSONAL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border cursor-pointer ${
                    filterCategory === 'PERSONAL'
                      ? 'bg-amber-500 text-nocturne-950 border-amber-400 font-bold'
                      : 'bg-nocturne-950 text-zinc-400 border-nocturne-800 hover:text-white'
                  }`}
                >
                  Estudio Personal (Acción Directa)
                </button>
              </div>

              {/* Mensaje de Progreso Activo */}
              {installProgress && (
                <div className="p-3.5 rounded-xl bg-sacred-gold/15 border border-sacred-gold/40 space-y-2">
                  <div className="flex items-center justify-between text-xs text-sacred-gold font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 animate-spin text-sacred-gold" />
                      <span>{installProgress.message}</span>
                    </span>
                    <span className="font-mono">{installProgress.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-nocturne-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sacred-gold transition-all duration-300"
                      style={{ width: `${installProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Lista de Tarjetas del Catálogo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredCatalog.map((module) => {
                  const isInstalled =
                    module.esNativa ||
                    installedVersions.includes(module.id) ||
                    (module.id === 'STRONG_TSK_PLUS' && installedVersions.includes('TSK_PLUS'));

                  const isCurrentInstalling = installingModuleId === module.id;

                  return (
                    <div
                      key={module.id}
                      className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800 hover:border-nocturne-700 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-xs sm:text-sm text-parchment-100 flex items-center gap-1.5">
                              <span>{module.nombre}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-nocturne-850 text-sacred-gold border border-nocturne-750">
                                {module.siglas}
                              </span>
                            </h4>
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              {module.recomendadoPara}
                            </p>
                          </div>

                          {/* Badge de Licencia */}
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-mono uppercase shrink-0 font-semibold border ${
                              module.licenciaTipo === 'DOMINIO_PUBLICO'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                : module.licenciaTipo === 'CREATIVE_COMMONS'
                                ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                                : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            {module.licenciaTipo === 'ESTUDIO_PERSONAL' ? 'Estudio Personal' : module.licencia}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {module.descripcion}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {module.caracteristicas.map((c, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-nocturne-900 text-zinc-400 border border-nocturne-800"
                            >
                              • {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Botón de Acción o Estado */}
                      <div className="pt-2 border-t border-nocturne-850 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-zinc-500">
                          Tamaño: {module.tamanoEstimado}
                        </span>

                        {isInstalled ? (
                          <div className="flex items-center gap-1 text-emerald-400 font-medium text-[11px] bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Instalada en SQLite</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartDownload(module)}
                            disabled={isCurrentInstalling || Boolean(installingModuleId)}
                            className="px-3 py-1.5 rounded-lg bg-sacred-gold hover:bg-sacred-gold-light text-nocturne-950 font-bold text-[11px] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar (1 Clic)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: SUBIR MI PROPIO ARCHIVO                             */}
          {/* ============================================================== */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sacred-gold/10 border border-sacred-gold/25 text-xs text-sacred-gold-light leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sacred-gold" />
                <span>
                  <strong>Aislamiento Legal (BYOB):</strong> Carga archivos de traducciones bíblicas provistos por ti o tu ministerio. Los versículos se indexan y guardan exclusivamente en el almacenamiento privado de tu navegador/dispositivo.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Etiqueta de la Versión (Identificador corto)
                </label>
                <input
                  type="text"
                  value={versionTag}
                  onChange={(e) => setVersionTag(e.target.value.toUpperCase())}
                  placeholder="ej: RVR60, NVI, LBLA, DHH, CST"
                  className="w-full px-3.5 py-2 bg-nocturne-950 border border-nocturne-700 rounded-xl text-sm font-mono text-zinc-200 focus:outline-none focus:border-sacred-gold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                  <span>Datos Bíblicos (.CSV o .JSON)</span>
                  <label className="cursor-pointer text-[11px] text-sacred-gold hover:underline flex items-center gap-1">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Cargar archivo desde tu disco</span>
                    <input
                      type="file"
                      accept=".csv,.json,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </label>
                <textarea
                  rows={6}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={`Pega el contenido o sube tu archivo con formato:\n${sampleCsv}`}
                  className="w-full p-3 bg-nocturne-950 border border-nocturne-700 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-sacred-gold leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setPasteContent(sampleCsv)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Cargar muestra de prueba</span>
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={!pasteContent.trim() || isProcessing}
                  className="px-4 py-2 bg-sacred-gold text-nocturne-950 font-bold rounded-xl text-xs hover:bg-sacred-gold-light transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? 'Indexando en SQLite...' : 'Importar e Indexar en SQLite'}
                </button>
              </div>
            </div>
          )}

          {/* Resultado de la Importación / Descarga */}
          {result && (
            <div
              className={`p-4 rounded-xl border text-xs leading-relaxed ${
                result.totalVersesImported > 0
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {result.totalVersesImported > 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      ¡Éxito! Módulo [{result.versionTag}] listo. Se indexaron {result.totalVersesImported} registros en {result.executionTimeMs} ms.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{result.errors[0] || 'No se pudieron importar los datos.'}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Compacto de Consentimiento Legal para Categoría B */}
        {pendingConsentModule && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
            <div className="max-w-md w-full bg-nocturne-900 border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 text-zinc-200">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
                <Lock className="w-5 h-5 shrink-0" />
                <h4>Aviso de Estudio Personal y Descargo Legal</h4>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed font-sans">
                {LEGAL_DISCLAIMER_TEXT}
              </div>

              <div className="text-[11px] text-zinc-400 space-y-1">
                <p>• <strong>Módulo:</strong> {pendingConsentModule.nombre} ({pendingConsentModule.siglas})</p>
                <p>• <strong>Destino:</strong> Base de datos local <code className="text-sacred-gold font-mono">biblia_core.sqlite</code> (On-Device)</p>
                <p>• <strong>Uso:</strong> Exclusivamente personal, pastoral y educativo sin fines de lucro.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-nocturne-800">
                <button
                  type="button"
                  onClick={() => setPendingConsentModule(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLegalConsent}
                  className="px-4 py-1.5 rounded-xl bg-sacred-gold hover:bg-sacred-gold-light text-nocturne-950 font-bold text-xs transition-all shadow-md cursor-pointer"
                >
                  Acepto y Descargo bajo mi responsabilidad
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pie del Modal */}
        <div className="p-4 border-t border-nocturne-800 bg-nocturne-950 flex items-center justify-between text-xs">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Versiones activas en tu equipo: <strong>{installedVersions.join(', ')}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-nocturne-800 text-zinc-300 rounded-xl text-xs hover:bg-nocturne-750 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
