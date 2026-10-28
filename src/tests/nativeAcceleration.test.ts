import { describe, expect, it } from 'vitest';
import {
  describeNativeAcceleration,
  NativeGpuInfo,
  NativeNpuInfo,
} from '../core/native-bridge/llamaNative.js';

const gpu: NativeGpuInfo = {
  available: true,
  usable: true,
  software: false,
  name: 'Adreno 740',
  description: 'Adreno',
};

const npu: NativeNpuInfo = {
  available: true,
  usable: true,
  vendor: 'Qualcomm',
  soc: 'SM8550',
  arch: 73,
  name: 'HTP0',
  description: 'Hexagon v73',
};

describe('Etiqueta de aceleración nativa', () => {
  it('solo dice GPU cuando el modelo se cargó realmente con offload', () => {
    expect(describeNativeAcceleration({ gpu, acceleration: 'gpu' })).toBe('GPU Adreno 740');
    expect(describeNativeAcceleration({ acceleration: 'gpu' })).toBe('GPU Vulkan');
  });

  it('solo dice NPU cuando el backend Hexagon cargó el modelo', () => {
    expect(describeNativeAcceleration({ npu, gpu, acceleration: 'npu' })).toBe('NPU HTP0');
    expect(describeNativeAcceleration({ acceleration: 'npu' })).toBe('NPU Hexagon');
  });

  it('explica el retroceso desde la NPU cuando era utilizable', () => {
    expect(describeNativeAcceleration({ npu, gpu, acceleration: 'gpu' })).toBe(
      'GPU Adreno 740'
    );
    expect(describeNativeAcceleration({ npu, gpu, acceleration: 'cpu' })).toBe(
      'CPU (retroceso desde NPU)'
    );
  });

  it('distingue una NPU presente pero no utilizable', () => {
    expect(
      describeNativeAcceleration({
        npu: { ...npu, usable: false, reason: 'Hexagon v69 anterior a v73' },
        acceleration: 'cpu',
      })
    ).toBe('CPU (NPU no utilizable)');
    expect(
      describeNativeAcceleration({
        npu: { ...npu, available: false, usable: false },
        acceleration: 'cpu',
      })
    ).toBe('CPU');
  });

  it('no presenta como GPU un Vulkan de software', () => {
    expect(
      describeNativeAcceleration({
        gpu: { ...gpu, usable: false, software: true, name: 'SwiftShader' },
        acceleration: 'cpu',
      })
    ).toBe('CPU (Vulkan de software)');
  });

  it('explica el retroceso cuando la GPU era viable pero la carga terminó en CPU', () => {
    expect(describeNativeAcceleration({ gpu, acceleration: 'cpu' })).toBe(
      'CPU (retroceso desde GPU)'
    );
  });

  it('distingue una GPU presente pero no utilizable de una ausente', () => {
    expect(
      describeNativeAcceleration({ gpu: { ...gpu, usable: false }, acceleration: 'cpu' })
    ).toBe('CPU (GPU no utilizable)');
    expect(
      describeNativeAcceleration({
        gpu: { ...gpu, available: false, usable: false },
        acceleration: 'cpu',
      })
    ).toBe('CPU');
    expect(describeNativeAcceleration(null)).toBe('CPU');
  });

  it('explica que Vulkan se omite en Adreno en modo automático', () => {
    expect(
      describeNativeAcceleration({
        gpu,
        npu: { ...npu, usable: false, available: false },
        acceleration: 'cpu',
        accelerationPolicy: {
          gpu: {
            usable: false,
            quarantined: false,
            skipped: true,
            reason: 'Vulkan se omite en Adreno',
          },
        },
      })
    ).toBe('CPU (Vulkan omitido en Adreno)');
  });

  it('pone en cuarentena un acelerador que cerró la app', () => {
    expect(
      describeNativeAcceleration({
        gpu,
        npu,
        acceleration: 'cpu',
        accelerationPolicy: {
          npu: { usable: false, quarantined: true, skipped: false, phase: 'load' },
          gpu: { usable: false, quarantined: false, skipped: true },
        },
      })
    ).toBe('CPU (NPU bloqueada tras un cierre)');

    expect(
      describeNativeAcceleration({
        gpu,
        npu: { ...npu, usable: false, available: false },
        acceleration: 'cpu',
        accelerationPolicy: {
          gpu: { usable: false, quarantined: true, skipped: false, phase: 'runtime' },
        },
      })
    ).toBe('CPU (GPU bloqueada tras un cierre)');

    expect(
      describeNativeAcceleration({
        acceleration: 'cpu',
        accelerationPolicy: {
          npu: { usable: false, quarantined: true, skipped: false },
          gpu: { usable: false, quarantined: true, skipped: false },
        },
      })
    ).toBe('CPU (NPU y GPU bloqueadas tras un cierre)');
  });
});
