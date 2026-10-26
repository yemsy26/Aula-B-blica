/**
 * Utilidad segura para copiar texto al portapapeles sin riesgo de TypeError
 * compatible con navegadores de escritorio, móviles, webviews y conexiones no-HTTPS.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Intentar API moderna navigator.clipboard
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Si falla o no tiene permisos, pasar al fallback
  }

  // 2. Fallback con textarea temporal y document.execCommand('copy')
  try {
    if (typeof document === 'undefined') return false;

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('No se pudo copiar al portapapeles:', err);
    return false;
  }
}
