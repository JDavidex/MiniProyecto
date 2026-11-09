import React, { useState } from 'react';
import { Send, Skull, RefreshCw, Trash2, Sliders, Flame, Zap, Sparkles } from 'lucide-react';
import { ChannelType, DispatchMode } from '../types';

interface ControlPanelProps {
  nodesCount: number;
  threadsPerNode: number;
  dispatchMode: DispatchMode;
  batchChunkSize: number;
  onTopologyChange: (nodes: number, threads: number) => void;
  onDispatchModeChange: (mode: DispatchMode, chunkSize: number) => void;
  onSubmitBatch: (batchSize: number, channel?: ChannelType) => void;
  onSimulateFailure: () => void;
  onReviveAll: () => void;
  onReset: () => void;
  onOpenBenchmark: () => void;
  onLatencyChange: (minMs: number, maxMs: number) => void;
  isProcessing: boolean;
  hasCrashedNodes: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  nodesCount,
  threadsPerNode,
  dispatchMode,
  batchChunkSize,
  onTopologyChange,
  onDispatchModeChange,
  onSubmitBatch,
  onSimulateFailure,
  onReviveAll,
  onReset,
  onOpenBenchmark,
  onLatencyChange,
  isProcessing: _isProcessing,
  hasCrashedNodes,
}) => {
  const [batchSize, setBatchSize] = useState<number>(50);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | 'all'>('all');
  const [latencyProfile, setLatencyProfile] = useState<'fast' | 'normal' | 'slow'>('normal');

  const handleLatencyProfileChange = (profile: 'fast' | 'normal' | 'slow') => {
    setLatencyProfile(profile);
    if (profile === 'fast') {
      onLatencyChange(150, 350);
    } else if (profile === 'normal') {
      onLatencyChange(400, 900);
    } else {
      onLatencyChange(1000, 2200);
    }
  };

  const handleBatchSend = () => {
    onSubmitBatch(batchSize, selectedChannel === 'all' ? undefined : selectedChannel);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
        <div className="flex items-center space-x-2">
          <Sliders className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-800">Panel de Control de Despacho</h2>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium border border-emerald-200">
            Proxy & Mediador
          </span>
        </div>

        {/* Selector Rápido de Modo de Despacho */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
            <span className="text-slate-500 font-semibold px-2 text-[11px] flex items-center">
              <Zap className="h-3 w-3 mr-1 text-amber-500" /> IPC:
            </span>
            <button
              onClick={() => onDispatchModeChange('individual', batchChunkSize)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                dispatchMode === 'individual'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Individual (1/msg)
            </button>
            <button
              onClick={() => onDispatchModeChange('batch', batchChunkSize)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center space-x-1 cursor-pointer ${
                dispatchMode === 'batch'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Por Lotes ({batchChunkSize}/msg)</span>
            </button>
          </div>

          <button
            onClick={onOpenBenchmark}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Flame className="h-3.5 w-3.5 text-amber-300" />
            <span>Benchmark (1,2,4,8 Nodos)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Lote de Citas */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            Cantidad de Tareas por Lote
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="1"
              max="1000"
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            <div className="flex space-x-1">
              {[20, 50, 100, 250].map((size) => (
                <button
                  key={size}
                  onClick={() => setBatchSize(size)}
                  className={`px-2 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    batchSize === size
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Genera citas médicas simuladas con pacientes, fechas y especialidades.
          </p>
        </div>

        {/* 2. Topología: Nodos Trabajadores (1 - 8) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-medium text-slate-700">
            <span>Nodos Trabajadores (Web Workers):</span>
            <span className="font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {nodesCount} Nodos
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            value={nodesCount}
            onChange={(e) => onTopologyChange(parseInt(e.target.value), threadsPerNode)}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>1 Nodo</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>8 Nodos</span>
          </div>
        </div>

        {/* 3. Topología: Hilos por Nodo (1 - 8) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-medium text-slate-700">
            <span>Hilos / Concurrencia por Nodo:</span>
            <span className="font-bold text-teal-700 font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {threadsPerNode} Hilos ({nodesCount * threadsPerNode} total)
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            value={threadsPerNode}
            onChange={(e) => onTopologyChange(nodesCount, parseInt(e.target.value))}
            className="w-full accent-teal-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>1 Hilo</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>8 Hilos</span>
          </div>
        </div>

        {/* 4. Canal y Latencia */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-medium text-slate-700">
            <span>Canal y Perfil de Latencia</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value as any)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
            >
              <option value="all">Canal: Mixto / Todos</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS Celular</option>
              <option value="email">Correo Electrónico</option>
              <option value="call">Llamada IVR</option>
            </select>

            <select
              value={latencyProfile}
              onChange={(e) => handleLatencyProfileChange(e.target.value as any)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
            >
              <option value="fast">Rápida (150-350ms)</option>
              <option value="normal">Normal (400-900ms)</option>
              <option value="slow">Lenta (1-2.2s)</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-400">
            Simula retardo de pasarelas externas de telecomunicaciones.
          </p>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Enviar Lote */}
          <button
            onClick={handleBatchSend}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span>Enviar Lote ({batchSize} Recordatorios)</span>
          </button>

          {/* Botón Simular Falla de Nodo */}
          <button
            onClick={onSimulateFailure}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-medium rounded-xl transition-all cursor-pointer"
            title="Detiene un nodo para probar la detección de heartbeat y el patrón Retry"
          >
            <Skull className="h-4 w-4 text-rose-600" />
            <span>Simular Falla de un Nodo</span>
          </button>

          {/* Botón Revivir Nodos */}
          {hasCrashedNodes && (
            <button
              onClick={onReviveAll}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-sm font-medium rounded-xl transition-all animate-bounce cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <span>Revivir Nodos Caídos</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Botón Reset */}
          <button
            onClick={onReset}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Limpiar / Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
