import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Filter, Trash2, ArrowDownCircle, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { SystemEvent } from '../types';

interface EventLogProps {
  events: SystemEvent[];
  onClear: () => void;
}

export const EventLog: React.FC<EventLogProps> = ({ events, onClear }) => {
  const [filter, setFilter] = useState<'all' | 'assigned' | 'completed' | 'errors' | 'heartbeat'>('all');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'assigned') return e.type === 'TASK_ASSIGNED' || e.type === 'TASK_QUEUED';
    if (filter === 'completed') return e.type === 'TASK_COMPLETED';
    if (filter === 'errors') {
      return (
        e.type === 'TASK_FAILED' ||
        e.type === 'TASK_RETRIED' ||
        e.type === 'NODE_CRASHED' ||
        e.severity === 'error' ||
        e.severity === 'warning'
      );
    }
    if (filter === 'heartbeat') return e.type === 'NODE_HEARTBEAT' || e.type === 'NODE_REGISTERED';
    return true;
  });

  const getSeverityBadge = (e: SystemEvent) => {
    switch (e.severity) {
      case 'success':
        return (
          <span className="inline-flex items-center text-emerald-400 font-mono text-[10px]">
            <CheckCircle className="h-3 w-3 mr-1 text-emerald-400 shrink-0" /> [OK]
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center text-amber-400 font-mono text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1 text-amber-400 shrink-0" /> [RETRY]
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center text-rose-400 font-mono text-[10px]">
            <AlertCircle className="h-3 w-3 mr-1 text-rose-400 shrink-0" /> [FAIL]
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-sky-400 font-mono text-[10px]">
            <Info className="h-3 w-3 mr-1 text-sky-400 shrink-0" /> [INFO]
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-md flex flex-col h-[380px] overflow-hidden">
      {/* Barra Superior del Log */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-100">Log de Eventos en Tiempo Real</span>
          <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
            Patrón Observer
          </span>
        </div>

        {/* Filtros */}
        <div className="flex items-center space-x-1 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({events.length})
          </button>
          <button
            onClick={() => setFilter('assigned')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              filter === 'assigned' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Asignaciones
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              filter === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Éxito
          </button>
          <button
            onClick={() => setFilter('errors')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              filter === 'errors' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Retry / Fallos
          </button>
        </div>

        {/* Acciones */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center space-x-1 cursor-pointer transition-colors ${
              autoScroll ? 'bg-slate-800 text-emerald-300' : 'bg-slate-800/50 text-slate-500'
            }`}
            title="Conmutar scroll automático"
          >
            <ArrowDownCircle className="h-3 w-3" />
            <span>AutoScroll: {autoScroll ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Limpiar log"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Contenedor del Log */}
      <div
        ref={logContainerRef}
        className="flex-1 p-3 font-mono text-[11px] overflow-y-auto space-y-1.5 scroll-smooth"
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            No hay eventos registrados bajo el filtro seleccionado.
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const timeStr = new Date(evt.timestamp).toLocaleTimeString('es-CO', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={evt.id}
                className="flex items-start space-x-2 leading-relaxed hover:bg-slate-800/40 p-0.5 rounded transition-colors"
              >
                <span className="text-slate-500 shrink-0 font-medium">{timeStr}</span>
                <span className="shrink-0">{getSeverityBadge(evt)}</span>
                <span
                  className={`break-all ${
                    evt.severity === 'error'
                      ? 'text-rose-300 font-semibold'
                      : evt.severity === 'warning'
                      ? 'text-amber-300'
                      : evt.severity === 'success'
                      ? 'text-emerald-200'
                      : 'text-slate-300'
                  }`}
                >
                  {evt.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
