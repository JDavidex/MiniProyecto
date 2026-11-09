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
 * Permite contrastar con la Ley de Amdahl y obtener métricas para la rúbrica.
 */

import { BenchmarkReport, BenchmarkStepResult } from '../types';
import { coordinator } from '../coordinator/Coordinator';
import { hospitalProxy } from '../proxy/HospitalReminderProxy';
import { eventBus } from '../events/EventBus';

export type BenchmarkProgressCallback = (currentStep: number, totalSteps: number, currentNodes: number, partialResults: BenchmarkStepResult[]) => void;

export class BenchmarkRunner {
  private isRunning: boolean = false;
  private abortController: boolean = false;

  public async runBenchmark(
    tasksPerBatch: number = 60,
    threadsPerNode: number = 2,
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

    eventBus.publish('BENCHMARK_START', `Iniciando suite de Benchmark: ${tasksPerBatch} tareas por prueba con [1, 2, 4, 8] nodos`, 'warning');

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
          `Ejecutando Fase ${i + 1}/${nodeConfigurations.length}: Prueba con ${nodesCount} Nodo(s) (${nodesCount * threadsPerNode} hilos totales)...`,
          'info'
        );

        // 1. Configurar topología en el coordinador
        coordinator.clearQueueAndMetrics();
        coordinator.configureTopology(nodesCount, threadsPerNode);
        // Usar latencia rápida y uniforme para el benchmark (ej. 150-300ms)
        coordinator.setLatencyRange(150, 300);

        // Pequeña pausa para estabilizar workers
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
        };

        results.push(stepResult);

        if (onProgress) {
          onProgress(i + 1, nodeConfigurations.length, nodesCount, [...results]);
        }

        // Breve pausa entre fases
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      eventBus.publish('BENCHMARK_COMPLETE', 'Suite de Benchmark finalizada con éxito. Gráficos y tabla listos.', 'success');

      return {
        timestamp: new Date().toISOString(),
        taskBatchSize: tasksPerBatch,
        threadsPerNode,
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

        if (completedOrFailed >= expectedTasks && metrics.queueLength === 0 && coordinator.getActiveTotalThreads() === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
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
    link.setAttribute('download', `verdesalud-benchmark-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const benchmarkRunner = new BenchmarkRunner();
