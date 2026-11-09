import React from 'react';
import { CheckCircle2, Zap, Clock, Layers, RotateCcw, AlertOctagon } from 'lucide-react';
import { ClusterMetrics } from '../types';

interface MetricsGridProps {
  metrics: ClusterMetrics;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  const percentComplete =
    metrics.totalSubmitted > 0
      ? Math.round(((metrics.totalCompleted + metrics.totalFailed) / metrics.totalSubmitted) * 100)
      : 0;

  const secondsElapsed = (metrics.elapsedTimeMs / 1000).toFixed(1);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Tareas Completadas */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Recordatorios</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold font-mono text-slate-800">{metrics.totalCompleted}</span>
          <span className="text-xs text-slate-400">/ {metrics.totalSubmitted}</span>
        </div>
        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 mt-1">
          <span>{percentComplete}% completado</span>
          {metrics.totalFailed > 0 && <span className="text-rose-500 font-medium">({metrics.totalFailed} fallos)</span>}
        </div>
      </div>

      {/* 2. Throughput en Vivo */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Throughput</span>
          <Zap className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold font-mono text-emerald-600">{metrics.currentThroughput}</span>
          <span className="text-xs font-medium text-slate-500">t/seg</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
          <span>Pico máximo:</span>
          <span className="font-semibold text-slate-700 font-mono">{metrics.peakThroughput} t/s</span>
        </div>
      </div>

      {/* 3. Latencia Promedio */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Latencia Media</span>
          <Clock className="h-4 w-4 text-teal-500" />
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold font-mono text-slate-800">{metrics.avgLatencyMs}</span>
          <span className="text-xs font-medium text-slate-500">ms</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
          <span>Tiempo lote:</span>
          <span className="font-mono font-medium text-slate-700">{secondsElapsed}s</span>
        </div>
      </div>

      {/* 4. Cola del Coordinador */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Cola Pendiente</span>
          <Layers className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold font-mono text-slate-800">{metrics.queueLength}</span>
          <span className="text-xs font-medium text-slate-500">tareas</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-2">
          {metrics.queueLength > 0 ? (
            <span className="text-indigo-600 font-medium">Despachando...</span>
          ) : (
            <span className="text-slate-400">Cola desocupada</span>
          )}
        </div>
      </div>

      {/* 5. Patrón Retry / Reintentos */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Reintentos (Retry)</span>
          <RotateCcw className="h-4 w-4 text-purple-500" />
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold font-mono text-purple-600">{metrics.totalRetried}</span>
          <span className="text-xs font-medium text-slate-500">recuperadas</span>
        </div>
        <div className="text-[11px] text-purple-700/80 mt-2 flex items-center space-x-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500"></span>
          <span>Patrón Retry activo</span>
        </div>
      </div>

      {/* 6. Estado de Nodos */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Salud del Cluster</span>
          <AlertOctagon className={`h-4 w-4 ${metrics.activeWorkersCount < metrics.totalNodesCount ? 'text-rose-500' : 'text-emerald-500'}`} />
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold font-mono text-slate-800">
            {metrics.activeWorkersCount}
          </span>
          <span className="text-xs text-slate-400">/ {metrics.totalNodesCount} vivos</span>
        </div>
        <div className="text-[11px] mt-2">
          {metrics.activeWorkersCount === metrics.totalNodesCount ? (
            <span className="text-emerald-600 font-medium">● 100% Operativo</span>
          ) : (
            <span className="text-rose-600 font-medium">● Degradado por fallo</span>
          )}
        </div>
      </div>
    </div>
  );
};

