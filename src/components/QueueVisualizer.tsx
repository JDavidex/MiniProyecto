import React from 'react';
import { Layers, MessageCircle, Phone, Mail, PhoneCall, RotateCcw } from 'lucide-react';
import { AppointmentTask, ChannelType } from '../types';

interface QueueVisualizerProps {
  queue: AppointmentTask[];
  totalInQueue: number;
}

const getChannelBadge = (channel: ChannelType) => {
  switch (channel) {
    case 'whatsapp':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
          <MessageCircle className="h-2.5 w-2.5 mr-1" /> WhatsApp
        </span>
      );
    case 'sms':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-800">
          <Phone className="h-2.5 w-2.5 mr-1" /> SMS
        </span>
      );
    case 'email':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800">
          <Mail className="h-2.5 w-2.5 mr-1" /> Correo
        </span>
      );
    case 'call':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
          <PhoneCall className="h-2.5 w-2.5 mr-1" /> IVR
        </span>
      );
  }
};

export const QueueVisualizer: React.FC<QueueVisualizerProps> = ({ queue, totalInQueue }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Layers className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-800">Cola Centralizada de Recordatorios</h3>
          <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-full">
            {totalInQueue} pendientes
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Patrón Mediator (FIFO / Least Loaded)</span>
      </div>

      {queue.length === 0 ? (
        <div className="py-6 text-center text-slate-400">
          <Layers className="h-8 w-8 mx-auto text-slate-300 mb-1" />
          <p className="text-xs font-medium">La cola de recordatorios está despejada</p>
          <p className="text-[11px]">Envía un nuevo lote desde el panel superior para despachar citas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {queue.map((task, idx) => (
            <div
              key={task.id}
              className={`p-2.5 rounded-xl border text-xs transition-all ${
                task.retries > 0
                  ? 'bg-purple-50/80 border-purple-200 ring-1 ring-purple-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] text-slate-500 font-medium">
                  #{idx + 1} {task.id.slice(-6)}
                </span>
                {getChannelBadge(task.channel)}
              </div>
              <div className="font-semibold text-slate-800 truncate text-[11px]">
                {task.patientName}
              </div>
              <div className="text-[10px] text-slate-500 truncate flex items-center justify-between mt-1">
                <span>{task.specialty}</span>
                {task.retries > 0 && (
                  <span className="inline-flex items-center text-purple-700 font-bold bg-purple-100 px-1 rounded text-[9px]">
                    <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> R{task.retries}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalInQueue > queue.length && (
        <div className="mt-2.5 text-center text-[11px] text-slate-400 font-mono">
          ... y {totalInQueue - queue.length} tareas más esperando balanceo en el Coordinador
        </div>
      )}
    </div>
  );
};

