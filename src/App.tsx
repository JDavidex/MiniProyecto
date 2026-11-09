import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricsGrid } from './components/MetricsGrid';
import { ControlPanel } from './components/ControlPanel';
import { ClusterNodeGrid } from './components/ClusterNodeGrid';
import { QueueVisualizer } from './components/QueueVisualizer';
import { EventLog } from './components/EventLog';
import { BenchmarkModal } from './components/BenchmarkModal';
import { ArchitectureDocs } from './components/ArchitectureDocs';
import { coordinator } from './coordinator/Coordinator';
import { hospitalProxy } from './proxy/HospitalReminderProxy';
import { eventBus } from './events/EventBus';
import { AppointmentTask, ChannelType, ClusterMetrics, SystemEvent, WorkerNodeState } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'cluster' | 'benchmark' | 'architecture'>('cluster');
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);

  // Topología actual
  const [nodesCount, setNodesCount] = useState<number>(4);
  const [threadsPerNode, setThreadsPerNode] = useState<number>(2);

  // Estados del cluster
  const [metrics, setMetrics] = useState<ClusterMetrics>(() => coordinator.getMetrics());
  const [nodes, setNodes] = useState<WorkerNodeState[]>(() => coordinator.getClusterStates());
  const [queue, setQueue] = useState<AppointmentTask[]>(() => coordinator.getQueuePreview(8));
  const [events, setEvents] = useState<SystemEvent[]>(() => eventBus.getHistory());

  // Suscripción al EventBus (Patrón Observer)
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('*', (newEvent) => {
      setEvents((prev) => [newEvent, ...prev.slice(0, 199)]);
    });

    return () => unsubscribe();
  }, []);

  // Intervalo de actualización en vivo de métricas y estados de hilos (100ms)
  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics(coordinator.getMetrics());
      setNodes(coordinator.getClusterStates());
      setQueue(coordinator.getQueuePreview(8));
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // Handlers
  const handleTopologyChange = useCallback((newNodes: number, newThreads: number) => {
    setNodesCount(newNodes);
    setThreadsPerNode(newThreads);
    coordinator.configureTopology(newNodes, newThreads);
  }, []);

  const handleSubmitBatch = useCallback((batchSize: number, channel?: ChannelType) => {
    hospitalProxy.submitBatch({
      batchSize,
      forcedChannel: channel,
      maxRetries: 3,
    });
  }, []);

  const handleSimulateFailure = useCallback(() => {
    coordinator.simulateNodeFailure();
  }, []);

  const handleReviveAll = useCallback(() => {
    coordinator.reviveNodes();
  }, []);

  const handleKillNode = useCallback((nodeId: string) => {
    coordinator.simulateNodeFailure(nodeId);
  }, []);

  const handleReviveNode = useCallback((nodeId: string) => {
    coordinator.reviveNodes(nodeId);
  }, []);

  const handleReset = useCallback(() => {
    coordinator.clearQueueAndMetrics();
    setEvents([]);
  }, []);

  const handleLatencyChange = useCallback((minMs: number, maxMs: number) => {
    coordinator.setLatencyRange(minMs, maxMs);
  }, []);

  const hasCrashedNodes = nodes.some((n) => n.status === 'crashed');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. Header con estado del cluster y navegación */}
      <Header
        metrics={metrics}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBenchmark={() => setIsBenchmarkModalOpen(true)}
      />

      {/* 2. Contenido Principal según Pestaña */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'cluster' && (
          <>
            {/* Panel de Métricas / KPIs en vivo */}
            <MetricsGrid metrics={metrics} />

            {/* Panel de Control de Despacho (Proxy & Mediador) */}
            <ControlPanel
              nodesCount={nodesCount}
              threadsPerNode={threadsPerNode}
              onTopologyChange={handleTopologyChange}
              onSubmitBatch={handleSubmitBatch}
              onSimulateFailure={handleSimulateFailure}
              onReviveAll={handleReviveAll}
              onReset={handleReset}
              onOpenBenchmark={() => setIsBenchmarkModalOpen(true)}
              onLatencyChange={handleLatencyChange}
              isProcessing={metrics.isRunning}
              hasCrashedNodes={hasCrashedNodes}
            />

            {/* Cola de Tareas en Espera */}
            <QueueVisualizer
              queue={queue}
              totalInQueue={metrics.queueLength}
            />

            {/* Grilla de Nodos Trabajadores y Slots de Hilos Concurrentes */}
            <ClusterNodeGrid
              nodes={nodes}
              onKillNode={handleKillNode}
              onReviveNode={handleReviveNode}
            />

            {/* Log de Eventos en Tiempo Real (Observer) */}
            <EventLog
              events={events}
              onClear={() => setEvents([])}
            />
          </>
        )}

        {activeTab === 'benchmark' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Módulo de Evaluación de Escalabilidad</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ejecuta pruebas empíricas automáticas con 1, 2, 4 y 8 nodos para medir Speedup y Throughput.
                </p>
              </div>
              <button
                onClick={() => setIsBenchmarkModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Abrir Suite de Benchmark
              </button>
            </div>
            {/* Si el modal no está abierto, también se puede abrir directamente */}
            {!isBenchmarkModalOpen && (
              <div className="text-center py-12">
                <button
                  onClick={() => setIsBenchmarkModalOpen(true)}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  🚀 Iniciar Comparativa de Escalabilidad (1, 2, 4 y 8 Nodos)
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && <ArchitectureDocs />}
      </main>

      {/* 3. Modal de Benchmark Completo */}
      <BenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
      />

      {/* 4. Footer Académico */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-4 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            VerdeSalud - Prototipo de Sistema Distribuido de Recordatorios
          </span>
          <span className="font-mono text-[11px] text-emerald-400">
            React 19 + HTML5 Web Workers Multi-Core + Vite
          </span>
          <span>
            Unidad 2: Arquitectura de Software entre Hilos y Nodos
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
