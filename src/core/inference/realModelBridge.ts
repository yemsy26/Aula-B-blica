import { PersonalityConfig } from './types.js';

export type RealBackendType = 'DETERMINISTIC' | 'LOCAL_SERVER' | 'WEBGPU' | 'NATIVE_LLAMA_CPP';

export interface LocalServerConfig {
  endpoint: string; // ej: http://localhost:11434 (Ollama) o http://localhost:1234 (LM Studio)
  modelName: string; // ej: tinyllama, phi3, qwen, llama3
  timeoutMs: number;
}

export class RealModelBridge {
  private backendType: RealBackendType = 'DETERMINISTIC';
  private serverConfig: LocalServerConfig = {
    endpoint: 'http://localhost:11434',
    modelName: 'tinyllama',
    timeoutMs: 4000,
  };

  getBackendType(): RealBackendType {
    return this.backendType;
  }

  setBackendType(type: RealBackendType): void {
    this.backendType = type;
  }

  getServerConfig(): LocalServerConfig {
    return { ...this.serverConfig };
  }

  setServerConfig(config: Partial<LocalServerConfig>): void {
    this.serverConfig = { ...this.serverConfig, ...config };
  }

  /**
   * Comprueba si el servidor local de calibrado (Ollama / LM Studio) está respondiendo en localhost
   */
  async pingLocalServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      // Probar endpoint base de Ollama o OpenAI compatible
      const res = await fetch(`${this.serverConfig.endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);
      return Boolean(res && res.ok);
    } catch {
      return false;
    }
  }

  /**
   * Ejecuta inferencia real vía streaming hacia el servidor local (Ollama / LM Studio / llama-server)
   */
  async generateStream(
    prompt: string,
    personality: PersonalityConfig,
    groundTruthContext?: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    const fullSystemPrompt = [
      personality.systemPrompt,
      groundTruthContext || '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // 1. Probar llamada con endpoint de Ollama (/api/generate)
    const isOllama = this.serverConfig.endpoint.includes('11434');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.serverConfig.timeoutMs);

    try {
      if (isOllama) {
        const response = await fetch(`${this.serverConfig.endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.serverConfig.modelName,
            prompt,
            system: fullSystemPrompt,
            stream: true,
            options: {
              temperature: personality.temperature,
              top_p: personality.topP,
              num_predict: personality.maxOutputTokens,
              stop: personality.stopSequences,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok || !response.body) {
          throw new Error(`Error en servidor local: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n').filter((l) => l.trim() !== '');

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                fullText += parsed.response;
                if (onToken) onToken(parsed.response);
              }
            } catch {
              // Fragmento JSON parcial
            }
          }
        }

        return fullText;
      } else {
        // Formato estándar OpenAI (LM Studio / vLLM / llama-server en /v1/chat/completions)
        const response = await fetch(`${this.serverConfig.endpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.serverConfig.modelName,
            messages: [
              { role: 'system', content: fullSystemPrompt },
              { role: 'user', content: prompt },
            ],
            stream: true,
            temperature: personality.temperature,
            max_tokens: personality.maxOutputTokens,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok || !response.body) {
          throw new Error(`Error en endpoint local OpenAI: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n').filter((l) => l.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataContent = line.slice(6).trim();
              if (dataContent === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataContent);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  if (onToken) onToken(delta);
                }
              } catch {
                // Fragmento incompleto
              }
            }
          }
        }

        return fullText;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

export const realModelBridge = new RealModelBridge();
