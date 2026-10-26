import { TtsVoiceOption, VoiceTier } from './types.js';

export interface RankedVoiceOption extends TtsVoiceOption {
  score: number;
  tier: VoiceTier;
  tierLabel: string;
  isNeural: boolean;
  displayName: string;
}

export const PREDEFINED_NATURAL_VOICES: RankedVoiceOption[] = [
  {
    voiceIndex: -101,
    name: 'Jorge (Natural HD - México)',
    displayName: 'Jorge (Natural HD - Pastoral Cálido)',
    lang: 'es-MX',
    isDefault: true,
    isLocalService: false,
    score: 165,
    tier: 'TIER_1_NEURAL',
    tierLabel: 'Neural HD',
    isNeural: true,
  },
  {
    voiceIndex: -102,
    name: 'Dalia (Natural HD - México)',
    displayName: 'Dalia (Natural HD - Devocional)',
    lang: 'es-MX',
    isDefault: false,
    isLocalService: false,
    score: 162,
    tier: 'TIER_1_NEURAL',
    tierLabel: 'Neural HD',
    isNeural: true,
  },
  {
    voiceIndex: -103,
    name: 'Álvaro (Natural HD - España)',
    displayName: 'Álvaro (Natural HD - Exegético)',
    lang: 'es-ES',
    isDefault: false,
    isLocalService: false,
    score: 158,
    tier: 'TIER_1_NEURAL',
    tierLabel: 'Neural HD',
    isNeural: true,
  },
  {
    voiceIndex: -104,
    name: 'Elvira (Natural HD - España)',
    displayName: 'Elvira (Natural HD - Reverente)',
    lang: 'es-ES',
    isDefault: false,
    isLocalService: false,
    score: 156,
    tier: 'TIER_1_NEURAL',
    tierLabel: 'Neural HD',
    isNeural: true,
  },
  {
    voiceIndex: -105,
    name: 'Paloma (Natural HD - Latam)',
    displayName: 'Paloma (Natural HD - Meditación)',
    lang: 'es-US',
    isDefault: false,
    isLocalService: false,
    score: 154,
    tier: 'TIER_1_NEURAL',
    tierLabel: 'Neural HD',
    isNeural: true,
  },
  {
    voiceIndex: -106,
    name: 'Gonzalo (Natural HD - Colombia)',
    displayName: 'Gonzalo (Natural HD - Colombia Cálido)',
    lang: 'es-CO',
    isDefault: false,
    isLocalService: false,
    score: 152,
    tier: 'TIER_1_NEURAL',
    tierLabel: 'Neural HD',
    isNeural: true,
  },
  {
    voiceIndex: -107,
    name: 'Salomé (Natural HD - Colombia)',
    displayName: 'Salomé (Natural HD - Serena)',
    lang: 'es-CO',
    isDefault: false,
    isLocalService: false,
    score: 150,
    tier: 'TIER_1_NEURAL',
    tierLabel: 'Neural HD',
    isNeural: true,
  },
];

const TIER1_NEURAL_KEYWORDS = [
  'natural',
  'neural',
  'online',
  'multilingual',
  'sabina',
  'dalia',
  'jorge',
  'alvaro',
  'elvira',
  'paulina',
  'mónica (mejorada)',
  'monica (mejorada)',
  'google español',
  'google es',
  'network',
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
  if (voice.localService) {
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
  if (isPreferredRegion && voice.localService) {
    return {
      tier: 'TIER_2_REGIONAL',
      tierLabel: 'Regional Limpia',
      isNeural: false,
    };
  }

  return {
    tier: 'TIER_3_STANDARD',
    tierLabel: 'Estándar',
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
      const isNet = cleanName.toLowerCase().includes('network');

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

      cleanName = `Español (${regLabel}) - ${gender}${variantTag}${isNet ? ' HD' : ''}`;
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
