/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * El runtime GGUF (wllama) usa SharedArrayBuffer para repartir el trabajo
 * entre varios hilos. El navegador solo lo permite en un contexto aislado,
 * y ese aislamiento se activa con estas dos cabeceras. Sin ellas el modelo
 * funciona, pero en un solo hilo: varias veces más lento en PC.
 *
 * En producción (y en el WebView de Android) el servidor debe enviar las
 * mismas cabeceras. Si no las envía, el adaptador detecta la ausencia de
 * `crossOriginIsolated` y cae con honestidad a un hilo.
 */
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  test: {
    globals: true,
    environment: 'node',
    // El árbol nativo de llama.cpp incluye sus propias pruebas de la UI web;
    // no forman parte de VerboVivo y no deben ejecutarse aquí.
    include: ['src/tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'android/native/**', 'dist/**'],
  },
});
