/**
 * Caché LRU de composiciones deterministas.
 *
 * Una exégesis o un sermón compuesto desde SQLite no cambia entre solicitudes
 * idénticas. Guardar el resultado evita volver a recorrer catálogo, pasajes y
 * plantillas cuando el usuario repite una consulta o alterna entre pestañas.
 * Es solo memoria de sesión: el texto no depende de la versión de la Biblia
 * porque las citas se insertan después con el inyector.
 */
const MAX_ENTRIES = 24;

class CompositionCache {
  private entries = new Map<string, string>();

  getOrCreate(key: string, factory: () => string): string {
    const hit = this.entries.get(key);
    if (hit !== undefined) {
      // Reinsertar para que el Map conserve el orden de uso (LRU).
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit;
    }

    const value = factory();
    this.entries.set(key, value);

    if (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }

    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

export const compositionCache = new CompositionCache();
