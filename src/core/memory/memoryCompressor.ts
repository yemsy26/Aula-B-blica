import { ChatMessage, UsuarioMemoriaService } from '../database/usuarioMemoriaService.js';
import { UserTheologicalLevel } from '../shield/types.js';
import { DistilledMemorySnapshot, CompressionJob } from './types.js';

export class MemoryCompressor {
  private usuarioService: UsuarioMemoriaService;
  private queue: CompressionJob[] = [];
  private isProcessing: boolean = false;
  private messageCounter: number = 0;
  private readonly threshold: number;

  constructor(usuarioService: UsuarioMemoriaService, messageThreshold: number = 2) {
    this.usuarioService = usuarioService;
    this.threshold = messageThreshold;
  }

  /**
   * Encola mensajes nuevos para compresión en tiempo muerto (background idle)
   * Jamás bloquea la UI ni la respuesta al usuario.
   */
  scheduleCompression(chatId: string, messages: ChatMessage[]): void {
    if (!messages || messages.length === 0) return;

    this.queue.push({
      chatId,
      messages: [...messages],
      timestamp: Date.now(),
    });

    this.messageCounter += messages.length;

    // Solo programar si alcanzamos el umbral o si hay tareas en cola
    if (this.messageCounter >= this.threshold && !this.isProcessing) {
      this.triggerIdleExecution();
    }
  }

  private triggerIdleExecution(): void {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(
        () => {
          this.processQueue();
        },
        { timeout: 2000 }
      );
    } else {
      // Fallback para Node.js o entornos sin requestIdleCallback
      setTimeout(() => {
        this.processQueue();
      }, 50);
    }
  }

  /**
   * Procesa la cola y genera el snapshot destilado < 300 palabras
   */
  async processQueue(): Promise<DistilledMemorySnapshot | null> {
    if (this.queue.length === 0 || this.isProcessing) return null;

    this.isProcessing = true;
    try {
      // Tomar todos los trabajos acumulados
      const jobs = [...this.queue];
      this.queue = [];
      this.messageCounter = 0;

      const allMessages: ChatMessage[] = [];
      for (const job of jobs) {
        allMessages.push(...job.messages);
      }

      const snapshot = this.distillMessages(allMessages);

      // Persistir en SQLite
      this.applySnapshotToUserMemory(snapshot);

      return snapshot;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Fuerza el procesamiento inmediato (útil para tests unitarios y exportaciones)
   */
  async flushNow(): Promise<DistilledMemorySnapshot | null> {
    return this.processQueue();
  }

  /**
   * Extrae de forma determinista y compacta la memoria evolutiva
   */
  private distillMessages(messages: ChatMessage[]): DistilledMemorySnapshot {
    const temas = new Set<string>();
    const dudas = new Set<string>();
    const versiculos = new Set<string>();
    let nivelMasAlto: UserTheologicalLevel = 'Semilla';

    for (const msg of messages) {
      // Los marcadores de cita no resuelta no son pasajes verificados: si se
      // conservan, la memoria aprende referencias que la base local no tiene.
      const text = msg.content.replace(/\[CITA NO ENCONTRADA EN DB LOCAL:[^\]]*\]/gi, ' ');

      // 1. Detectar dudas / preguntas formuladas por el usuario
      if (msg.role === 'user') {
        const questionMatches = text.match(/(?:¿|\bpor qué|\bcómo|\bqué significa|\bpor que)[^.?!]+[?!]/gi);
        if (questionMatches) {
          questionMatches.forEach((q) => {
            const clean = q.trim();
            if (clean.length > 10 && clean.length < 120) {
              dudas.add(clean);
            }
          });
        }
      }

      // 2. Detectar versículos bíblicos citados
      const verseMatches = text.match(/\b([1-3]?\s*[A-ZÁÉÍÓÚ][a-záéíóúñ]+)\s+\d+[:.]\d+(?:-\d+)?\b/g);
      if (verseMatches) {
        verseMatches.forEach((v) => versiculos.add(v.trim()));
      }

      // 3. Evaluar nivel teológico
      if (msg.level === 'Maestro') {
        nivelMasAlto = 'Maestro';
      } else if (msg.level === 'Discipulo' && nivelMasAlto !== 'Maestro') {
        nivelMasAlto = 'Discipulo';
      }

      // 4. Extraer temas doctrinales
      if (msg.route) {
        temas.add(msg.route.replace(/[[\]]/g, ''));
      }
      if (/gracia|justificaci[oó]n|fe/i.test(text)) temas.add('Doctrina de la Gracia');
      if (/creaci[oó]n|g[eé]nesis|soberan[ií]a/i.test(text)) temas.add('Creación y Soberanía');
      if (/consuelo|ansiedad|paz|pastor/i.test(text)) temas.add('Consuelo y Confianza');
      if (/matrimonio|familia|hijos/i.test(text)) temas.add('Familia y Pacto');
    }

    const temasArr = Array.from(temas);
    const dudasArr = Array.from(dudas).slice(0, 5); // Limitar a las 5 dudas más claras
    const versiculosArr = Array.from(versiculos).slice(0, 8);

    // Síntesis concisa obligatoria en < 300 palabras
    const sintesisCruceGlobal = [
      `Usuario en nivel [${nivelMasAlto}].`,
      `Temas nucleares estudiados: ${temasArr.join(', ') || 'Fundamentos generales'}.`,
      versiculosArr.length > 0 ? `Pasajes ancla canónicos: ${versiculosArr.join(', ')}.` : '',
      dudasArr.length > 0
        ? `Inquietudes teológicas pendientes: ${dudasArr.map((d) => `"${d}"`).join('; ')}.`
        : 'Sin dudas pendientes sin resolver.',
      `Perfil: Búsqueda orientada a ${
        nivelMasAlto === 'Maestro'
          ? 'exégesis de raíces hebreas/griegas y estructura canónica'
          : nivelMasAlto === 'Discipulo'
          ? 'contexto histórico y teología bíblica de pactos'
          : 'aplicación práctica, consuelo y fortaleza espiritual cotidiana'
      }.`,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      temasExtraidos: temasArr,
      dudasDetectadas: dudasArr,
      versiculosClave: versiculosArr,
      nivelPercibido: nivelMasAlto,
      sintesisCruceGlobal,
      timestamp: new Date().toISOString(),
    };
  }

  private applySnapshotToUserMemory(snapshot: DistilledMemorySnapshot): void {
    const profile = this.usuarioService.getGlobalProfile();

    // Actualizar nivel si el percibido tiene mayor madurez
    if (snapshot.nivelPercibido === 'Maestro' || (snapshot.nivelPercibido === 'Discipulo' && profile.nivel_espiritual === 'Semilla')) {
      profile.nivel_espiritual = snapshot.nivelPercibido;
    }

    // Registrar temas
    for (const tema of snapshot.temasExtraidos) {
      this.usuarioService.recordTopicLearned(tema);
    }

    // Registrar dudas pendientes no registradas previamente
    for (const duda of snapshot.dudasDetectadas) {
      const alreadyExists = profile.dudas_pendientes.some((d) => d.pregunta.toLowerCase() === duda.toLowerCase());
      if (!alreadyExists) {
        this.usuarioService.addPendingQuestion(duda);
      }
    }

    // Actualizar resumen de madurez con la síntesis destilada < 300 palabras
    profile.resumen_madurez = snapshot.sintesisCruceGlobal;
    this.usuarioService.updateGlobalProfile(profile);
  }
}
