export default {
  appId: 'org.verbovivo.app',
  appName: 'VerboVivo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Permite que el WebView hable con Ollama/LM Studio por HTTP en la LAN.
    cleartext: true,
  },
  android: {
    // El WebView carga https://localhost; sin esto, un endpoint http://
    // de la red local queda bloqueado como contenido mixto.
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorHttp: {
      // Debe quedar desactivado: el parche nativo bufferiza la respuesta y
      // rompe el streaming SSE/NDJSON de Ollama y OpenAI-compatible.
      enabled: false,
    },
    CapacitorCookies: {
      enabled: true,
    },
  },
};
