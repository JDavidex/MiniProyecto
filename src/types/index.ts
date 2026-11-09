/**
 * Tipos y definiciones del Sistema Distribuido de Recordatorios - VerdeSalud
 */

export type ChannelType = 'whatsapp' | 'sms' | 'email' | 'call';

export type DispatchMode = 'individual' | 'batch';

export type TaskStatus = 
  | 'queued'      // En cola del Coordinador
  | 'assigned'    // Asignada a un nodo
  | 'processing'  // En ejecución activa en un hilo del Web Worker
  | 'completed'   // Finalizada exitosamente
  | 'failed'      // Falló y agotó reintentos
  | 'retrying';   // En proceso de reintento tras falla de nodo

export interface AppointmentTask {
  id: string;
  patientName: string;
  patientPhone: string;
  specialty: string;
  appointmentDate: string;
  channel: ChannelType;
  status: TaskStatus;
  assignedNodeId?: string;
  threadSlot?: number;
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

export type NodeStatus = 'online' | 'busy' | 'crashed' | 'offline';

export interface ThreadSlotInfo {
  slotId: number;
  isBusy: boolean;
  currentTask?: AppointmentTask;
  progressPercent: number; // 0 - 100
}

export interface WorkerNodeState {
  id: string;
  name: string;
  status: NodeStatus;
  maxThreads: number;
  activeThreads: number;
  bufferedCount: number;
  completedCount: number;
  failedCount: number;
  lastHeartbeat: number;
  slots: ThreadSlotInfo[];
}

export type EventSeverity = 'info' | 'success' | 'warning' | 'error';

export type EventType = 
  | 'TASK_QUEUED'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_RETRIED'
  | 'NODE_REGISTERED'
  | 'NODE_HEARTBEAT'
  | 'NODE_CRASHED'
  | 'NODE_RECOVERED'
  | 'BATCH_SUBMITTED'
  | 'BENCHMARK_START'
  | 'BENCHMARK_STEP'
  | 'BENCHMARK_COMPLETE';

export interface SystemEvent {
  id: string;
  timestamp: number;
  type: EventType;
  message: string;
  severity: EventSeverity;
  nodeId?: string;
  taskId?: string;
  details?: Record<string, unknown>;
}

export interface ClusterMetrics {
  totalSubmitted: number;
  totalCompleted: number;
  totalFailed: number;
  totalRetried: number;
  queueLength: number;
  activeWorkersCount: number;
  totalNodesCount: number;
  currentThroughput: number; // tareas por segundo
  peakThroughput: number;
  avgLatencyMs: number;
  elapsedTimeMs: number;
  isRunning: boolean;
  dispatchMode: DispatchMode;
  batchChunkSize: number;
}

export interface BenchmarkStepResult {
  nodesCount: number;
  threadsPerNode: number;
  totalConcurrency: number;
  totalTasks: number;
  durationMs: number;
  throughput: number; // tareas/segundo
  avgLatencyMs: number;
  speedup: number;     // Tiempo(1 nodo) / Tiempo(N nodos)
  efficiency: number;  // Speedup / N
  dispatchMode: DispatchMode;
  batchChunkSize: number;
}

export interface BenchmarkReport {
  timestamp: string;
  taskBatchSize: number;
  threadsPerNode: number;
  dispatchMode: DispatchMode;
  batchChunkSize: number;
  results: BenchmarkStepResult[];
}
