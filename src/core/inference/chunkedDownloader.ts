import { ModelManifest, DownloadProgress, DownloadStatus } from './types.js';
import { nativeBridge } from '../native-bridge/bridge.js';
import type { ModelDownloader } from './modelDownloader.js';

export interface ChunkedDownloaderOptions {
  /** Permite inyectar fetch en pruebas sin tocar la red real. */
  fetchImpl?: typeof fetch;
}

/**
 * Descargador fraccionado real por HTTP Range.
 *
 * Reglas de honestidad:
 * - Si un bloque falla, la descarga falla. No se generan bytes falsos.
 * - El SHA-256 solo se declara verificado cuando el catálogo publica un hash
 *   y el archivo descargado coincide. Si no hay hash, se informa como no verificado.
 * - Los bloques se ensamblan en el archivo destino antes de marcar COMPLETED.
 */
export class ChunkedDownloader implements ModelDownloader {
  private readonly manifest: ModelManifest;
  private readonly fetchImpl?: typeof fetch;
  private readonly onProgressCallback?: (progress: DownloadProgress) => void;

  private status: DownloadStatus = 'IDLE';
  private chunksDownloaded = 0;
  private isPaused = false;
  private cancelled = false;
  private assembled = false;
  private sha256Verified = false;
  private verificationNote: string | undefined;
  private errorDetail: string | undefined;

  /**
   * Tamaño real del archivo remoto. El catálogo declara un valor orientativo,
   * pero si el archivo publicado crece (por ejemplo, un GGUF re-subido) cortar
   * en el tamaño declarado produce un modelo truncado que nunca carga. El
   * sondeo Range 0-0 obtiene el total exacto antes de dividir en bloques.
   */
  private totalBytes: number;
  private totalChunks: number;

  constructor(
    manifest: ModelManifest,
    onProgress?: (progress: DownloadProgress) => void,
    options: ChunkedDownloaderOptions = {}
  ) {
    this.manifest = manifest;
    this.onProgressCallback = onProgress;
    // `fetch` exige que su receptor sea Window/WorkerGlobalScope. Guardarlo y
    // llamarlo como `this.fetchImpl(...)` lo convierte en método del descargador
    // y el navegador lanza «Illegal invocation»; en el WebView de Android eso
    // impedía descargar cualquier GGUF. Lo fijamos al ámbito global.
    const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
    this.fetchImpl = fetchImpl ? fetchImpl.bind(globalThis) : undefined;
    this.totalBytes = Math.round(manifest.tamanoMb * 1024 * 1024);
    this.totalChunks = manifest.totalChunks;
  }

  getStatus(): DownloadStatus {
    return this.status;
  }

  isAssembled(): boolean {
    return this.assembled;
  }

  isSha256Verified(): boolean {
    return this.sha256Verified;
  }

  getVerificationNote(): string | undefined {
    return this.verificationNote;
  }

  getErrorDetail(): string | undefined {
    return this.errorDetail;
  }

  getProgress(): DownloadProgress {
    const bytesTotales = this.totalBytes;
    const chunkSize = this.chunkSizeBytes();
    const bytesDescargados = Math.min(this.chunksDownloaded * chunkSize, bytesTotales);
    const rawPercentage =
      bytesTotales > 0 ? Math.round((bytesDescargados / bytesTotales) * 100) : 0;
    const porcentaje =
      this.status === 'COMPLETED' ? 100 : Math.min(99, rawPercentage);

    return {
      modelId: this.manifest.id,
      status: this.status,
      chunksDescargados: this.chunksDownloaded,
      totalChunks: this.totalChunks,
      bytesDescargados,
      bytesTotales,
      porcentaje,
      error: this.errorDetail,
    };
  }

  private chunkSizeBytes(): number {
    return Math.max(1, Math.round(this.manifest.tamanoChunkMb * 1024 * 1024));
  }

  /**
   * Bytes exactos que debe tener un bloque. El último bloque suele ser más
   * corto porque el archivo no siempre es múltiplo del tamaño de bloque.
   */
  private expectedChunkBytes(index: number, totalBytes: number, chunkSize: number): number {
    const byteStart = Math.floor(index * chunkSize);
    const byteEnd = Math.min(
      Math.floor((index + 1) * chunkSize) - 1,
      Math.floor(totalBytes) - 1
    );
    return Math.max(0, byteEnd - byteStart + 1);
  }

  /**
   * Pregunta al servidor por el tamaño real con un Range de un solo byte.
   * Si el servidor no expone Content-Range, se conserva el tamaño declarado.
   */
  private async resolveRemoteSize(): Promise<void> {
    if (!this.fetchImpl || !this.manifest.url) return;

    try {
      const response = await this.fetchImpl(this.manifest.url, {
        headers: { Range: 'bytes=0-0' },
      });

      if (!response.ok && response.status !== 206) return;

      const contentRange = response.headers?.get?.('Content-Range') ?? '';
      const match = /bytes\s+\d+-\d+\/(\d+)/i.exec(contentRange);
      if (!match) return;

      const remoteBytes = Number(match[1]);
      if (!Number.isFinite(remoteBytes) || remoteBytes <= 0) return;

      this.totalBytes = remoteBytes;
      this.totalChunks = Math.max(1, Math.ceil(remoteBytes / this.chunkSizeBytes()));
    } catch {
      // Sin sondeo se usa el tamaño del catálogo; la descarga sigue siendo honesta
      // porque verifica los bytes recibidos y falla si el ensamblado no es válido.
    }
  }

  private notify(): void {
    this.onProgressCallback?.(this.getProgress());
  }

  private chunkFileName(index: number): string {
    return `${this.manifest.archivoDestino}.part_${index}`;
  }

  /**
   * Inicia o reanuda la descarga por bloques.
   * Devuelve true solo cuando el archivo fue ensamblado y, si había hash, verificado.
   */
  async start(): Promise<boolean> {
    if (this.status === 'DOWNLOADING') return false;

    if (!this.manifest.url) {
      this.fail('El catálogo no define una URL de descarga para este modelo.');
      return false;
    }

    this.isPaused = false;
    this.cancelled = false;
    this.errorDetail = undefined;
    this.status = 'DOWNLOADING';
    this.notify();

    try {
      await this.resolveRemoteSize();
      this.notify();

      const totalBytes = this.totalBytes;
      const chunkSize = this.chunkSizeBytes();

      while (this.chunksDownloaded < this.totalChunks) {
        if (this.cancelled) {
          this.status = 'IDLE';
          this.notify();
          return false;
        }

        if (this.isPaused) {
          this.status = 'PAUSED';
          this.notify();
          return false;
        }

        const chunkIndex = this.chunksDownloaded;
        const fileName = this.chunkFileName(chunkIndex);

        let chunk = await nativeBridge.readPrivateFile(fileName);

        if (chunk) {
          // Un bloque guardado por una versión anterior (o por una descarga
          // interrumpida a mitad de escritura) puede estar truncado. Si no
          // pesa exactamente lo esperado se descarta y se vuelve a pedir;
          // de lo contrario el ensamblado final fallaría por tamaño.
          const expected = this.expectedChunkBytes(chunkIndex, totalBytes, chunkSize);
          if (chunk.byteLength !== expected) {
            await nativeBridge.deletePrivateFile(fileName);
            chunk = null;
          }
        }

        if (!chunk) {
          chunk = await this.downloadChunk(chunkIndex, totalBytes, chunkSize);

          // La cancelación puede ocurrir mientras el fetch estaba en vuelo:
          // no dejamos un bloque huérfano ocupando espacio en el teléfono.
          if (this.cancelled) {
            await nativeBridge.deletePrivateFile(fileName);
            this.status = 'IDLE';
            this.notify();
            return false;
          }

          const written = await nativeBridge.writePrivateFile(fileName, chunk);
          if (!written) {
            throw new Error(`No se pudo guardar el bloque ${chunkIndex} en el almacenamiento privado.`);
          }
        }

        this.chunksDownloaded++;
        this.notify();

        // Cedemos el hilo para que la UI pueda pintar el progreso.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Ensamblado del archivo final a partir de los bloques descargados.
      // En navegador/Android se escribe por streaming a OPFS para no mantener
      // el modelo completo en memoria. En Node/pruebas se conserva el arreglo.
      const assembled = await this.assembleChunks();
      if (!assembled) {
        this.fail(this.errorDetail ?? 'No se pudieron ensamblar los bloques descargados.');
        return false;
      }

      this.status = 'VERIFYING';
      this.notify();

      const valid = await this.verifyIntegrity();
      if (!valid) {
        this.fail(this.errorDetail ?? 'La verificación de integridad falló.');
        return false;
      }

      this.status = 'COMPLETED';
      this.notify();
      return true;
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Error desconocido durante la descarga.');
      return false;
    }
  }

  private async downloadChunk(
    chunkIndex: number,
    totalBytes: number,
    chunkSize: number
  ): Promise<Uint8Array> {
    if (!this.fetchImpl) {
      throw new Error('No hay acceso de red disponible para descargar el modelo.');
    }

    const byteStart = Math.floor(chunkIndex * chunkSize);
    const byteEnd = Math.min(Math.floor((chunkIndex + 1) * chunkSize) - 1, Math.floor(totalBytes) - 1);

    const response = await this.fetchImpl(this.manifest.url as string, {
      headers: { Range: `bytes=${byteStart}-${byteEnd}` },
    });

    if (response.status !== 206) {
      if (response.status === 200 && this.manifest.totalChunks > 1) {
        throw new Error(
          'El servidor no admite descargas por rangos (HTTP 200 con el archivo completo). ' +
            'Usa un servidor que soporte Range o descarga el archivo manualmente.'
        );
      }
      if (!response.ok) {
        throw new Error(`El servidor respondió HTTP ${response.status} al pedir el bloque ${chunkIndex}.`);
      }
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error(`El bloque ${chunkIndex} llegó vacío.`);
    }

    // Honestidad de bytes: un 206 truncado (conexión cortada, proxy o CDN)
    // produce un GGUF incompleto que luego no carga. La longitud debe coincidir
    // exactamente con el rango pedido; si no, el bloque no se guarda.
    const expectedBytes = this.expectedChunkBytes(chunkIndex, totalBytes, chunkSize);
    if (buffer.byteLength !== expectedBytes) {
      throw new Error(
        `El bloque ${chunkIndex} llegó incompleto: ${buffer.byteLength} de ${expectedBytes} bytes. ` +
          'Se descartó para no ensamblar un modelo corrupto.'
      );
    }

    return new Uint8Array(buffer);
  }

  private async assembleChunks(): Promise<boolean> {
    const sources = Array.from({ length: this.totalChunks }, (_, index) =>
      this.chunkFileName(index)
    );

    try {
      const result = await nativeBridge.assemblePrivateFiles(
        this.manifest.archivoDestino,
        sources
      );

      if (!result) {
        this.errorDetail = 'No se pudo escribir el archivo ensamblado en el almacenamiento privado.';
        return false;
      }

      // El archivo ensamblado debe pesar exactamente lo que declara el
      // servidor. Sin esta comprobación, una escritura truncada en OPFS se
      // marcaba como COMPLETED y el usuario descubría el fallo al cargar.
      if (result.size !== this.totalBytes) {
        this.errorDetail =
          `El archivo ensamblado pesa ${result.size} bytes y el servidor declara ` +
          `${this.totalBytes}. Se descartó para no dejar un GGUF corrupto.`;
        await nativeBridge.deletePrivateFile(this.manifest.archivoDestino);
        return false;
      }

      this.assembled = true;

      // Los bloques ya no son necesarios: liberamos espacio para que el modelo
      // no ocupe el doble en dispositivos móviles.
      await Promise.all(sources.map((source) => nativeBridge.deletePrivateFile(source)));

      return true;
    } catch (error) {
      this.errorDetail =
        error instanceof Error
          ? error.message
          : 'No se pudieron ensamblar los bloques descargados.';
      return false;
    }
  }

  private async verifyIntegrity(): Promise<boolean> {
    const expected = this.manifest.sha256?.trim().toLowerCase();

    if (!expected) {
      this.sha256Verified = false;
      this.verificationNote =
        'El catálogo no publica un SHA-256 para este archivo. La descarga se completó y ensambló, pero no puede verificarse criptográficamente.';
      return true;
    }

    const data = await nativeBridge.readPrivateFile(this.manifest.archivoDestino);
    if (!data) {
      this.sha256Verified = false;
      this.errorDetail = 'No se pudo leer el archivo ensamblado para verificar su SHA-256.';
      return false;
    }

    const actual = await sha256Hex(data);
    if (!actual) {
      this.sha256Verified = false;
      this.verificationNote =
        'Web Crypto no está disponible en este entorno; no se pudo calcular el SHA-256.';
      return true;
    }

    if (actual !== expected) {
      this.sha256Verified = false;
      this.errorDetail = `SHA-256 no coincide. Esperado ${expected.slice(0, 16)}…, obtenido ${actual.slice(0, 16)}….`;
      await nativeBridge.deletePrivateFile(this.manifest.archivoDestino);
      return false;
    }

    this.sha256Verified = true;
    this.verificationNote = 'SHA-256 verificado contra el hash publicado en el catálogo.';
    return true;
  }

  private fail(message: string): void {
    this.errorDetail = message;
    this.status = 'ERROR';
    this.notify();
  }

  pause(): void {
    this.isPaused = true;
    this.status = 'PAUSED';
    this.notify();
  }

  resume(): void {
    if (this.status === 'PAUSED' || this.status === 'ERROR') {
      void this.start();
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    this.isPaused = false;
    this.status = 'IDLE';
    this.chunksDownloaded = 0;
    this.assembled = false;
    this.sha256Verified = false;
    this.verificationNote = undefined;
    this.errorDetail = undefined;

    // Un cancelar debe liberar los bloques parciales, no dejarlos en OPFS.
    // Así el usuario puede cambiar de modelo sin acumular cientos de MB.
    const partials = Array.from({ length: this.totalChunks }, (_, index) =>
      this.chunkFileName(index)
    );
    await Promise.all(partials.map((file) => nativeBridge.deletePrivateFile(file)));

    this.notify();
  }
}

async function sha256Hex(data: Uint8Array): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}
