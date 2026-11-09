import React from 'react';
import { Activity, Server, Cpu, AlertTriangle, Layers, Zap, BarChart3, BookOpen, ShieldCheck } from 'lucide-react';
import { ClusterMetrics } from '../types';

interface HeaderProps {
  metrics: ClusterMetrics;
  activeTab: 'cluster' | 'benchmark' | 'architecture';
  setActiveTab: (tab: 'cluster' | 'benchmark' | 'architecture') => void;
  onOpenBenchmark: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  metrics,
  activeTab,
  setActiveTab,
  onOpenBenchmark,
}) => {
  const crashedCount = metrics.totalNodesCount - metrics.activeWorkersCount;

  return (
    <header className="bg-emerald-900 text-white border-b border-emerald-800 shadow-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo y Título */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">VerdeSalud</span>
                <span className="bg-emerald-700/60 text-emerald-200 text-xs px-2 py-0.5 rounded-full font-medium border border-emerald-600/50">
                  Task Cluster v2.0
                </span>
                <span className="hidden sm:inline-flex items-center text-xs text-teal-300 font-mono bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
                  <ShieldCheck className="h-3 w-3 mr-1 text-teal-400" /> Web Workers Multi-hilo
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">
                Sistema Distribuido de Recordatorios de Citas Médicas | Unidad 2: Arquitectura entre Hilos y Nodos
              </p>
            </div>
          </div>

          {/* Estado Rápido del Cluster (Badges) */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <div className="flex items-center bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-1.5 rounded-lg">
              <Server className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              <span className="text-emerald-300 mr-1">Nodos Vivos:</span>
              <span className="font-semibold text-white font-mono">
                {metrics.activeWorkersCount} / {metrics.totalNodesCount}
              </span>
            </div>

            {crashedCount > 0 && (
              <div className="flex items-center bg-rose-950/80 border border-rose-700 px-2.5 py-1.5 rounded-lg text-rose-200 animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-rose-400" />
                <span className="font-semibold">{crashedCount} Caído(s)</span>
              </div>
            )}

            <div className="flex items-center bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-1.5 rounded-lg">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-teal-400" />
              <span className="text-emerald-300 mr-1">En Cola:</span>
              <span className="font-semibold text-white font-mono">{metrics.queueLength}</span>
            </div>

            <div className="flex items-center bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-1.5 rounded-lg">
              <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
              <span className="text-emerald-300 mr-1">Throughput:</span>
              <span className="font-semibold text-white font-mono">{metrics.currentThroughput} t/s</span>
            </div>
          </div>
        </div>

        {/* Barra de Navegación de Pestañas */}
        <div className="flex items-center space-x-2 mt-3 pt-2.5 border-t border-emerald-800/60">
          <button
            onClick={() => setActiveTab('cluster')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'cluster'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Monitor del Cluster en Vivo</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('benchmark');
              onOpenBenchmark();
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'benchmark'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Benchmark de Escalabilidad (1, 2, 4, 8 Nodos)</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'architecture'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Arquitectura y Patrones UML</span>
          </button>
        </div>
      </div>
    </header>
  );
};
