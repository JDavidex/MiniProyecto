/**
 * ============================================================================
 * PATRÓN DE DISEÑO: MEDIATOR (COORDINADOR DEL CLUSTER) & RETRY PATTERN
 * ============================================================================
 * Propósito del Mediador:
 * Centraliza la comunicación e interacción entre el Proxy de entrada, la cola
 * de tareas pendientes y el conjunto distribuido de nodos Web Workers.
 * Evita dependencias directas entre componentes y desacopla la topología.
 * 
 * Responsabilidades:
 * 1. Mantenimiento de la cola FIFO/priorizada de recordatorios médicos.
 * 2. Balanceo de Carga: "Menos cargado" (Least Connections / Lowest Load Ratio).
 * 3. Monitor de Heartbeats: Detección proactiva de fallas por timeout.
 * 4. PATRÓN RETRY: Reencolamiento automático y transparente de tareas asignadas
 *    a nodos que colapsaron o reportaron error.
 * 5. Cálculo y publicación de métricas en tiempo real hacia el EventBus.
 */

import { AppointmentTask, ClusterMetrics, WorkerNodeState } from '../types';
import { WorkerNodeWrapper } from '../nodes/WorkerNodeWrapper';
import { eventBus } from '../events/EventBus';

export class Coordinator {
  private static instance: Coordinator;

  // Cola centralizada de tareas pendientes
  private taskQueue: AppointmentTask[] = [];

  // Diccionario de nodos trabajadores en el cluster
  private nodes: Map<string, WorkerNodeWrapper> = new Map();

  // Registro de todas las tareas en el ciclo de vida actual
  private allTasks: Map<string, AppointmentTask> = new Map();

  // Configuración del cluster
  private nodesCount: number = 4;
  private threadsPerNode: number = 2;
  private minLatencyMs: number = 400;
  private maxLatencyMs: number = 1000;
  private readonly HEARTBEAT_TIMEOUT_MS = 2500;

  // Temporizadores de orquestación
  private dispatchIntervalId: any = null;
  private healthCheckIntervalId: any = null;
  private metricsIntervalId: any = null;

  // Métricas
  private startTime: number = 0;
  private completedCount: number = 0;
  private failedCount: number = 0;
  private retriedCount: number = 0;
  private totalLatenciesSum: number = 0;
  private lastCompletedSnapshot: number = 0;
  private currentThroughput: number = 0;
  private peakThroughput: number = 0;
  private isProcessingBatch: boolean = false;

  private constructor() {
    this.initCluster();
    this.startOrchestratorLoops();
  }

  public static getInstance(): Coordinator {
    if (!Coordinator.instance) {
      Coordinator.instance = new Coordinator();
    }
    return Coordinator.instance;
  }

  /**
   * Inicializa el pool de nodos trabajadores según la configuración actual
   */
  private initCluster(): void {
    // Terminar nodos anteriores si existen
    this.nodes.forEach((n) => n.terminate());
    this.nodes.clear();

    for (let i = 1; i <= this.nodesCount; i++) {
      const nodeId = `node-${i}`;
      const nodeName = `Nodo Worker ${i}`;

      const wrapper = new WorkerNodeWrapper(
        nodeId,
        nodeName,
        this.threadsPerNode,
        {
          onHeartbeat: (nid) => this.handleHeartbeat(nid),
          onTaskCompleted: (nid, tid, slot, dur) => this.handleTaskCompleted(nid, tid, slot, dur),
          onTaskFailed: (nid, tid, slot, err) => this.handleTaskFailed(nid, tid, slot, err),
          onNodeCrashed: (nid) => this.handleNodeCrashed(nid),
        },
        this.minLatencyMs,
        this.maxLatencyMs
      );

      this.nodes.set(nodeId, wrapper);

      eventBus.publish('NODE_REGISTERED', `${nodeName} registrado con ${this.threadsPerNode} hilos concurrentes`, 'info', {
        nodeId,
      });
    }
  }

  /**
   * Inicia los bucles de orquestación (despacho, monitoreo de salud y métricas)
   */
  private startOrchestratorLoops(): void {
    // 1. Loop de Despacho (Dispatch Loop): Asigna tareas de la cola a nodos disponibles
    if (this.dispatchIntervalId) clearInterval(this.dispatchIntervalId);
    this.dispatchIntervalId = setInterval(() => this.dispatchTasks(), 80);

    // 2. Loop de Monitoreo de Heartbeats (Health Checker)
    if (this.healthCheckIntervalId) clearInterval(this.healthCheckIntervalId);
    this.healthCheckIntervalId = setInterval(() => this.checkNodesHealth(), 500);

    // 3. Loop de Cálculo de Throughput (Ventana deslizante cada 1 segundo)
    if (this.metricsIntervalId) clearInterval(this.metricsIntervalId);
    this.metricsIntervalId = setInterval(() => {
      const delta = this.completedCount - this.lastCompletedSnapshot;
      this.lastCompletedSnapshot = this.completedCount;
      this.currentThroughput = delta;
      if (delta > this.peakThroughput) {
        this.peakThroughput = delta;
      }
    }, 1000);
  }

  /**
   * Recibe un lote de tareas desde el Proxy de Entrada
   */
  public enqueueBatch(tasks: AppointmentTask[]): void {
    if (!this.isProcessingBatch || this.taskQueue.length === 0) {
      this.startTime = Date.now();
      this.isProcessingBatch = true;
    }

    tasks.forEach((task) => {
      this.allTasks.set(task.id, task);
      this.taskQueue.push(task);
      eventBus.publish('TASK_QUEUED', `Cita encolada: ${task.patientName} (${task.specialty}) vía ${task.channel.toUpperCase()}`, 'info', {
        taskId: task.id,
      });
    });

    // Forzar intento de despacho inmediato
    this.dispatchTasks();
  }

  /**
   * ALGORITMO DE BALANCEO: "Menos cargado" (Least Loaded Node)
   * Selecciona el nodo con menor ratio de utilización (activeThreads / maxThreads)
   * que tenga al menos un slot disponible.
   */
  private findLeastLoadedNode(): { node: WorkerNodeWrapper; slot: number } | null {
    let candidate: { node: WorkerNodeWrapper; slot: number; loadRatio: number } | null = null;

    for (const node of this.nodes.values()) {
      if (node.status === 'crashed' || node.status === 'offline') continue;

      const slot = node.getAvailableSlot();
      if (slot !== null) {
        const loadRatio = node.getLoadRatio();
        if (!candidate || loadRatio < candidate.loadRatio) {
          candidate = { node, slot, loadRatio };
        }
      }
    }

    if (!candidate) return null;
    return { node: candidate.node, slot: candidate.slot };
  }

  /**
   * Despacha tareas de la cola hacia los nodos con slots libres
   */
  private dispatchTasks(): void {
    if (this.taskQueue.length === 0) {
      // Verificar si todo terminó
      if (this.isProcessingBatch && this.getActiveTotalThreads() === 0) {
        this.isProcessingBatch = false;
      }
      return;
    }

    while (this.taskQueue.length > 0) {
      const target = this.findLeastLoadedNode();
      if (!target) {
        // Todos los nodos y slots están ocupados, esperar al siguiente ciclo
        break;
      }

      const task = this.taskQueue.shift()!;
      task.status = 'assigned';
      task.assignedNodeId = target.node.id;
      task.threadSlot = target.slot;
      task.startedAt = Date.now();

      const success = target.node.assignTask(task, target.slot);
      if (success) {
        eventBus.publish(
          'TASK_ASSIGNED',
          `Tarea ${task.id.slice(-6)} asignada a ${target.node.name} [Hilo #${target.slot + 1}] (Carga nodo: ${Math.round(target.node.getLoadRatio() * 100)}%)`,
          'info',
          {
            nodeId: target.node.id,
            taskId: task.id,
          }
        );
      } else {
        // Si falló la asignación al slot, devolver al inicio de la cola
        this.taskQueue.unshift(task);
        break;
      }
    }
  }

  /**
   * MONITOREO DE HEARTBEATS Y DETECCIÓN DE CAÍDAS
   */
  private checkNodesHealth(): void {
    const now = Date.now();

    this.nodes.forEach((node) => {
      if (node.status !== 'crashed' && node.status !== 'offline') {
        const timeSinceLastHeartbeat = now - node.lastHeartbeat;
        if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT_MS) {
          // El nodo dejó de responder: marcar caído por timeout de heartbeat
          node.markCrashed(`Heartbeat timeout: sin respuesta durante ${(timeSinceLastHeartbeat / 1000).toFixed(1)}s`);
        }
      }
    });
  }

  private handleHeartbeat(nodeId: string): void {
    // El nodo está saludable
  }

  /**
   * ============================================================================
   * PATRÓN RETRY: RECUPERACIÓN TRAS CAÍDA DE NODO
   * ============================================================================
   * Cuando un nodo colapsa, el Coordinador recupera las tareas que estaban
   * ejecutándose en sus hilos, incrementa su contador de reintentos y las
   * reinserta en la cola de tareas prioritarias.
   */
  private handleNodeCrashed(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const lostTasks = node.getActiveTasks();

    if (lostTasks.length > 0) {
      eventBus.publish(
        'NODE_CRASHED',
        `⚠️ Nodo ${node.name} cayó con ${lostTasks.length} tarea(s) en vuelo. Activando PATRÓN RETRY...`,
        'warning',
        { nodeId }
      );

      lostTasks.forEach((lostTask) => {
        const originalTask = this.allTasks.get(lostTask.id) || lostTask;
        originalTask.retries++;

        if (originalTask.retries <= originalTask.maxRetries) {
          originalTask.status = 'retrying';
          originalTask.assignedNodeId = undefined;
          originalTask.threadSlot = undefined;
          this.retriedCount++;

          // Reencolar al frente de la cola para ser atendida de inmediato por nodos sanos
          this.taskQueue.unshift(originalTask);

          eventBus.publish(
            'TASK_RETRIED',
            `🔄 [RETRY #${originalTask.retries}] Tarea ${originalTask.id.slice(-6)} (${originalTask.patientName}) recuperada y reencolada`,
            'warning',
            { taskId: originalTask.id, nodeId }
          );
        } else {
          originalTask.status = 'failed';
          originalTask.error = `Excedió reintentos máximos tras caída de nodo`;
          this.failedCount++;

          eventBus.publish(
            'TASK_FAILED',
            `❌ Tarea ${originalTask.id.slice(-6)} falló definitivamente tras ${originalTask.maxRetries} reintentos`,
            'error',
            { taskId: originalTask.id, nodeId }
          );
        }
      });
    }

    // Reintentar despacho en los nodos sobrevivientes
    this.dispatchTasks();
  }

  private handleTaskCompleted(nodeId: string, taskId: string, slotId: number, durationMs: number): void {
    const task = this.allTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = Date.now();
      task.durationMs = durationMs;
      this.completedCount++;
      this.totalLatenciesSum += durationMs;

      eventBus.publish(
        'TASK_COMPLETED',
        `✅ Recordatorio enviado a ${task.patientName} (${task.specialty}) vía ${task.channel.toUpperCase()} [${durationMs}ms]`,
        'success',
        { nodeId, taskId }
      );
    }
  }

  private handleTaskFailed(nodeId: string, taskId: string, slotId: number, error: string): void {
    const task = this.allTasks.get(taskId);
    if (!task) return;

    task.retries++;
    if (task.retries <= task.maxRetries) {
      task.status = 'retrying';
      this.retriedCount++;
      this.taskQueue.unshift(task);

      eventBus.publish(
        'TASK_RETRIED',
        `🔄 [RETRY #${task.retries}] Fallo transitorio en ${nodeId}: "${error}". Reintentando...`,
        'warning',
        { nodeId, taskId }
      );
    } else {
      task.status = 'failed';
      task.error = error;
      this.failedCount++;

      eventBus.publish(
        'TASK_FAILED',
        `❌ Error definitivo en tarea ${taskId.slice(-6)}: ${error}`,
        'error',
        { nodeId, taskId }
      );
    }
  }

  /**
   * Simula la caída manual de un nodo específico o uno aleatorio saludable
   */
  public simulateNodeFailure(targetNodeId?: string): string | null {
    let nodeToKill: WorkerNodeWrapper | undefined;

    if (targetNodeId) {
      nodeToKill = this.nodes.get(targetNodeId);
    } else {
      // Elegir aleatoriamente entre los nodos vivos
      const aliveNodes = Array.from(this.nodes.values()).filter(
        (n) => n.status !== 'crashed' && n.status !== 'offline'
      );
      if (aliveNodes.length === 0) return null;
      nodeToKill = aliveNodes[Math.floor(Math.random() * aliveNodes.length)];
    }

    if (nodeToKill && nodeToKill.status !== 'crashed') {
      const killedId = nodeToKill.id;
      nodeToKill.kill();
      return killedId;
    }
    return null;
  }

  /**
   * Revive un nodo específico o todos los nodos caídos
   */
  public reviveNodes(targetNodeId?: string): void {
    if (targetNodeId) {
      const node = this.nodes.get(targetNodeId);
      if (node && node.status === 'crashed') {
        node.revive();
      }
    } else {
      this.nodes.forEach((node) => {
        if (node.status === 'crashed') {
          node.revive();
        }
      });
    }
    this.dispatchTasks();
  }

  /**
   * Reconfigura la topología del cluster (número de nodos e hilos)
   */
  public configureTopology(nodeCount: number, threadsPerNode: number): void {
    if (nodeCount === this.nodesCount && threadsPerNode === this.threadsPerNode) return;

    this.nodesCount = Math.max(1, Math.min(8, nodeCount));
    this.threadsPerNode = Math.max(1, Math.min(8, threadsPerNode));
    this.initCluster();
  }

  public setLatencyRange(minMs: number, maxMs: number): void {
    this.minLatencyMs = minMs;
    this.maxLatencyMs = maxMs;
    this.nodes.forEach((n) => n.setLatency(minMs, maxMs));
  }

  public clearQueueAndMetrics(): void {
    this.taskQueue = [];
    this.allTasks.clear();
    this.completedCount = 0;
    this.failedCount = 0;
    this.retriedCount = 0;
    this.totalLatenciesSum = 0;
    this.currentThroughput = 0;
    this.peakThroughput = 0;
    this.isProcessingBatch = false;
    this.startTime = 0;
    eventBus.clearHistory();
    this.initCluster();
  }

  public getActiveTotalThreads(): number {
    let total = 0;
    this.nodes.forEach((n) => {
      total += n.getActiveThreadsCount();
    });
    return total;
  }

  public getClusterStates(): WorkerNodeState[] {
    const states: WorkerNodeState[] = [];
    this.nodes.forEach((node) => states.push(node.getState()));
    return states;
  }

  public getMetrics(): ClusterMetrics {
    const totalProcessed = this.completedCount + this.failedCount;
    const avgLatency = this.completedCount > 0 ? Math.round(this.totalLatenciesSum / this.completedCount) : 0;
    const elapsed = this.startTime > 0 ? (this.isProcessingBatch ? Date.now() - this.startTime : 0) : 0;

    let activeWorkers = 0;
    this.nodes.forEach((n) => {
      if (n.status !== 'crashed' && n.status !== 'offline') activeWorkers++;
    });

    return {
      totalSubmitted: this.allTasks.size,
      totalCompleted: this.completedCount,
      totalFailed: this.failedCount,
      totalRetried: this.retriedCount,
      queueLength: this.taskQueue.length,
      activeWorkersCount: activeWorkers,
      totalNodesCount: this.nodes.size,
      currentThroughput: this.currentThroughput,
      peakThroughput: this.peakThroughput,
      avgLatencyMs: avgLatency,
      elapsedTimeMs: elapsed,
      isRunning: this.isProcessingBatch || this.taskQueue.length > 0 || this.getActiveTotalThreads() > 0,
    };
  }

  public getQueuePreview(limit: number = 8): AppointmentTask[] {
    return this.taskQueue.slice(0, limit);
  }

  public cleanup(): void {
    if (this.dispatchIntervalId) clearInterval(this.dispatchIntervalId);
    if (this.healthCheckIntervalId) clearInterval(this.healthCheckIntervalId);
    if (this.metricsIntervalId) clearInterval(this.metricsIntervalId);
    this.nodes.forEach((n) => n.terminate());
    this.nodes.clear();
  }
}

export const coordinator = Coordinator.getInstance();
