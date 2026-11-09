/**
 * ============================================================================
 * MOTOR DE BENCHMARK DISTRIBUIDO & EVALUACIÓN DE ESCALABILIDAD
 * ============================================================================
 * Propósito:
 * Evalúa empíricamente la escalabilidad horizontal y la aceleración (Speedup)
 * del sistema distribuido de VerdeSalud procesando lotes idénticos con:
 * - 1 Nodo
 * - 2 Nodos
 * - 4 Nodos
 * - 8 Nodos
 * 
 * Permite contrastar con la Ley de Amdahl y comparar:
 * 1. Modo Individual (1 tarea por postMessage)
 * 2. Modo Por Lotes (Micro-batching de N tareas por postMessage)
 * para mitigar la saturación de IPC en 8 nodos.
 */

import { BenchmarkReport, BenchmarkStepResult, DispatchMode } from '../types';
import { coordinator } from '../coordinator/Coordinator';
import { hospitalProxy } from '../proxy/HospitalReminderProxy';
import { eventBus } from '../events/EventBus';

export type BenchmarkProgressCallback = (
  currentStep: number,
  totalSteps: number,
  currentNodes: number,
  partialResults: BenchmarkStepResult[]
) => void;

export class BenchmarkRunner {
  private isRunning: boolean = false;
  private abortController: boolean = false;

  public async runBenchmark(
    tasksPerBatch: number = 60,
    threadsPerNode: number = 2,
    dispatchMode: DispatchMode = 'batch',
    batchChunkSize: number = 4,
    onProgress?: BenchmarkProgressCallback
  ): Promise<BenchmarkReport> {
    if (this.isRunning) {
      throw new Error('Ya hay un benchmark en ejecución.');
    }

    this.isRunning = true;
    this.abortController = false;

    const nodeConfigurations = [1, 2, 4, 8];
    const results: BenchmarkStepResult[] = [];
    let baselineDurationMs = 0;

    eventBus.publish(
      'BENCHMARK_START',
      `Iniciando Benchmark: ${tasksPerBatch} tareas con [1, 2, 4, 8] nodos | Modo: ${dispatchMode.toUpperCase()} (${dispatchMode === 'batch' ? `${batchChunkSize} tareas/msg` : '1 tarea/msg'})`,
      'warning'
    );

    try {
      for (let i = 0; i < nodeConfigurations.length; i++) {
        if (this.abortController) {
          eventBus.publish('BENCHMARK_COMPLETE', 'Benchmark interrumpido por el usuario', 'info');
          break;
        }

        const nodesCount = nodeConfigurations[i];

        if (onProgress) {
          onProgress(i + 1, nodeConfigurations.length, nodesCount, [...results]);
        }

        eventBus.publish(
          'BENCHMARK_STEP',
          `Fase ${i + 1}/${nodeConfigurations.length}: Prueba con ${nodesCount} Nodo(s) (${nodesCount * threadsPerNode} hilos totales) [${dispatchMode.toUpperCase()}]...`,
          'info'
        );

        // 1. Configurar topología y modo de despacho en el coordinador
        coordinator.clearQueueAndMetrics();
        coordinator.configureTopology(nodesCount, threadsPerNode);
        coordinator.setDispatchMode(dispatchMode, batchChunkSize);
        // Usar latencia uniforme para el benchmark (150-250ms)
        coordinator.setLatencyRange(150, 250);

        // Pausa breve para estabilizar Workers
        await new Promise((resolve) => setTimeout(resolve, 300));

        // 2. Medir tiempo de procesamiento
        const startTime = performance.now();
        hospitalProxy.submitBatch({
          batchSize: tasksPerBatch,
          maxRetries: 3,
        });

        // 3. Esperar hasta que todas las tareas se completen
        await this.waitForBatchCompletion(tasksPerBatch);

        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);

        if (nodesCount === 1) {
          baselineDurationMs = durationMs;
        }

        const durationSec = durationMs / 1000;
        const throughput = Number((tasksPerBatch / durationSec).toFixed(2));
        const speedup = baselineDurationMs > 0 ? Number((baselineDurationMs / durationMs).toFixed(2)) : 1.0;
        const efficiency = Number((speedup / nodesCount).toFixed(2));
        const metrics = coordinator.getMetrics();

        const stepResult: BenchmarkStepResult = {
          nodesCount,
          threadsPerNode,
          totalConcurrency: nodesCount * threadsPerNode,
          totalTasks: tasksPerBatch,
          durationMs,
          throughput,
          avgLatencyMs: metrics.avgLatencyMs,
          speedup,
          efficiency,
          dispatchMode,
          batchChunkSize: dispatchMode === 'batch' ? batchChunkSize : 1,
        };

        results.push(stepResult);

        if (onProgress) {
          onProgress(i + 1, nodeConfigurations.length, nodesCount, [...results]);
        }

        // Breve pausa entre fases
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      eventBus.publish(
        'BENCHMARK_COMPLETE',
        `Suite finalizada [${dispatchMode.toUpperCase()}]. Aceleración máxima alcanzada: ${results[results.length - 1]?.speedup}x`,
        'success'
      );

      return {
        timestamp: new Date().toISOString(),
        taskBatchSize: tasksPerBatch,
        threadsPerNode,
        dispatchMode,
        batchChunkSize: dispatchMode === 'batch' ? batchChunkSize : 1,
        results,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private waitForBatchCompletion(expectedTasks: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.abortController) {
          clearInterval(checkInterval);
          reject(new Error('Benchmark cancelado'));
          return;
        }

        const metrics = coordinator.getMetrics();
        const completedOrFailed = metrics.totalCompleted + metrics.totalFailed;

        if (
          completedOrFailed >= expectedTasks &&
          metrics.queueLength === 0 &&
          coordinator.getActiveTotalThreads() === 0 &&
          coordinator.getTotalBufferedCount() === 0
        ) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 40);
    });
  }

  public stop(): void {
    this.abortController = true;
    this.isRunning = false;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Genera el contenido CSV y activa la descarga en el navegador
   */
  public static exportToCSV(report: BenchmarkReport): void {
    const headers = [
      'Nodos',
      'HilosPorNodo',
      'ConcurrenciaTotal',
      'TareasLote',
      'ModoDespacho',
      'TamanoLoteMsg',
      'TiempoTotalMs',
      'TiempoTotalSeg',
      'ThroughputTareasPorSeg',
      'LatenciaPromedioMs',
      'Speedup',
      'Eficiencia',
    ];

    const rows = report.results.map((r) => [
      r.nodesCount,
      r.threadsPerNode,
      r.totalConcurrency,
      r.totalTasks,
      r.dispatchMode === 'batch' ? 'Por Lotes (Micro-batching)' : 'Individual (1 tarea/msg)',
      r.batchChunkSize,
      r.durationMs,
      (r.durationMs / 1000).toFixed(2),
      r.throughput,
      r.avgLatencyMs,
      r.speedup,
      r.efficiency,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `verdesalud-benchmark-${report.dispatchMode}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const benchmarkRunner = new BenchmarkRunner();
