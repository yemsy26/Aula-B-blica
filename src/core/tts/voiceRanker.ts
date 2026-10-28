import { TtsVoiceOption, VoiceTier } from './types.js';

export interface RankedVoiceOption extends TtsVoiceOption {
  score: number;
  tier: VoiceTier;
  tierLabel: string;
  isNeural: boolean;
  displayName: string;
}

export interface RawDeviceVoice {
  name?: string;
  voiceURI?: string;
  lang?: string;
  localService?: boolean;
  default?: boolean;
}

/**
 * Convierte las voces que expone el sistema (Android TTS o Web Speech) en
 * opciones seleccionables reales.
 *
 * No se inventan voces: si el dispositivo no tiene una voz, no aparece. Se
 * descartan los alias genéricos `xx-XX-language`, que apuntan a la misma voz
 * por defecto y llenaban la lista de opciones repetidas.
 */
export function buildDeviceVoiceOptions(rawVoices: RawDeviceVoice[]): TtsVoiceOption[] {
  const candidates = rawVoices
    .map((voice, index) => ({ voice, index }))
    .filter(({ voice }) => {
      if (!/^es([-_]|$)/i.test(voice.lang || '')) return false;
      return !(voice.voiceURI || '').toLowerCase().endsWith('-language');
    });

  // Android suele exponer la misma voz dos veces: `...-local` y `...-network`.
  // Es el mismo timbre; mostrarlo dos veces hacía parecer que la voz no cambiaba.
  // Conservamos la variante local y, si solo existe la de red, esa.
  const byBaseId = new Map<string, { voice: RawDeviceVoice; index: number }>();
  for (const candidate of candidates) {
    const rawId = (candidate.voice.voiceURI || candidate.voice.name || '').toLowerCase();
    const baseId = rawId.replace(/-(local|network)$/i, '');
    const existing = byBaseId.get(baseId);
    const isLocal = candidate.voice.localService !== false;
    if (!existing) {
      byBaseId.set(baseId, candidate);
      continue;
    }
    const existingIsLocal = existing.voice.localService !== false;
    if (isLocal && !existingIsLocal) {
      byBaseId.set(baseId, candidate);
    }
  }

  return Array.from(byBaseId.values()).map(({ voice, index }) => {
    const voiceURI = voice.voiceURI || voice.name || `Voz del sistema ${index + 1}`;
    return {
      voiceIndex: index,
      name: voiceURI,
      voiceURI,
      lang: voice.lang || 'es-ES',
      isDefault: !!voice.default,
      isLocalService: voice.localService !== false,
    };
  });
}

const TIER1_NEURAL_KEYWORDS = [
  'natural',
  'neural',
  'multilingual',
  'sabina',
  'dalia',
  'jorge',
  'alvaro',
  'elvira',
  'paulina',
  'mónica (mejorada)',
  'monica (mejorada)',
  'wavenet',
  'enhanced',
  'alta calidad',
  'premium',
];

const PREFERRED_REGIONS = [
  'es-mx',
  'es-do',
  'es-co',
  'es-es',
  'es-us',
  'es_mx',
  'es_do',
  'es_co',
  'es_es',
  'es_us',
];

function isLocalVoice(voice: { localService?: boolean; isLocalService?: boolean }): boolean {
  if (typeof voice.isLocalService === 'boolean') return voice.isLocalService;
  return voice.localService !== false;
}

/**
 * Calcula la puntuación de calidad humana para una voz según el estándar estricto:
 * 1. Tier 1 (Voces Neurales / Naturales HD): 100+ puntos
 * 2. Tier 2 (Voces Regionales Limpias): 50 - 80 puntos
 * 3. Tier 3 (Voces Estándar): 20 - 40 puntos
 * 4. Voces no hispanas: 0 puntos
 */
export function scoreVoice(voice: {
  name: string;
  voiceURI?: string;
  lang: string;
  localService?: boolean;
  isLocalService?: boolean;
}): number {
  const langLower = (voice.lang || '').toLowerCase();
  const isSpanish = langLower.startsWith('es');
  if (!isSpanish) return 0;

  let score = 20; // Base para cualquier voz en español

  const textToCheck = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();

  // 1. Tier 1: Palabras clave neurales y nombres de voces HD de vanguardia
  for (const kw of TIER1_NEURAL_KEYWORDS) {
    if (textToCheck.includes(kw)) {
      score += 100;
      break;
    }
  }

  // 2. Tier 2: Acentos regionales prioritarios
  const isPreferredRegion = PREFERRED_REGIONS.some((reg) => langLower.includes(reg));
  if (isPreferredRegion) {
    score += 35;
  }

  // Bonus de servicio local limpio (sin lag de red)
  if (isLocalVoice(voice)) {
    score += 15;
  }

  // Bonus si la voz indica explícitamente género pastoral/cálido
  if (textToCheck.includes('male') || textToCheck.includes('hombre')) {
    score += 5;
  } else if (textToCheck.includes('female') || textToCheck.includes('mujer')) {
    score += 5;
  }

  return score;
}

/**
 * Determina el Tier de la voz a partir de su puntuación y características
 */
export function classifyVoiceTier(voice: {
  name: string;
  voiceURI?: string;
  lang: string;
  localService?: boolean;
  isLocalService?: boolean;
}): { tier: VoiceTier; tierLabel: string; isNeural: boolean } {
  const textToCheck = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
  const isNeural = TIER1_NEURAL_KEYWORDS.some((kw) => textToCheck.includes(kw));

  if (isNeural) {
    return {
      tier: 'TIER_1_NEURAL',
      tierLabel: 'Neural HD',
      isNeural: true,
    };
  }

  const langLower = (voice.lang || '').toLowerCase();
  const isPreferredRegion = PREFERRED_REGIONS.some((reg) => langLower.includes(reg));
  if (isLocalVoice(voice)) {
    return {
      tier: 'TIER_2_REGIONAL',
      tierLabel: isPreferredRegion ? 'Voz local' : 'Voz local (otra región)',
      isNeural: false,
    };
  }

  return {
    tier: 'TIER_3_STANDARD',
    tierLabel: 'Voz en línea',
    isNeural: false,
  };
}

/**
 * Filtra, clasifica y clasifica en orden descendente todas las voces disponibles
 */
export function rankVoices(rawVoices: TtsVoiceOption[]): RankedVoiceOption[] {
  const spanishOnly = rawVoices.filter((v) => (v.lang || '').toLowerCase().startsWith('es'));

  const ranked: RankedVoiceOption[] = spanishOnly.map((v) => {
    const score = scoreVoice(v);
    const { tier, tierLabel, isNeural } = classifyVoiceTier(v);

    let cleanName = v.name;
    // Limpiar prefijos de Microsoft o Google si ensucian la UI
    cleanName = cleanName.replace(/^Microsoft\s+/i, '').replace(/^Google\s+/i, 'Google ');

    // Si el nombre es un identificador técnico de Android TTS
    if (/^[a-z]{2}[-_][a-z]{2}[-_]/i.test(cleanName)) {
      const parts = cleanName.split(/[-_]/);
      const regCode = parts[1]?.toUpperCase() || 'ES';
      const regLabel = regCode === 'US' ? 'Latinoamérica' : regCode === 'ES' ? 'España' : regCode;

      const variantToken = (parts[3] || parts[2] || '').toLowerCase();
      let gender = 'Natural';
      if (
        variantToken.includes('eed') ||
        variantToken.includes('eef') ||
        variantToken.includes('esd') ||
        variantToken.includes('sfb') ||
        cleanName.toLowerCase().includes('male') ||
        cleanName.toLowerCase().includes('vic')
      ) {
        gender = 'Masculina';
      } else if (
        variantToken.includes('eea') ||
        variantToken.includes('eec') ||
        variantToken.includes('eee') ||
        variantToken.includes('esc') ||
        variantToken.includes('esf') ||
        cleanName.toLowerCase().includes('female') ||
        cleanName.toLowerCase().includes('ana')
      ) {
        gender = 'Femenina';
      }

      const variantSuffix = variantToken.replace(/[^a-z0-9]/g, '').slice(-2).toUpperCase();
      const variantTag = variantSuffix ? ` [${variantSuffix}]` : '';

      cleanName = `Español (${regLabel}) - ${gender}${variantTag}`;
    }

    return {
      ...v,
      score,
      tier,
      tierLabel,
      isNeural,
      displayName: `${cleanName} (${tierLabel})`,
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
