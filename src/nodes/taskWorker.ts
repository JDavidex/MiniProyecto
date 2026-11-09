/**
 * ============================================================================
 * NODO TRABAJADOR DISTRIBUIDO (WEB WORKER REAL - HTML5)
 * ============================================================================
 * Propósito:
 * Simula un nodo físico independiente ejecutando en su propio hilo del sistema
 * operativo (a través de la API Web Worker de JavaScript).
 * 
 * Capacidades:
 * 1. Concurrencia interna: Cada nodo gestiona múltiples "hilos" o slots
 *    concurrentes para procesar recordatorios en paralelo.
 * 2. Emisión de Heartbeats: Envía pulsos periódicos de actividad al Coordinador.
 * 3. Simulación de latencia real de red (llamada a APIs de SMS/WhatsApp/Email).
 * 4. Simulación de fallos físicos (comando KILL) para evaluar la robustez y
 *    tolerancia a fallos del sistema distribuido.
 */

interface InitMessage {
  type: 'INIT';
  nodeId: string;
  nodeName: string;
  maxThreads: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  simulatedErrorRate?: number; // e.g. 0.03
}

interface AssignTaskMessage {
  type: 'ASSIGN_TASK';
  taskId: string;
  threadSlot: number;
  taskData: {
    patientName: string;
    specialty: string;
    channel: string;
  };
}

interface KillMessage {
  type: 'KILL';
}

interface ReviveMessage {
  type: 'REVIVE';
}

interface ConfigMessage {
  type: 'CONFIG';
  minLatencyMs?: number;
  maxLatencyMs?: number;
  simulatedErrorRate?: number;
}

type InboundMessage = InitMessage | AssignTaskMessage | KillMessage | ReviveMessage | ConfigMessage;

// Estado interno del Worker en su propio hilo
let nodeId = 'node-unknown';
let nodeName = 'Worker';
let maxThreads = 2;
let isAlive = true;
let minLatencyMs = 400;
let maxLatencyMs = 1200;
let simulatedErrorRate = 0.02; // 2% de error natural en red
let heartbeatInterval: any = null;

// Mapa de tareas activas por slot
const activeTasks = new Map<number, { taskId: string; startTime: number; timerId: any }>();

function sendHeartbeat() {
  if (!isAlive) return;

  self.postMessage({
    type: 'HEARTBEAT',
    nodeId,
    timestamp: Date.now(),
    activeCount: activeTasks.size,
    maxThreads,
  });
}

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(sendHeartbeat, 800);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

self.onmessage = (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'INIT': {
      nodeId = msg.nodeId;
      nodeName = msg.nodeName;
      maxThreads = msg.maxThreads;
      minLatencyMs = msg.minLatencyMs;
      maxLatencyMs = msg.maxLatencyMs;
      if (typeof msg.simulatedErrorRate === 'number') {
        simulatedErrorRate = msg.simulatedErrorRate;
      }
      isAlive = true;
      startHeartbeat();
      self.postMessage({
        type: 'READY',
        nodeId,
        nodeName,
        maxThreads,
      });
      break;
    }

    case 'CONFIG': {
      if (msg.minLatencyMs !== undefined) minLatencyMs = msg.minLatencyMs;
      if (msg.maxLatencyMs !== undefined) maxLatencyMs = msg.maxLatencyMs;
      if (msg.simulatedErrorRate !== undefined) simulatedErrorRate = msg.simulatedErrorRate;
      break;
    }

    case 'KILL': {
      // Simula colapso abrupto del nodo (hardware/apagón/desconexión de red)
      isAlive = false;
      stopHeartbeat();

      // Cancelar tareas activas sin completarlas (simula pérdida de memoria)
      activeTasks.forEach((item) => {
        if (item.timerId) clearTimeout(item.timerId);
      });
      activeTasks.clear();

      self.postMessage({
        type: 'CRASHED',
        nodeId,
        timestamp: Date.now(),
      });
      break;
    }

    case 'REVIVE': {
      isAlive = true;
      startHeartbeat();
      self.postMessage({
        type: 'RECOVERED',
        nodeId,
        timestamp: Date.now(),
      });
      break;
    }

    case 'ASSIGN_TASK': {
      if (!isAlive) {
        // Si el nodo está caído, descarta la tarea de inmediato
        self.postMessage({
          type: 'TASK_FAILED',
          nodeId,
          taskId: msg.taskId,
          threadSlot: msg.threadSlot,
          error: 'Nodo inactivo o colapsado',
        });
        return;
      }

      const { taskId, threadSlot } = msg;
      const startTime = Date.now();

      // Calcular latencia simulada para esta tarea
      const latency = Math.floor(
        Math.random() * (maxLatencyMs - minLatencyMs + 1) + minLatencyMs
      );

      // Simular progreso incremental (para visualización realista de hilos)
      const progressSteps = 5;
      const stepDuration = latency / progressSteps;
      let currentStep = 0;

      const progressInterval = setInterval(() => {
        if (!isAlive) {
          clearInterval(progressInterval);
          return;
        }
        currentStep++;
        const percent = Math.min(100, Math.round((currentStep / progressSteps) * 100));

        self.postMessage({
          type: 'TASK_PROGRESS',
          nodeId,
          taskId,
          threadSlot,
          progressPercent: percent,
        });

        if (currentStep >= progressSteps) {
          clearInterval(progressInterval);
        }
      }, stepDuration);

      // Temporizador de finalización de tarea
      const completionTimer = setTimeout(() => {
        if (!isAlive) return;

        activeTasks.delete(threadSlot);
        const durationMs = Date.now() - startTime;

        // Simular fallo estocástico esporádico (e.g. gateway SMS caído)
        const fails = Math.random() < simulatedErrorRate;

        if (fails) {
          self.postMessage({
            type: 'TASK_FAILED',
            nodeId,
            taskId,
            threadSlot,
            durationMs,
            error: 'Timeout en pasarela de mensajería (simulado)',
          });
        } else {
          self.postMessage({
            type: 'TASK_COMPLETED',
            nodeId,
            taskId,
            threadSlot,
            durationMs,
          });
        }
      }, latency);

      activeTasks.set(threadSlot, {
        taskId,
        startTime,
        timerId: completionTimer,
      });

      self.postMessage({
        type: 'TASK_STARTED',
        nodeId,
        taskId,
        threadSlot,
      });
      break;
    }
  }
};
