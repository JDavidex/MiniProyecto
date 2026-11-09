/**
 * ============================================================================
 * NODO TRABAJADOR DISTRIBUIDO (WEB WORKER REAL - HTML5)
 * ============================================================================
 * Propósito:
 * Simula un nodo físico independiente ejecutando en su propio hilo del sistema
 * operativo (a través de la API Web Worker de JavaScript).
 * 
 * Capacidades y Optimizaciones:
 * 1. Despacho Individual y Por Lotes (Micro-batching):
 *    Soporta recibir múltiples tareas en un único postMessage para reducir
 *    el overhead de serialización IPC (structuredClone), amortizando el costo
 *    en configuraciones de alta concurrencia (e.g., 8 nodos).
 * 2. Planificador Interno de Slots (Worker-Side Scheduler):
 *    Mantiene un buffer local de tareas; cuando un slot/hilo finaliza, inicia
 *    inmediatamente la siguiente tarea disponible sin latencia de ida y vuelta.
 * 3. Emisión de Heartbeats periódicos (cada 800ms) para supervisión de salud.
 * 4. Simulación de fallos físicos (comando KILL) para evaluar el Patrón Retry.
 */

interface TaskPayload {
  taskId: string;
  patientName: string;
  specialty: string;
  channel: string;
  threadSlot?: number;
}

interface InitMessage {
  type: 'INIT';
  nodeId: string;
  nodeName: string;
  maxThreads: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  simulatedErrorRate?: number;
}

interface AssignTaskMessage {
  type: 'ASSIGN_TASK';
  taskId: string;
  threadSlot?: number;
  taskData: {
    patientName: string;
    specialty: string;
    channel: string;
  };
}

interface AssignBatchMessage {
  type: 'ASSIGN_BATCH';
  tasks: Array<{
    taskId: string;
    threadSlot?: number;
    taskData: {
      patientName: string;
      specialty: string;
      channel: string;
    };
  }>;
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
  maxThreads?: number;
  simulatedErrorRate?: number;
}

type InboundMessage = 
  | InitMessage 
  | AssignTaskMessage 
  | AssignBatchMessage 
  | KillMessage 
  | ReviveMessage 
  | ConfigMessage;

// Estado interno del Worker en su propio hilo del SO
let nodeId = 'node-unknown';
let nodeName = 'Worker';
let maxThreads = 2;
let isAlive = true;
let minLatencyMs = 400;
let maxLatencyMs = 1200;
let simulatedErrorRate = 0.02; // 2% de error natural en red
let heartbeatInterval: any = null;

// Buffer de tareas locales recibidas pendientes de slot
const localTaskQueue: TaskPayload[] = [];

// Mapa de tareas activas por slot de hilo
interface ActiveSlotData {
  taskId: string;
  startTime: number;
  timerId: any;
  progressIntervalId: any;
}
const activeSlots = new Map<number, ActiveSlotData>();

function sendHeartbeat() {
  if (!isAlive) return;

  self.postMessage({
    type: 'HEARTBEAT',
    nodeId,
    timestamp: Date.now(),
    activeCount: activeSlots.size,
    bufferedCount: localTaskQueue.length,
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

/**
 * Encuentra un slot libre entre 0 y maxThreads - 1
 */
function findFreeSlot(): number | null {
  for (let i = 0; i < maxThreads; i++) {
    if (!activeSlots.has(i)) {
      return i;
    }
  }
  return null;
}

/**
 * Planificador interno: Asigna tareas del buffer local a slots disponibles
 */
function scheduleTasks(): void {
  if (!isAlive) return;

  while (localTaskQueue.length > 0) {
    const freeSlot = findFreeSlot();
    if (freeSlot === null) {
      // Todos los slots ocupados
      break;
    }

    const task = localTaskQueue.shift()!;
    startSlotExecution(task, freeSlot);
  }
}

/**
 * Inicia la ejecución de una tarea en un slot específico
 */
function startSlotExecution(task: TaskPayload, slotId: number): void {
  const { taskId } = task;
  const startTime = Date.now();

  const latency = Math.floor(
    Math.random() * (maxLatencyMs - minLatencyMs + 1) + minLatencyMs
  );

  // Simular progreso incremental en 5 pasos
  const progressSteps = 5;
  const stepDuration = Math.max(20, Math.floor(latency / progressSteps));
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
      threadSlot: slotId,
      progressPercent: percent,
    });

    if (currentStep >= progressSteps) {
      clearInterval(progressInterval);
    }
  }, stepDuration);

  // Temporizador de finalización
  const completionTimer = setTimeout(() => {
    if (!isAlive) return;

    clearInterval(progressInterval);
    activeSlots.delete(slotId);
    const durationMs = Date.now() - startTime;
    const fails = Math.random() < simulatedErrorRate;

    if (fails) {
      self.postMessage({
        type: 'TASK_FAILED',
        nodeId,
        taskId,
        threadSlot: slotId,
        durationMs,
        error: 'Timeout en pasarela de mensajería (simulado)',
      });
    } else {
      self.postMessage({
        type: 'TASK_COMPLETED',
        nodeId,
        taskId,
        threadSlot: slotId,
        durationMs,
      });
    }

    // Inmediatamente planificar la siguiente tarea del buffer si existe
    scheduleTasks();
  }, latency);

  activeSlots.set(slotId, {
    taskId,
    startTime,
    timerId: completionTimer,
    progressIntervalId: progressInterval,
  });

  self.postMessage({
    type: 'TASK_STARTED',
    nodeId,
    taskId,
    threadSlot: slotId,
    patientName: task.patientName,
    specialty: task.specialty,
    channel: task.channel,
  });
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
      if (msg.maxThreads !== undefined) maxThreads = msg.maxThreads;
      if (msg.simulatedErrorRate !== undefined) simulatedErrorRate = msg.simulatedErrorRate;
      break;
    }

    case 'KILL': {
      // Simula colapso abrupto del nodo (hardware/red)
      isAlive = false;
      stopHeartbeat();

      // Cancelar timers y descartar cola local
      activeSlots.forEach((item) => {
        if (item.timerId) clearTimeout(item.timerId);
        if (item.progressIntervalId) clearInterval(item.progressIntervalId);
      });
      activeSlots.clear();
      localTaskQueue.length = 0;

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
        self.postMessage({
          type: 'TASK_FAILED',
          nodeId,
          taskId: msg.taskId,
          threadSlot: msg.threadSlot ?? 0,
          error: 'Nodo inactivo o colapsado',
        });
        return;
      }

      localTaskQueue.push({
        taskId: msg.taskId,
        patientName: msg.taskData.patientName,
        specialty: msg.taskData.specialty,
        channel: msg.taskData.channel,
        threadSlot: msg.threadSlot,
      });

      scheduleTasks();
      break;
    }

    case 'ASSIGN_BATCH': {
      if (!isAlive) {
        msg.tasks.forEach((t) => {
          self.postMessage({
            type: 'TASK_FAILED',
            nodeId,
            taskId: t.taskId,
            threadSlot: t.threadSlot ?? 0,
            error: 'Nodo inactivo o colapsado',
          });
        });
        return;
      }

      // Encolar todo el lote en el buffer local del Worker en una sola operación
      for (let i = 0; i < msg.tasks.length; i++) {
        const item = msg.tasks[i];
        localTaskQueue.push({
          taskId: item.taskId,
          patientName: item.taskData.patientName,
          specialty: item.taskData.specialty,
          channel: item.taskData.channel,
          threadSlot: item.threadSlot,
        });
      }

      // Planificar inmediatamente slots disponibles
      scheduleTasks();
      break;
    }
  }
};
