import React from 'react';
import { Server, Skull, RefreshCw, Cpu, Activity, MessageCircle, Mail, Phone, PhoneCall } from 'lucide-react';
import { ChannelType, WorkerNodeState } from '../types';

interface ClusterNodeGridProps {
  nodes: WorkerNodeState[];
  onKillNode: (nodeId: string) => void;
  onReviveNode: (nodeId: string) => void;
}

const getChannelIcon = (channel: ChannelType) => {
  switch (channel) {
    case 'whatsapp':
      return <MessageCircle className="h-3 w-3 text-emerald-500" />;
    case 'sms':
      return <Phone className="h-3 w-3 text-sky-500" />;
    case 'email':
      return <Mail className="h-3 w-3 text-indigo-500" />;
    case 'call':
      return <PhoneCall className="h-3 w-3 text-amber-500" />;
  }
};

export const ClusterNodeGrid: React.FC<ClusterNodeGridProps> = ({
  nodes,
  onKillNode,
  onReviveNode,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            Topología de Nodos y Concurrencia de Hilos (Web Workers)
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            ({nodes.length} Nodos activos en hilos independientes del SO)
          </span>
        </div>
        <div className="text-xs text-slate-500 flex items-center space-x-3">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 inline-block"></span>
            Saludable
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5 inline-block"></span>
            100% Carga
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5 inline-block"></span>
            Caído / Timeout
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {nodes.map((node) => {
          const isCrashed = node.status === 'crashed';
          const isBusy = node.status === 'busy';
          const loadPercent = Math.round((node.activeThreads / node.maxThreads) * 100);
          const timeSinceHeartbeat = Math.max(0, Math.round((Date.now() - node.lastHeartbeat) / 100) / 10);

          return (
            <div
              key={node.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isCrashed
                  ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/40 shadow-xs'
                  : isBusy
                  ? 'bg-white border-amber-300 shadow-xs'
                  : 'bg-white border-slate-200/90 hover:border-emerald-300 shadow-xs'
              }`}
            >
              {/* Encabezado del Nodo */}
              <div className={`p-3 border-b flex items-center justify-between ${
                isCrashed ? 'bg-rose-100/60 border-rose-200' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${
                    isCrashed ? 'bg-rose-200 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{node.name}</h4>
                    <div className="flex items-center space-x-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        isCrashed
                          ? 'bg-rose-500 animate-ping'
                          : 'bg-emerald-500 pulse-glow'
                      }`}></span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {isCrashed ? 'Caído / Desconectado' : `Heartbeat: hace ${timeSinceHeartbeat}s`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botón Acción (Matar / Revivir) */}
                {isCrashed ? (
                  <button
                    onClick={() => onReviveNode(node.id)}
                    className="p-1.5 text-xs rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 flex items-center space-x-1 cursor-pointer transition-colors"
                    title="Revivir nodo"
                  >
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-[10px] font-semibold">Revivir</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onKillNode(node.id)}
                    className="p-1.5 text-xs rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center space-x-1 cursor-pointer transition-colors"
                    title="Simular colapso de este nodo"
                  >
                    <Skull className="h-3.5 w-3.5" />
                    <span className="text-[10px]">Crash</span>
                  </button>
                )}
              </div>

              {/* Barra de Carga de Slots */}
              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px] flex items-center">
                    <Cpu className="h-3 w-3 mr-1 text-slate-400" />
                    Ocupación de Hilos:
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {node.bufferedCount > 0 && (
                      <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded font-semibold border border-teal-200">
                        +{node.bufferedCount} buffer
                      </span>
                    )}
                    <span className="font-mono font-semibold text-slate-700 text-xs">
                      {node.activeThreads} / {node.maxThreads} ({loadPercent}%)
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCrashed
                        ? 'bg-rose-400'
                        : loadPercent >= 100
                        ? 'bg-amber-500'
                        : loadPercent > 0
                        ? 'bg-emerald-500'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: `${isCrashed ? 0 : loadPercent}%` }}
                  />
                </div>

                {/* Detalle de Hilos y Tareas en Vuelo */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Slots de Hilos Concurrentes
                  </span>
                  
                  <div className="space-y-1">
                    {node.slots.map((slot) => {
                      const task = slot.currentTask;
                      const hasTask = slot.isBusy && task;

                      return (
                        <div
                          key={slot.slotId}
                          className={`p-1.5 rounded-lg border text-[11px] transition-all ${
                            isCrashed
                              ? 'bg-rose-50/50 border-rose-200/50 text-rose-400'
                              : hasTask
                              ? 'bg-emerald-50/60 border-emerald-200 text-slate-700'
                              : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-semibold text-slate-500">
                              Hilo #{slot.slotId + 1}
                            </span>
                            {hasTask ? (
                              <div className="flex items-center space-x-1">
                                {getChannelIcon(task.channel)}
                                <span className="font-mono text-[10px] font-medium text-emerald-800">
                                  {task.id.slice(-6)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Libre</span>
                            )}
                          </div>

                          {hasTask && (
                            <div className="mt-1">
                              <div className="flex justify-between items-center text-[10px] text-slate-600 truncate">
                                <span className="font-medium truncate">{task.patientName}</span>
                                <span className="text-slate-400 ml-1 shrink-0">{task.specialty.split(' ')[0]}</span>
                              </div>
                              <div className="mt-1 w-full bg-emerald-200/50 rounded-full h-1 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                                  style={{ width: `${slot.progressPercent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Estadísticas de este Nodo */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Completadas: <strong className="text-emerald-600">{node.completedCount}</strong></span>
                  <span>Fallos: <strong className={node.failedCount > 0 ? 'text-rose-500' : 'text-slate-400'}>{node.failedCount}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

