import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { ChunkedDownloader } from '../core/inference/chunkedDownloader.js';
import { ModelManifest } from '../core/inference/types.js';
import { nativeBridge } from '../core/native-bridge/bridge.js';

let counter = 0;

function makeManifest(overrides: Partial<ModelManifest> = {}): ModelManifest {
  counter += 1;
  const totalChunks = overrides.totalChunks ?? 3;
  const tapanoChunkMb = 1 / 1024; // 1 KB por bloque
  const tamanoMb = (totalChunks * 1024) / (1024 * 1024);

  return {
    id: 'ULTRALIGHT',
    nombre: `Prueba ${counter}`,
    descripcion: 'Manifiesto pequeño para pruebas',
    tamanoMb,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: 'test',
    contextoMaxTokens: 1024,
    ramMinimaRequeridaMb: 1024,
    totalChunks,
    tamanoChunkMb: tapanoChunkMb,
    sha256: '',
    archivoDestino: `download_honesty_${counter}.gguf`,
    url: 'https://example.test/model.gguf',
    ...overrides,
  };
}

function chunkFetch(options: { delayMs?: number; fail?: boolean; status?: number } = {}): typeof fetch {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (options.fail) {
      throw new Error('sin conexión');
    }

    const range = new Headers(init?.headers).get('Range') || '';
    const match = /bytes=(\d+)-(\d+)/.exec(range);
    const start = match ? Number(match[1]) : 0;
    const end = match ? Number(match[2]) : 1023;

    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    const size = Math.max(0, Math.min(1024, end - start + 1));
    const buffer = new ArrayBuffer(size);
    new Uint8Array(buffer).fill((start / 1024 + 1) % 256);

    return {
      ok: (options.status ?? 206) < 400,
      status: options.status ?? 206,
      arrayBuffer: async () => buffer,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

describe('Descargador — honestidad de bloques, ensamblado y SHA-256', () => {
  it('falla de verdad si la red falla, sin inventar bloques', async () => {
    const manifest = makeManifest();
    const downloader = new ChunkedDownloader(manifest, undefined, {
      fetchImpl: chunkFetch({ fail: true }),
    });

    const success = await downloader.start();

    expect(success).toBe(false);
    expect(downloader.getStatus()).toBe('ERROR');
    expect(downloader.getProgress().chunksDescargados).toBe(0);
    expect(downloader.getErrorDetail()).toContain('sin conexión');
  });

  it('llama a fetch con el ámbito global, no como método del descargador', async () => {
    // Regresión: en Chrome/Android WebView, `this.fetchImpl(...)` convierte
    // fetch en método del descargador y el navegador lanza «Illegal invocation».
    const manifest = makeManifest({ totalChunks: 1 });
    let receiver: unknown = null;

    const fetchImpl = vi.fn(function (this: unknown) {
      receiver = this;
      const buffer = new ArrayBuffer(1024);
      return Promise.resolve({
        ok: true,
        status: 206,
        arrayBuffer: async () => buffer,
      } as unknown as Response);
    }) as unknown as typeof fetch;

    const downloader = new ChunkedDownloader(manifest, undefined, { fetchImpl });
    const success = await downloader.start();

    expect(success).toBe(true);
    expect(receiver).toBe(globalThis);
  });

  it('rechaza un bloque 206 truncado en lugar de ensamblar un GGUF incompleto', async () => {
    const manifest = makeManifest({ totalChunks: 1 });
    const fetchImpl = vi.fn(async () => {
      const buffer = new ArrayBuffer(512); // se pidieron 1024 bytes
      return {
        ok: true,
        status: 206,
        arrayBuffer: async () => buffer,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const downloader = new ChunkedDownloader(manifest, undefined, { fetchImpl });
    const success = await downloader.start();

    expect(success).toBe(false);
    expect(downloader.getStatus()).toBe('ERROR');
    expect(downloader.getErrorDetail()).toContain('incompleto');
    expect(await nativeBridge.hasPrivateFile(`${manifest.archivoDestino}.part_0`)).toBe(false);
  });

  it('falla si el archivo ensamblado no pesa lo que declara el servidor', async () => {
    const manifest = makeManifest({ totalChunks: 2 });
    const spy = vi
      .spyOn(nativeBridge, 'assemblePrivateFiles')
      .mockResolvedValue({ size: 1234 });

    try {
      const downloader = new ChunkedDownloader(manifest, undefined, {
        fetchImpl: chunkFetch(),
      });
      const success = await downloader.start();

      expect(success).toBe(false);
      expect(downloader.getStatus()).toBe('ERROR');
      expect(downloader.getErrorDetail()).toContain('pesa');
      expect(await nativeBridge.hasPrivateFile(manifest.archivoDestino)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('descubre el tamaño real por Content-Range y no trunca el archivo si creció', async () => {
    const manifest = makeManifest({ totalChunks: 2 });
    const remoteSize = 3072; // 3 KB: el catálogo declara 2 KB

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const range = new Headers(init?.headers).get('Range') || '';
      const match = /bytes=(\d+)-(\d+)/.exec(range);
      const start = match ? Number(match[1]) : 0;
      const requestedEnd = match ? Number(match[2]) : remoteSize - 1;
      const end = Math.min(requestedEnd, remoteSize - 1);
      const buffer = new ArrayBuffer(Math.max(0, end - start + 1));
      new Uint8Array(buffer).fill((start / 1024 + 1) % 256);

      return {
        ok: true,
        status: 206,
        headers: new Headers({
          'Content-Range': `bytes ${start}-${end}/${remoteSize}`,
        }),
        arrayBuffer: async () => buffer,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const downloader = new ChunkedDownloader(manifest, undefined, { fetchImpl });
    const success = await downloader.start();

    expect(success).toBe(true);
    expect(downloader.getProgress().totalChunks).toBe(3);
    expect(downloader.getProgress().bytesTotales).toBe(remoteSize);

    const assembled = await nativeBridge.readPrivateFile(manifest.archivoDestino);
    expect(assembled?.byteLength).toBe(remoteSize);
  });

  it('cancelar libera los bloques parciales y no deja la descarga en PAUSED', async () => {
    const manifest = makeManifest({ totalChunks: 4 });
    const downloader = new ChunkedDownloader(manifest, undefined, {
      fetchImpl: chunkFetch({ delayMs: 15 }),
    });

    const run = downloader.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await downloader.cancel();
    const success = await run;

    expect(success).toBe(false);
    expect(downloader.getStatus()).toBe('IDLE');
    for (let index = 0; index < manifest.totalChunks; index++) {
      expect(await nativeBridge.hasPrivateFile(`${manifest.archivoDestino}.part_${index}`)).toBe(
        false
      );
    }
  });

  it('rechaza servidores que ignoran Range y devuelven el archivo completo', async () => {
    const manifest = makeManifest();
    const downloader = new ChunkedDownloader(manifest, undefined, {
      fetchImpl: chunkFetch({ status: 200 }),
    });

    const success = await downloader.start();

    expect(success).toBe(false);
    expect(downloader.getStatus()).toBe('ERROR');
    expect(downloader.getErrorDetail()).toContain('rangos');
  });

  it('descarta un bloque parcial truncado y lo vuelve a descargar al reanudar', async () => {
    const manifest = makeManifest({ totalChunks: 2 });
    // Simula un bloque guardado por una versión anterior a mitad de escritura.
    await nativeBridge.writePrivateFile(
      `${manifest.archivoDestino}.part_0`,
      new Uint8Array(512)
    );

    const downloader = new ChunkedDownloader(manifest, undefined, {
      fetchImpl: chunkFetch(),
    });
    const success = await downloader.start();

    expect(success).toBe(true);
    expect(downloader.getStatus()).toBe('COMPLETED');
    const assembled = await nativeBridge.readPrivateFile(manifest.archivoDestino);
    expect(assembled?.byteLength).toBe(2048);
  });

  it('ensambla el archivo final y verifica el SHA-256 cuando el catálogo lo publica', async () => {
    const manifest = makeManifest({ totalChunks: 3 });

    const expected = new Uint8Array(3072);
    for (let index = 0; index < 3; index++) {
      expected.fill(index + 1, index * 1024, (index + 1) * 1024);
    }
    manifest.sha256 = sha256(expected);

    const downloader = new ChunkedDownloader(manifest, undefined, {
      fetchImpl: chunkFetch(),
    });

    const success = await downloader.start();

    expect(success).toBe(true);
    expect(downloader.getStatus()).toBe('COMPLETED');
    expect(downloader.isAssembled()).toBe(true);
    expect(downloader.isSha256Verified()).toBe(true);

    const assembled = await nativeBridge.readPrivateFile(manifest.archivoDestino);
    expect(assembled).not.toBeNull();
    expect(Array.from(assembled ?? [])).toEqual(Array.from(expected));
  });

  it('marca ERROR si el SHA-256 no coincide', async () => {
    const manifest = makeManifest({
      totalChunks: 2,
      sha256: '0'.repeat(64),
    });

    const downloader = new ChunkedDownloader(manifest, undefined, {
      fetchImpl: chunkFetch(),
    });

    const success = await downloader.start();

    expect(success).toBe(false);
    expect(downloader.getStatus()).toBe('ERROR');
    expect(downloader.isSha256Verified()).toBe(false);
    expect(downloader.getErrorDetail()).toContain('SHA-256 no coincide');
  });

  it('completa sin declarar verificación criptográfica si no hay hash publicado', async () => {
    const manifest = makeManifest({ totalChunks: 2, sha256: '' });
    const downloader = new ChunkedDownloader(manifest, undefined, {
      fetchImpl: chunkFetch(),
    });

    const success = await downloader.start();

    expect(success).toBe(true);
    expect(downloader.getStatus()).toBe('COMPLETED');
    expect(downloader.isSha256Verified()).toBe(false);
    expect(downloader.getVerificationNote()).toContain('no publica');
  });
});
