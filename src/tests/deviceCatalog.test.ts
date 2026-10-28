import { describe, it, expect } from 'vitest';
import {
  buildDeviceCatalog,
  resolveInferenceRuntime,
  selectAdaptiveModel,
} from '../core/inference/modelRegistry.js';
import { DeviceSystemInfo } from '../core/native-bridge/types.js';

const baseInfo: DeviceSystemInfo = {
  platform: 'web',
  estimatedRamMb: 8192,
  isLowEndDevice: false,
  cpuCores: 8,
};

const desktopIsolated: DeviceSystemInfo = {
  ...baseInfo,
  platform: 'web',
  crossOriginIsolated: true,
  sharedArrayBuffer: true,
};

const desktopSingleThread: DeviceSystemInfo = {
  ...baseInfo,
  crossOriginIsolated: false,
  sharedArrayBuffer: false,
};

describe('Catálogo de cerebros según el runtime real', () => {
  it('en PC aislado ofrece los cuatro tamaños y recomienda 3B en 8GB', () => {
    const catalog = buildDeviceCatalog(desktopIsolated);

    expect(catalog.runtime.multithread).toBe(true);
    expect(catalog.runtime.threads).toBe(7);
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
      'ADVANCED_4B',
      'MAX_8B',
    ]);
    expect(catalog.recommended.id).toBe('ADVANCED_4B');
    expect(catalog.hiddenEntries).toHaveLength(0);

    const maximum = catalog.entries.find((entry) => entry.id === 'MAX_8B');
    expect(maximum?.warning).toContain('8 GB');
  });

  it('en PC sin COOP/COEP solo ofrece 0.5B y 1.5B y explica que falta multihilo', () => {
    const catalog = buildDeviceCatalog(desktopSingleThread);

    expect(catalog.runtime.multithread).toBe(false);
    expect(catalog.runtime.threads).toBe(1);
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
    ]);
    expect(catalog.recommended.id).toBe('STANDARD');

    const advanced = catalog.entries.find((entry) => entry.id === 'ADVANCED_4B');
    expect(advanced?.usable).toBe(false);
    expect(advanced?.blocker).toContain('un solo hilo');
    expect(catalog.hiddenSummary).toContain('COOP/COEP');
  });

  it('en PC aislado con 4GB oculta 3B y 7B por RAM', () => {
    const catalog = buildDeviceCatalog({
      ...desktopIsolated,
      estimatedRamMb: 4096,
      cpuCores: 4,
    });

    expect(catalog.runtime.threads).toBe(3);
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
    ]);
    expect(catalog.recommended.id).toBe('STANDARD');
    expect(catalog.hiddenEntries.map((entry) => entry.id)).toEqual([
      'ADVANCED_4B',
      'MAX_8B',
    ]);
  });

  it('en PC con 2GB solo deja 0.5B', () => {
    const catalog = buildDeviceCatalog({
      ...desktopIsolated,
      estimatedRamMb: 2048,
      cpuCores: 4,
    });

    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual(['ULTRALIGHT']);
    expect(catalog.recommended.id).toBe('ULTRALIGHT');
  });

  it('en Android de 8GB solo ofrece 0.5B y mantiene un hilo', () => {
    const catalog = buildDeviceCatalog({
      platform: 'android',
      estimatedRamMb: 8192,
      isLowEndDevice: false,
      cpuCores: 8,
      crossOriginIsolated: false,
      sharedArrayBuffer: false,
    });

    expect(catalog.runtime.isMobile).toBe(true);
    expect(catalog.runtime.multithread).toBe(false);
    expect(catalog.runtime.threads).toBe(1);
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual(['ULTRALIGHT']);
    expect(catalog.recommended.id).toBe('ULTRALIGHT');
    expect(catalog.statusMessage).toContain('un solo hilo');
    expect(selectAdaptiveModel({
      platform: 'android',
      estimatedRamMb: 8192,
      isLowEndDevice: false,
    }).id).toBe('ULTRALIGHT');
  });

  it('si un Android futuro tuviera aislamiento y 6GB, ofrecería hasta 1.5B', () => {
    const catalog = buildDeviceCatalog({
      platform: 'android',
      estimatedRamMb: 6144,
      isLowEndDevice: false,
      cpuCores: 8,
      crossOriginIsolated: true,
      sharedArrayBuffer: true,
    });

    expect(catalog.runtime.multithread).toBe(true);
    expect(catalog.runtime.threads).toBe(4);
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
    ]);
    expect(catalog.recommended.id).toBe('STANDARD');

    const advanced = catalog.entries.find((entry) => entry.id === 'ADVANCED_4B');
    expect(advanced?.usable).toBe(false);
    expect(advanced?.blocker).toContain('3B y 7B');
  });

  it('bloquea la descarga si el espacio libre es menor que el archivo', () => {
    const catalog = buildDeviceCatalog({
      ...desktopIsolated,
      storageFreeMb: 500,
    });

    const ultralight = catalog.entries.find((entry) => entry.id === 'ULTRALIGHT');
    expect(ultralight?.usable).toBe(true);
    expect(ultralight?.storageStatus).toBe('tight');
    expect(ultralight?.warning).toContain('liberar espacio');

    const standard = catalog.entries.find((entry) => entry.id === 'STANDARD');
    expect(standard?.usable).toBe(false);
    expect(standard?.storageStatus).toBe('insufficient');
    expect(standard?.blocker).toContain('Espacio libre insuficiente');

    // El recomendado baja al mayor tamaño que sí cabe.
    expect(catalog.recommended.id).toBe('ULTRALIGHT');
  });

  it('sin espacio ni para 0.5B deja visible el motivo en vez de una lista vacía', () => {
    const catalog = buildDeviceCatalog({
      ...desktopIsolated,
      storageFreeMb: 0,
    });

    expect(catalog.usableEntries).toHaveLength(0);
    expect(catalog.visibleEntries).toHaveLength(1);
    expect(catalog.visibleEntries[0].id).toBe('ULTRALIGHT');
    expect(catalog.visibleEntries[0].blocker).toContain('Espacio libre insuficiente');
    expect(catalog.recommended.id).toBe('ULTRALIGHT');
  });

  it('mantiene visible un archivo ya descargado aunque ya no sea viable', () => {
    const catalog = buildDeviceCatalog(
      {
        platform: 'android',
        estimatedRamMb: 8192,
        isLowEndDevice: false,
        crossOriginIsolated: false,
        sharedArrayBuffer: false,
      },
      ['MAX_8B']
    );

    const maximum = catalog.entries.find((entry) => entry.id === 'MAX_8B');
    expect(maximum?.installed).toBe(true);
    expect(maximum?.usable).toBe(false);
    expect(catalog.visibleEntries.map((entry) => entry.id)).toContain('MAX_8B');
    expect(catalog.hiddenEntries.map((entry) => entry.id)).not.toContain('MAX_8B');
  });

  it('marca la RAM web de 8GB como posiblemente superior y no limita a Tauri', () => {
    expect(resolveInferenceRuntime(baseInfo).ramMayBeHigher).toBe(true);
    expect(resolveInferenceRuntime({ ...desktopIsolated, platform: 'tauri' }).ramMayBeHigher).toBe(
      false
    );

    const nativeHighEnd = buildDeviceCatalog({
      ...desktopIsolated,
      platform: 'tauri',
      estimatedRamMb: 16384,
    });
    expect(nativeHighEnd.recommended.id).toBe('MAX_8B');
    expect(nativeHighEnd.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
      'ADVANCED_4B',
      'MAX_8B',
    ]);
  });
});

describe('Catálogo con llama.cpp nativo en Android', () => {
  const nativeAndroid = (
    ramMb: number,
    cores = 8,
    gpu?: NonNullable<DeviceSystemInfo['nativeInference']>['gpu'],
    npu?: NonNullable<DeviceSystemInfo['nativeInference']>['npu']
  ): DeviceSystemInfo => ({
    platform: 'android',
    estimatedRamMb: ramMb,
    isLowEndDevice: false,
    cpuCores: cores,
    crossOriginIsolated: false,
    sharedArrayBuffer: false,
    nativeInference: {
      available: true,
      abi: 'arm64-v8a',
      threads: Math.max(1, Math.min(6, cores - 1)),
      ramMb,
      runtime: 'CPU : NEON = 1',
      gpu,
      npu,
    },
  });

  it('usa los hilos nativos y no aplica el bloqueo de un solo hilo', () => {
    const runtime = resolveInferenceRuntime(nativeAndroid(8192));

    expect(runtime.native).toBe(true);
    expect(runtime.nativeAbi).toBe('arm64-v8a');
    expect(runtime.multithread).toBe(true);
    expect(runtime.threads).toBe(6);

    const catalog = buildDeviceCatalog(nativeAndroid(8192));
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
      'ADVANCED_4B',
    ]);
    expect(catalog.recommended.id).toBe('STANDARD');
    expect(catalog.statusMessage).not.toContain('un solo hilo');
    expect(catalog.statusMessage).toContain('3B y 7B quedan como opción manual');

    const standard = catalog.entries.find((entry) => entry.id === 'STANDARD');
    expect(standard?.blocker).toBeUndefined();
  });

  it('en 4GB ofrece 1.5B con advertencia y oculta 3B/7B por RAM real', () => {
    const catalog = buildDeviceCatalog(nativeAndroid(4096, 4));

    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
    ]);
    expect(catalog.recommended.id).toBe('STANDARD');

    const standard = catalog.entries.find((entry) => entry.id === 'STANDARD');
    expect(standard?.warning).toContain('compite por memoria');

    const advanced = catalog.entries.find((entry) => entry.id === 'ADVANCED_4B');
    expect(advanced?.usable).toBe(false);
    expect(advanced?.blocker).toContain('6 GB de RAM');
  });

  it('en cualquier teléfono con 4GB o más el estándar es 1.5B, no el tamaño que quepa', () => {
    for (const ramMb of [4096, 6144, 8192, 12288, 16384]) {
      const catalog = buildDeviceCatalog(nativeAndroid(ramMb));
      expect(catalog.recommended.id, `con ${ramMb} MB`).toBe('STANDARD');
    }

    const highEnd = buildDeviceCatalog(nativeAndroid(16384));
    const advanced = highEnd.entries.find((entry) => entry.id === 'ADVANCED_4B');
    expect(advanced?.usable).toBe(true);
    expect(advanced?.warning).toContain('no el estándar');

    const maximum = highEnd.entries.find((entry) => entry.id === 'MAX_8B');
    expect(maximum?.usable).toBe(true);
    expect(maximum?.warning).toContain('experimento opcional');
  });

  it('en 12GB deja 7B visible como experimento, con aviso de margen y cargador', () => {
    const twelve = buildDeviceCatalog(nativeAndroid(12288));
    const maximum = twelve.entries.find((entry) => entry.id === 'MAX_8B');

    expect(maximum?.usable).toBe(true);
    expect(maximum?.warning).toContain('experimento opcional');
    expect(maximum?.warning).toContain('cargador');
    expect(twelve.recommended.id).toBe('STANDARD');
  });

  it('en 2GB no hay cerebro estándar honesto y lo advierte', () => {
    const catalog = buildDeviceCatalog(nativeAndroid(2048, 4));

    expect(catalog.recommended.id).toBe('ULTRALIGHT');
    expect(catalog.statusMessage).toContain('El cerebro estándar es 0.5B');

    const ultralight = catalog.entries.find((entry) => entry.id === 'ULTRALIGHT');
    expect(ultralight?.usable).toBe(true);
    expect(ultralight?.warning).toContain('inventar referencias');
  });

  it('con GPU Vulkan real la anuncia sin prometer más RAM', () => {
    const gpu = {
      available: true,
      usable: true,
      software: false,
      name: 'Adreno (TM) 740',
      memoryTotalMb: 8192,
    };
    const catalog = buildDeviceCatalog(nativeAndroid(8192, 8, gpu));

    expect(catalog.runtime.gpu?.usable).toBe(true);
    expect(catalog.runtime.gpu?.name).toBe('Adreno (TM) 740');
    expect(catalog.statusMessage).toContain('GPU Vulkan');
    expect(catalog.statusMessage).toContain('no aumenta la RAM');

    // La GPU acelera el cálculo, pero no cambia los mínimos de memoria.
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
      'ADVANCED_4B',
    ]);
    expect(
      catalog.entries.find((entry) => entry.id === 'MAX_8B')?.usable
    ).toBe(false);
  });

  it('con Vulkan de software no afirma aceleración', () => {
    const catalog = buildDeviceCatalog(
      nativeAndroid(8192, 8, {
        available: true,
        usable: false,
        software: true,
        name: 'SwiftShader',
      })
    );

    expect(catalog.runtime.gpu?.software).toBe(true);
    expect(catalog.statusMessage).toContain('Vulkan de software');
    expect(catalog.statusMessage).not.toContain('GPU Vulkan');
  });

  it('sin Vulkan ni NPU informa CPU y mantiene el catálogo por RAM', () => {
    const catalog = buildDeviceCatalog(nativeAndroid(8192));

    expect(catalog.runtime.gpu).toBeUndefined();
    expect(catalog.runtime.npu).toBeUndefined();
    expect(catalog.statusMessage).toContain('sin acelerador utilizable');
    expect(catalog.statusMessage).toContain('todo el cálculo va a CPU');
    expect(catalog.recommended.id).toBe('STANDARD');
  });

  it('con NPU Hexagon utilizable la prioriza sobre Vulkan sin prometer más RAM', () => {
    const npu = {
      available: true,
      usable: true,
      vendor: 'Qualcomm',
      soc: 'SM8550',
      arch: 73,
      name: 'HTP0',
    };
    const catalog = buildDeviceCatalog(
      nativeAndroid(
        8192,
        8,
        { available: true, usable: true, software: false, name: 'Adreno 740' },
        npu
      )
    );

    expect(catalog.runtime.npu?.usable).toBe(true);
    expect(catalog.statusMessage).toContain('NPU Hexagon (HTP0)');
    expect(catalog.statusMessage).toContain('no amplía la RAM');
    expect(catalog.usableEntries.map((entry) => entry.id)).toEqual([
      'ULTRALIGHT',
      'STANDARD',
      'ADVANCED_4B',
    ]);
    expect(
      catalog.entries.find((entry) => entry.id === 'MAX_8B')?.usable
    ).toBe(false);
  });

  it('con NPU presente pero no utilizable explica el motivo y cae a GPU/CPU', () => {
    const catalog = buildDeviceCatalog(
      nativeAndroid(8192, 8, undefined, {
        available: false,
        usable: false,
        vendor: 'Qualcomm',
        soc: 'SM8450',
        arch: 69,
        name: '',
        reason: 'Hexagon v69 es anterior a v73',
      })
    );

    expect(catalog.runtime.npu?.usable).toBe(false);
    expect(catalog.statusMessage).toContain('Hexagon v69 es anterior a v73');
    expect(catalog.statusMessage).toContain('se usará CPU');
  });

  it('en Adreno omite Vulkan en modo automático y usa la NPU si existe', () => {
    const info = nativeAndroid(
      16384,
      8,
      {
        available: true,
        usable: true,
        software: false,
        name: 'Adreno (TM) 750',
        memoryTotalMb: 16384,
      },
      {
        available: true,
        usable: true,
        vendor: 'Qualcomm',
        soc: 'SM8650',
        arch: 75,
        name: 'HTP0',
      }
    );
    info.nativeInference!.accelerationPolicy = {
      mode: 'auto',
      npu: { usable: true, quarantined: false, skipped: false },
      gpu: {
        usable: false,
        quarantined: false,
        skipped: true,
        reason: 'Vulkan se omite en Adreno',
      },
    };

    const catalog = buildDeviceCatalog(info);
    expect(catalog.runtime.gpu?.usable).toBe(true);
    expect(catalog.statusMessage).toContain('NPU Hexagon (HTP0)');
    expect(catalog.statusMessage).not.toContain('GPU Vulkan (Adreno');
  });

  it('pone en cuarentena la GPU que cerró la app y lo explica', () => {
    const info = nativeAndroid(8192, 8, {
      available: true,
      usable: true,
      software: false,
      name: 'Adreno (TM) 750',
      memoryTotalMb: 8192,
    });
    info.nativeInference!.accelerationPolicy = {
      mode: 'auto',
      gpu: {
        usable: false,
        quarantined: true,
        skipped: false,
        phase: 'runtime',
        reason: 'La última vez, la GPU Vulkan cerró la aplicación durante el cálculo.',
      },
    };

    const catalog = buildDeviceCatalog(info);
    expect(catalog.statusMessage).toContain('cuarentena');
    expect(catalog.statusMessage).toContain('todo el cálculo va a CPU');
    expect(catalog.statusMessage).not.toContain('GPU Vulkan (Adreno');
  });

  it('ofrece el perfil Q4_0 en GPU solo en Adreno 750 y lo etiqueta como modo rápido', () => {
    const catalog = buildDeviceCatalog(
      nativeAndroid(16384, 8, {
        available: true,
        usable: true,
        software: false,
        name: 'Adreno (TM) 750',
        memoryTotalMb: 16384,
      })
    );

    const gpuProfile = catalog.entries.find((entry) => entry.id === 'ULTRALIGHT_GPU');
    expect(gpuProfile).toBeDefined();
    expect(gpuProfile?.usable).toBe(true);
    expect(gpuProfile?.manifest.cuantizacion).toBe('Q4_0');
    expect(gpuProfile?.manifest.archivoDestino).toBe('verbovivo_0.5b_q4_0.gguf');
    expect(gpuProfile?.warning).toContain('2,4×');
    expect(gpuProfile?.warning).toContain('2048');
    // No debe desplazar la recomendación: en un teléfono el estándar sigue siendo 1.5B.
    expect(catalog.recommended.id).toBe('STANDARD');
  });

  it('reconoce el Adreno 750 cuando Vulkan reporta el dispositivo lógico como nombre', () => {
    const catalog = buildDeviceCatalog(
      nativeAndroid(16384, 8, {
        available: true,
        usable: true,
        software: false,
        name: 'Vulkan0',
        description: 'Adreno (TM) 750',
        memoryTotalMb: 16384,
      })
    );

    const gpuProfile = catalog.entries.find((entry) => entry.id === 'ULTRALIGHT_GPU');
    expect(gpuProfile).toBeDefined();
    expect(gpuProfile?.usable).toBe(true);
    expect(gpuProfile?.warning).toContain('2,4×');
    expect(gpuProfile?.warning).not.toContain('se ejecutará en CPU');
  });

  it('no muestra el perfil Q4_0 en otra GPU ni en PC', () => {
    const otherGpu = buildDeviceCatalog(
      nativeAndroid(8192, 8, {
        available: true,
        usable: true,
        software: false,
        name: 'Adreno 740',
      })
    );
    expect(otherGpu.entries.some((entry) => entry.id === 'ULTRALIGHT_GPU')).toBe(false);

    const desktop = buildDeviceCatalog(desktopIsolated);
    expect(desktop.entries.some((entry) => entry.id === 'ULTRALIGHT_GPU')).toBe(false);
  });
});
