/**
 * ============================================================================
 * CONTROLADOR DE NODO TRABAJADOR (MAIN THREAD WRAPPER)
 * ============================================================================
 * Representa la interfaz en el hilo principal para interactuar con cada
 * Web Worker real.
 * 
 * Gestiona:
 * - Ciclo de vida del hilo Web Worker.
 * - Despacho individual y por lotes (Micro-batching) para reducir IPC overhead.
 * - Registro y seguimiento de tareas en ejecución y en buffer local.
 * - Estado de salud (heartbeat, crash, recuperación).
 * - Notificaciones hacia el Coordinador y EventBus.
 */

import { AppointmentTask, NodeStatus, ThreadSlotInfo, WorkerNodeState } from '../types';
import { eventBus } from '../events/EventBus';

export interface NodeWorkerCallbacks {
  onHeartbeat: (nodeId: string, timestamp: number) => void;
  onTaskCompleted: (nodeId: string, taskId: string, slotId: number, durationMs: number) => void;
  onTaskFailed: (nodeId: string, taskId: string, slotId: number, error: string) => void;
  onNodeCrashed: (nodeId: string) => void;
}

export class WorkerNodeWrapper {
  public readonly id: string;
  public readonly name: string;
  public maxThreads: number;
  public status: NodeStatus = 'online';
  public lastHeartbeat: number = Date.now();
  public completedCount: number = 0;
  public failedCount: number = 0;

  private worker: Worker | null = null;
  private slots: Map<number, ThreadSlotInfo> = new Map();
  // Registro de tareas en vuelo / en buffer local del worker para recuperación en fallas
  private trackedTasks: Map<string, AppointmentTask> = new Map();
  private callbacks: NodeWorkerCallbacks;
  private minLatencyMs: number;
  private maxLatencyMs: number;

  constructor(
    id: string,
    name: string,
    maxThreads: number,
    callbacks: NodeWorkerCallbacks,
    minLatencyMs: number = 400,
    maxLatencyMs: number = 1000
  ) {
    this.id = id;
    this.name = name;
    this.maxThreads = maxThreads;
    this.callbacks = callbacks;
    this.minLatencyMs = minLatencyMs;
    this.maxLatencyMs = maxLatencyMs;

    this.initSlots();
    this.spawnWorker();
  }

  private initSlots(): void {
    this.slots.clear();
    for (let i = 0; i < this.maxThreads; i++) {
      this.slots.set(i, {
        slotId: i,
        isBusy: false,
        progressPercent: 0,
      });
    }
  }

  /**
   * Crea e inicia el Web Worker real
   */
  private spawnWorker(): void {
    try {
      this.worker = new Worker(new URL('./taskWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        this.handleWorkerMessage(e.data);
      };

      this.worker.onerror = (err) => {
        console.error(`Error en Web Worker ${this.name}:`, err);
        this.markCrashed('Error de ejecución en hilo Worker');
      };

      // Inicializar el worker con su configuración
      this.worker.postMessage({
        type: 'INIT',
        nodeId: this.id,
        nodeName: this.name,
        maxThreads: this.maxThreads,
        minLatencyMs: this.minLatencyMs,
        maxLatencyMs: this.maxLatencyMs,
      });

      this.status = 'online';
      this.lastHeartbeat = Date.now();
    } catch (err) {
      console.error(`No se pudo instanciar Web Worker para ${this.name}:`, err);
      this.status = 'crashed';
    }
  }

  private handleWorkerMessage(data: any): void {
    switch (data.type) {
      case 'READY':
        this.status = 'online';
        this.lastHeartbeat = Date.now();
        break;

      case 'HEARTBEAT':
        this.lastHeartbeat = data.timestamp || Date.now();
        if (this.status === 'crashed') {
          this.status = 'online';
        }
        this.callbacks.onHeartbeat(this.id, this.lastHeartbeat);
        break;

      case 'TASK_STARTED': {
        const slot = this.slots.get(data.threadSlot);
        const task = this.trackedTasks.get(data.taskId);
        if (slot) {
          slot.isBusy = true;
          slot.progressPercent = 5;
          if (task) {
            slot.currentTask = { ...task, status: 'processing', assignedNodeId: this.id, threadSlot: data.threadSlot };
          }
        }
        this.updateNodeStatus();
        break;
      }

      case 'TASK_PROGRESS': {
        const slot = this.slots.get(data.threadSlot);
        if (slot && (!slot.currentTask || slot.currentTask.id === data.taskId)) {
          slot.progressPercent = data.progressPercent;
        }
        break;
      }

      case 'TASK_COMPLETED': {
        const slot = this.slots.get(data.threadSlot);
        if (slot) {
          slot.isBusy = false;
          slot.progressPercent = 100;
          slot.currentTask = undefined;
        }
        this.trackedTasks.delete(data.taskId);
        this.completedCount++;
        this.updateNodeStatus();
        this.callbacks.onTaskCompleted(this.id, data.taskId, data.threadSlot, data.durationMs);
        break;
      }

      case 'TASK_FAILED': {
        const slot = this.slots.get(data.threadSlot);
        if (slot) {
          slot.isBusy = false;
          slot.progressPercent = 0;
          slot.currentTask = undefined;
        }
        this.trackedTasks.delete(data.taskId);
        this.failedCount++;
        this.updateNodeStatus();
        this.callbacks.onTaskFailed(this.id, data.taskId, data.threadSlot, data.error || 'Fallo desconocido');
        break;
      }

      case 'CRASHED':
        this.markCrashed('Mensaje de colapso recibido del nodo');
        break;

      case 'RECOVERED':
        this.status = 'online';
        this.lastHeartbeat = Date.now();
        eventBus.publish('NODE_RECOVERED', `Nodo ${this.name} se ha recuperado y está listo para recibir tareas`, 'success', {
          nodeId: this.id,
        });
        break;
    }
  }

  private updateNodeStatus(): void {
    if (this.status === 'crashed' || this.status === 'offline') return;
    const busyCount = this.getActiveThreadsCount();
    this.status = busyCount >= this.maxThreads ? 'busy' : 'online';
  }

  /**
   * Encuentra el primer slot/hilo disponible en este nodo
   */
  public getAvailableSlot(): number | null {
    if (this.status === 'crashed' || this.status === 'offline') return null;

    for (let i = 0; i < this.maxThreads; i++) {
      const slot = this.slots.get(i);
      if (slot && !slot.isBusy) {
        return i;
      }
    }
    return null;
  }

  /**
   * Despacho individual (1 tarea por postMessage)
   */
  public assignTask(task: AppointmentTask, slotId: number): boolean {
    if (this.status === 'crashed' || this.status === 'offline') return false;

    const slot = this.slots.get(slotId);
    if (!slot || slot.isBusy) return false;

    slot.isBusy = true;
    slot.progressPercent = 5;
    slot.currentTask = { ...task, status: 'processing', assignedNodeId: this.id, threadSlot: slotId };

    this.trackedTasks.set(task.id, task);
    this.updateNodeStatus();

    this.worker?.postMessage({
      type: 'ASSIGN_TASK',
      taskId: task.id,
      threadSlot: slotId,
      taskData: {
        patientName: task.patientName,
        specialty: task.specialty,
        channel: task.channel,
      },
    });

    return true;
  }

  /**
   * Despacho optimizado por lotes (Micro-batching: múltiples tareas en un único postMessage)
   * Reduce drásticamente la sobrecarga de serialización structuredClone.
   */
  public assignBatch(tasks: AppointmentTask[]): boolean {
    if (this.status === 'crashed' || this.status === 'offline' || tasks.length === 0) return false;

    const batchPayload: Array<{
      taskId: string;
      threadSlot?: number;
      taskData: {
        patientName: string;
        specialty: string;
        channel: string;
      };
    }> = [];

    for (const task of tasks) {
      this.trackedTasks.set(task.id, task);
      batchPayload.push({
        taskId: task.id,
        taskData: {
          patientName: task.patientName,
          specialty: task.specialty,
          channel: task.channel,
        },
      });
    }

    this.updateNodeStatus();

    // UN SOLO postMessage para todo el micro-lote
    this.worker?.postMessage({
      type: 'ASSIGN_BATCH',
      tasks: batchPayload,
    });

    return true;
  }

  /**
   * Retorna todas las tareas activas y en buffer de este nodo.
   * Utilizado para recuperación de fallos mediante el Patrón Retry.
   */
  public getActiveTasks(): AppointmentTask[] {
    const tasks: AppointmentTask[] = [];
    this.trackedTasks.forEach((task) => {
      tasks.push({ ...task });
    });
    return tasks;
  }

  /**
   * Simula la caída forzada del nodo (desconexión o falla de hardware)
   */
  public kill(): void {
    this.status = 'crashed';
    this.worker?.postMessage({ type: 'KILL' });
    this.markCrashed('Falla inducida manualmente para pruebas de resiliencia');
  }

  /**
   * Restaura y reactiva un nodo caído
   */
  public revive(): void {
    if (!this.worker) {
      this.spawnWorker();
    } else {
      this.worker.postMessage({ type: 'REVIVE' });
    }
    this.status = 'online';
    this.lastHeartbeat = Date.now();
    this.trackedTasks.clear();
    this.initSlots();
  }

  public markCrashed(reason: string): void {
    this.status = 'crashed';
    this.slots.forEach((slot) => {
      slot.isBusy = false;
      slot.progressPercent = 0;
      slot.currentTask = undefined;
    });

    eventBus.publish('NODE_CRASHED', `Nodo ${this.name} colapsó: ${reason}`, 'error', {
      nodeId: this.id,
    });
    this.callbacks.onNodeCrashed(this.id);
  }

  public getActiveThreadsCount(): number {
    let count = 0;
    this.slots.forEach((s) => {
      if (s.isBusy) count++;
    });
    return count;
  }

  /**
   * Retorna ratio de carga (0.0 a 1.0+) considerando tareas activas y en buffer local
   */
  public getLoadRatio(): number {
    if (this.status === 'crashed' || this.status === 'offline') return 100.0;
    const totalWorking = Math.max(this.getActiveThreadsCount(), this.trackedTasks.size);
    return totalWorking / this.maxThreads;
  }

  public getState(): WorkerNodeState {
    const slotList: ThreadSlotInfo[] = [];
    for (let i = 0; i < this.maxThreads; i++) {
      const s = this.slots.get(i);
      slotList.push(
        s
          ? { ...s }
          : {
              slotId: i,
              isBusy: false,
              progressPercent: 0,
            }
      );
    }

    const activeCount = this.getActiveThreadsCount();
    const bufferedCount = Math.max(0, this.trackedTasks.size - activeCount);

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      maxThreads: this.maxThreads,
      activeThreads: activeCount,
      bufferedCount,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      lastHeartbeat: this.lastHeartbeat,
      slots: slotList,
    };
  }

  public setLatency(minMs: number, maxMs: number): void {
    this.minLatencyMs = minMs;
    this.maxLatencyMs = maxMs;
    this.worker?.postMessage({
      type: 'CONFIG',
      minLatencyMs: minMs,
      maxLatencyMs: maxMs,
    });
  }

  public setThreads(newThreads: number): void {
    this.maxThreads = newThreads;
    this.initSlots();
    this.worker?.postMessage({
      type: 'CONFIG',
      maxThreads: newThreads,
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.status = 'offline';
  }
}
