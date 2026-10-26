export type ProsodyChunkKind = 'title' | 'verse' | 'narrative';

export interface ProsodyChunk {
  id: string;
  text: string;
  kind: ProsodyChunkKind;
  rate: number;
  pitch: number;
  pauseAfterMs: number;
}

/**
 * Diccionario Fonético Teológico Ampliado
 * Garantiza pronunciación reverente de raíces hebreas, griegas y libros numerados
 */
const NUMBERED_BOOKS_MAP: [RegExp, string][] = [
  // Epístolas y libros con número
  [/\b1\s*Jn\b|\b1\s*Juan\b/gi, 'Primera de Juan'],
  [/\b2\s*Jn\b|\b2\s*Juan\b/gi, 'Segunda de Juan'],
  [/\b3\s*Jn\b|\b3\s*Juan\b/gi, 'Tercera de Juan'],
  [/\b1\s*Co\b|\b1\s*Cor\b|\b1\s*Corintios\b/gi, 'Primera de Corintios'],
  [/\b2\s*Co\b|\b2\s*Cor\b|\b2\s*Corintios\b/gi, 'Segunda de Corintios'],
  [/\b1\s*Pe\b|\b1\s*Ped\b|\b1\s*Pedro\b/gi, 'Primera de Pedro'],
  [/\b2\s*Pe\b|\b2\s*Ped\b|\b2\s*Pedro\b/gi, 'Segunda de Pedro'],
  [/\b1\s*Ts\b|\b1\s*Tes\b|\b1\s*Tesalonicenses\b/gi, 'Primera de Tesalonicenses'],
  [/\b2\s*Ts\b|\b2\s*Tes\b|\b2\s*Tesalonicenses\b/gi, 'Segunda de Tesalonicenses'],
  [/\b1\s*Ti\b|\b1\s*Tim\b|\b1\s*Timoteo\b/gi, 'Primera de Timoteo'],
  [/\b2\s*Ti\b|\b2\s*Tim\b|\b2\s*Timoteo\b/gi, 'Segunda de Timoteo'],
  [/\b1\s*S\b|\b1\s*Sam\b|\b1\s*Samuel\b/gi, 'Primer libro de Samuel'],
  [/\b2\s*S\b|\b2\s*Sam\b|\b2\s*Samuel\b/gi, 'Segundo libro de Samuel'],
  [/\b1\s*R\b|\b1\s*Rey\b|\b1\s*Reyes\b/gi, 'Primer libro de los Reyes'],
  [/\b2\s*R\b|\b2\s*Rey\b|\b2\s*Reyes\b/gi, 'Segundo libro de los Reyes'],
  [/\b1\s*Cr\b|\b1\s*Cron\b|\b1\s*Crónicas\b|\b1\s*Cronicas\b/gi, 'Primer libro de las Crónicas'],
  [/\b2\s*Cr\b|\b2\s*Cron\b|\b2\s*Crónicas\b|\b2\s*Cronicas\b/gi, 'Segundo libro de las Crónicas'],
];

const THEOLOGICAL_PHONETICS: [RegExp, string][] = [
  // Nombre Sagrado Divino y Compuestos Teofónicos (Evita deletreo como sigla en motores TTS)
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ][- ](?:JIREH|YIREH)(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová Yiré'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ][- ](?:RAPHA|RAFA)(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová Rafa'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ][- ](?:NISSI|NISI)(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová Nisí'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ][- ]SHALOM(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová Shalóm'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ][- ]TSIDKENU(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová Tsidkenu'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ][- ]SABAOTH(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová Sabaot'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ][- ]SHAMMAH(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová Samá'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JEHOV[AÁ](?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jehová'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])Jehova(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/gu, 'Jehová'],

  // Nombres Divinos y Términos en Mayúsculas (para prevenir deletreo en síntesis vocal)
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])SEÑOR(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/gu, 'Señor'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])DIOS(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/gu, 'Dios'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JESUCRISTO(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jesucristo'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])JES[UÚ]S(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Jesús'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])CRISTO(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/gu, 'Cristo'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])ESP[IÍ]RITU SANTO(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Espíritu Santo'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])AM[EÉ]N(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Amén'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])ALELUYA(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Aleluya'],
  [/(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])HOSANNA(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/giu, 'Hosanna'],

  // Raíces Hebreas
  [/\bshalom\b/gi, 'Shalóm'],
  [/\bkhesed\b|\bhesed\b|\bchesed\b/gi, 'Jésed'],
  [/\bbara\b/gi, 'Bará'],
  [/\belohim\b/gi, 'Elohím'],
  [/\badonai\b/gi, 'Adonái'],
  [/\bel[- ]shaddai\b/gi, 'El Shaddái'],
  [/\bel[- ]elyon\b/gi, 'El Elyón'],
  [/\byahweh\b|\byhwh\b|\byahveh\b/gi, 'Yahvé'],
  [/\breshith\b|\breshit\b/gi, 'Reshít'],
  [/\bshekinah\b/gi, 'Shejiná'],

  // Raíces Griegas
  [/\bagape\b/gi, 'Agápe'],
  [/\bpistis\b/gi, 'Pístis'],
  [/\bbasileia\b/gi, 'Basiléia'],
  [/\bmathetes\b/gi, 'Mathetés'],
  [/\bpneuma\b/gi, 'Pnéuma'],
  [/\bcharis\b/gi, 'Járis'],
  [/\bzoe\b/gi, 'Zoé'],
  [/\beirene\b/gi, 'Eiréne'],
  [/\bkoine\b/gi, 'Koiné'],

  // Siglas de versiones
  [/\bRV1909\b/g, 'Reina Valera 1909'],
  [/\bRVR60\b/g, 'Reina Valera 1960'],
  [/\bNVI\b/g, 'Nueva Versión Internacional'],
  [/\bLBLA\b/g, 'La Biblia de las Américas'],
];

/**
 * Normaliza y expande texto teológico para locución hablada humana
 */
export function cleanPhonetics(text: string): string {
  if (!text) return '';

  let out = text;

  // 1. Expandir etiquetas de citas canónicas completas [CITA: 1 Juan 1:9]
  out = out.replace(
    /\[CITA:\s*([^\]]+?)\s+(\d+)[:.](\d+)(?:-(\d+))?\]/gi,
    (_full, rawBook, cap, vInit, vEnd) => {
      let bookName = rawBook.trim();
      for (const [pattern, replacement] of NUMBERED_BOOKS_MAP) {
        if (pattern.test(bookName)) {
          bookName = bookName.replace(pattern, replacement);
          break;
        }
      }
      if (vEnd) {
        return `${bookName}, capítulo ${cap}, versículos del ${vInit} al ${vEnd}. `;
      }
      return `${bookName}, capítulo ${cap}, versículo ${vInit}. `;
    }
  );

  // 2. Expandir citas naturales tipo "1 Co 13:4" o "Jn 3:16"
  out = out.replace(
    /\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñ]{2,14})\s+(\d+)[:.](\d+)(?:-(\d+))?\b/g,
    (_match, bookStr, cap, vInit, vEnd) => {
      let bookName = bookStr.trim();
      let matched = false;

      for (const [pattern, replacement] of NUMBERED_BOOKS_MAP) {
        if (pattern.test(bookName)) {
          bookName = bookName.replace(pattern, replacement);
          matched = true;
          break;
        }
      }

      if (!matched) {
        const b = bookName.toLowerCase();
        if (b === 'gn' || b === 'gen') bookName = 'Génesis';
        else if (b === 'ex' || b === 'exo') bookName = 'Éxodo';
        else if (b === 'sal' || b === 'salm') bookName = 'Salmos';
        else if (b === 'pr' || b === 'prov') bookName = 'Proverbios';
        else if (b === 'is' || b === 'isa') bookName = 'Isaías';
        else if (b === 'mt' || b === 'mat') bookName = 'Mateo';
        else if (b === 'mr' || b === 'mc') bookName = 'Marcos';
        else if (b === 'lc' || b === 'luc') bookName = 'Lucas';
        else if (b === 'jn') bookName = 'Juan';
        else if (b === 'hch' || b === 'hec') bookName = 'Hechos';
        else if (b === 'ro' || b === 'rom') bookName = 'Romanos';
        else if (b === 'ef') bookName = 'Efesios';
        else if (b === 'flp' || b === 'fil') bookName = 'Filipenses';
        else if (b === 'cl' || b === 'col') bookName = 'Colosenses';
        else if (b === 'hb' || b === 'heb') bookName = 'Hebreos';
        else if (b === 'ap' || b === 'apoc') bookName = 'Apocalipsis';
      }

      if (vEnd) {
        return `${bookName}, capítulo ${cap}, versículos del ${vInit} al ${vEnd}`;
      }
      return `${bookName}, capítulo ${cap}, versículo ${vInit}`;
    }
  );

  // 3. Aplicar reemplazos de nombres de libros numerados en menciones libres (ej. "1 Juan dice...")
  for (const [pattern, replacement] of NUMBERED_BOOKS_MAP) {
    out = out.replace(pattern, replacement);
  }

  // 4. Aplicar pronunciación fonética teológica
  for (const [pattern, replacement] of THEOLOGICAL_PHONETICS) {
    out = out.replace(pattern, replacement);
  }

  // 5. Limpiar sintaxis de markdown que arruina la síntesis vocal
  out = out.replace(/#{1,6}\s+/g, '');
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/\*([^*]+)\*/g, '$1');
  out = out.replace(/^>\s*/gm, '');
  out = out.replace(/`([^`]+)`/g, '$1');
  out = out.replace(/[-*•]\s+/g, ', ');
  out = out.replace(/«|»|"/g, '');

  return out.trim();
}

/**
 * Segmentador Prosódico Pastoral (ProsodyChunker)
 * Divide un texto en bloques expresivos aplicando modulación tonal y pausas respiratorias
 */
export class ProsodyChunker {
  /**
   * Limpia y segmenta un texto largo en chunks prosódicos
   */
  static chunk(rawText: string): ProsodyChunk[] {
    if (!rawText || !rawText.trim()) return [];

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const chunks: ProsodyChunk[] = [];
    let chunkIdCounter = 0;

    for (const line of lines) {
      // 1. Detectar títulos y encabezados de sección
      if (line.startsWith('#') || line.startsWith('**Tema') || line.startsWith('**Propósito')) {
        const cleaned = cleanPhonetics(line);
        if (cleaned) {
          chunks.push({
            id: `chunk_${++chunkIdCounter}`,
            text: cleaned,
            kind: 'title',
            rate: 0.93,
            pitch: 1.0,
            pauseAfterMs: 400,
          });
        }
        continue;
      }

      // 2. Detectar versículos bíblicos (citas textuales en blockquote o entre comillas)
      const isVerseBlock = line.startsWith('>') || line.includes('«') || line.includes('[CITA:');
      if (isVerseBlock) {
        const cleaned = cleanPhonetics(line);
        if (cleaned) {
          chunks.push({
            id: `chunk_${++chunkIdCounter}`,
            text: cleaned,
            kind: 'verse',
            rate: 0.91, // Más pausado y solemne
            pitch: 0.94, // Tono más cálido y grave
            pauseAfterMs: 500, // Pausa solemne antes de continuar
          });
        }
        continue;
      }

      // 3. Texto narrativo general: separar por oraciones si es largo
      const sentences = line.match(/[^.!?]+[.!?]+|\S+$/g) || [line];
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        const cleaned = cleanPhonetics(trimmed);
        if (cleaned) {
          chunks.push({
            id: `chunk_${++chunkIdCounter}`,
            text: cleaned,
            kind: 'narrative',
            rate: 0.96, // Sereno y cálido
            pitch: 0.98,
            pauseAfterMs: 350, // Pausa respiratoria entre frases
          });
        }
      }
    }

    return chunks;
  }
}
