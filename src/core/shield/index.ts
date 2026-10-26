import { normalizeLinguisticDialect } from './normalizer.js';
import { detectCrisis } from './crisisDetector.js';
import { classifyRoute, classifyLevel, classifyMinistryFormat } from './routerClassifier.js';
import { ShieldProcessingResult, UserTheologicalLevel, MinistryFormat } from './types.js';

export * from './types.js';
export * from './normalizer.js';
export * from './crisisDetector.js';
export * from './routerClassifier.js';

/**
 * Escudo Limpiador y Enrutador de Intención Principal
 * Ejecución determinista, memoria ultra-baja (< 2MB) y latencia ultra-rápida (< 5ms).
 */
export function processShield(
  rawInput: string,
  preferredLevel?: UserTheologicalLevel,
  preferredFormat?: MinistryFormat
): ShieldProcessingResult {
  const startTime = performance.now();

  // 1. Detección inmediata de crisis sobre el texto crudo y normalizado preliminar
  const crisisResult = detectCrisis(rawInput);

  // 2. Normalización lingüística, abreviaturas de chat y modismos
  const normalizedText = normalizeLinguisticDialect(rawInput);

  // 3. Si la detección cruda no arrojó crisis, volver a validar sobre el normalizado
  const finalCrisis = crisisResult.isCrisis ? crisisResult : detectCrisis(normalizedText);

  // 4. Enrutamiento de intención teológica
  const detectedRoute = classifyRoute(normalizedText);

  // 5. Clasificación de nivel (respeta preferencia si el usuario la fijó, o la deduce)
  const inferredLevel = classifyLevel(normalizedText);
  const detectedLevel = preferredLevel || inferredLevel;

  // 6. Detección de formato ministerial (respeta override si el usuario seleccionó uno específico)
  const inferredFormat = classifyMinistryFormat(normalizedText);
  const detectedFormat = preferredFormat && preferredFormat !== 'AUTO' ? preferredFormat : inferredFormat;

  // 7. Extracción de etiquetas para telemetría local / memoria
  const tags: string[] = [];
  if (finalCrisis.isCrisis) tags.push('CRISIS_EMOCIONAL');
  tags.push(detectedRoute.replace(/[[\]]/g, ''));
  tags.push(`NIVEL_${detectedLevel.toUpperCase()}`);
  if (detectedFormat && detectedFormat !== 'AUTO') {
    tags.push(`FORMATO_${detectedFormat}`);
  }

  const processingTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    originalText: rawInput,
    normalizedText,
    detectedRoute,
    detectedLevel,
    detectedFormat,
    crisis: finalCrisis,
    processingTimeMs,
    tags,
  };
}
