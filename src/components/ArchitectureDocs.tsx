import React, { useState } from 'react';
import { Layers, GitCommit, Network, ShieldCheck, Box, Workflow, ArrowRight, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

export const ArchitectureDocs: React.FC = () => {
  const [selectedDiagram, setSelectedDiagram] = useState<'components' | 'sequence' | 'deployment'>('components');

  return (
    <div className="space-y-6">
      {/* Banner Superior de Arquitectura */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-emerald-800/80">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Documento de Especificación Arquitectónica - Rúbrica Unidad 2</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Arquitectura de Software Distribuida entre Hilos y Nodos
          </h2>
          <p className="text-emerald-200/90 text-sm mt-2 leading-relaxed">
            Diseño e implementación de un sistema distribuido de alta concurrencia para el despacho
            paralelo de recordatorios de citas médicas de VerdeSalud, fundamentado en patrones de diseño
            GoF y principios de robustez, tolerancia a fallos y escalabilidad horizontal.
          </p>
        </div>

        {/* Botones de Selección de Diagrama */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-emerald-800/60">
          <button
            onClick={() => setSelectedDiagram('components')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              selectedDiagram === 'components'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-emerald-950/60 text-emerald-200 hover:bg-emerald-800/60'
            }`}
          >
            <Box className="h-4 w-4" />
            <span>1. Diagrama de Componentes UML</span>
          </button>

          <button
            onClick={() => setSelectedDiagram('sequence')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              selectedDiagram === 'sequence'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-emerald-950/60 text-emerald-200 hover:bg-emerald-800/60'
            }`}
          >
            <Workflow className="h-4 w-4" />
            <span>2. Diagrama de Secuencia & Retry UML</span>
          </button>

          <button
            onClick={() => setSelectedDiagram('deployment')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              selectedDiagram === 'deployment'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-emerald-950/60 text-emerald-200 hover:bg-emerald-800/60'
            }`}
          >
            <Network className="h-4 w-4" />
            <span>3. Diagrama de Despliegue UML</span>
          </button>
        </div>
      </div>

      {/* Contenedor del Diagrama Seleccionado */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
        {selectedDiagram === 'components' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Box className="h-5 w-5 text-emerald-600" />
                <span>Diagrama de Componentes y Relaciones de Arquitectura</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Estructura modular del sistema evidenciando el rol de cada módulo y los patrones de diseño aplicados.
              </p>
            </div>

            {/* Visualización Visual de Componentes */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                
                {/* 1. Cliente / Emisor */}
                <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Capa Externa</span>
                  <div className="font-bold text-slate-800 text-sm">Sistema Hospitalario (HIS)</div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Emite lotes de recordatorios de citas médicas.
                  </p>
                </div>

                {/* 2. Proxy */}
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 shadow-xs">
                  <span className="text-[10px] text-emerald-700 font-bold block uppercase mb-1">
                    «Patrón Proxy»
                  </span>
                  <div className="font-bold text-emerald-900 text-sm">HospitalReminderProxy</div>
                  <ul className="text-[11px] text-emerald-800 mt-2 text-left space-y-1">
                    <li>• Validación de esquemas</li>
                    <li>• Rate Limiting & Cuotas</li>
                    <li>• Enriquecimiento clínico</li>
                    <li>• Auditoría de entrada</li>
                  </ul>
                </div>

                {/* 3. Coordinador */}
                <div className="bg-teal-50 border-2 border-teal-500 rounded-xl p-4 shadow-xs">
                  <span className="text-[10px] text-teal-700 font-bold block uppercase mb-1">
                    «Patrón Mediator & Retry»
                  </span>
                  <div className="font-bold text-teal-900 text-sm">ClusterCoordinator</div>
                  <ul className="text-[11px] text-teal-800 mt-2 text-left space-y-1">
                    <li>• Cola central de tareas</li>
                    <li>• Algoritmo Least Loaded</li>
                    <li>• Monitor Heartbeats (2.5s)</li>
                    <li>• Reencolamiento (Retry)</li>
                  </ul>
                </div>

                {/* 4. Pool de Nodos */}
                <div className="bg-cyan-50 border-2 border-cyan-500 rounded-xl p-4 shadow-xs">
                  <span className="text-[10px] text-cyan-700 font-bold block uppercase mb-1">
                    «Worker Pool Multi-hilo»
                  </span>
                  <div className="font-bold text-cyan-900 text-sm">Nodos Web Workers (1-8)</div>
                  <ul className="text-[11px] text-cyan-800 mt-2 text-left space-y-1">
                    <li>• Hilos del SO (HTML5)</li>
                    <li>• 1-8 hilos concurrentes</li>
                    <li>• Simulación de latencia</li>
                    <li>• Heartbeats periódicos</li>
                  </ul>
                </div>

              </div>

              {/* Barra transversal de EventBus (Observer) */}
              <div className="mt-6 bg-slate-900 text-slate-200 rounded-xl p-4 border border-slate-700 shadow-md text-center">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                  «Patrón Observer / EventBus» - Bus Central de Eventos Desacoplado
                </span>
                <p className="text-xs text-slate-300">
                  Transmite eventos en tiempo real (<code>TASK_QUEUED</code>, <code>TASK_ASSIGNED</code>, <code>NODE_HEARTBEAT</code>, <code>NODE_CRASHED</code>, <code>TASK_RETRIED</code>) hacia la Interfaz React, Métricas y Registro Auditor.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedDiagram === 'sequence' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Workflow className="h-5 w-5 text-teal-600" />
                <span>Diagrama de Secuencia: Despacho Concurrente y Tolerancia a Fallos (Patrón Retry)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Representa el ciclo de vida de un recordatorio médico y cómo el sistema se recupera de manera autónoma ante la caída de un nodo.
              </p>
            </div>

            <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 font-mono text-xs overflow-x-auto space-y-4">
              <div className="text-emerald-400 font-bold">
                === FLUJO 1: DESPACHO NORMAL Y BALANCEO "LEAST LOADED" ===
              </div>
              <div className="space-y-1.5 text-slate-300">
                <p>1. [HIS Client] &rarr; (submitBatch 50 recordatorios) &rarr; [HospitalReminderProxy]</p>
                <p>2. [HospitalReminderProxy] &rarr; (valida cuota y genera citas clínicas) &rarr; [HospitalReminderProxy]</p>
                <p>3. [HospitalReminderProxy] &rarr; (enqueueBatch) &rarr; [ClusterCoordinator (Mediator)]</p>
                <p>4. [ClusterCoordinator] &rarr; (notifica TASK_QUEUED) &rarr; [EventBus (Observer)]</p>
                <p>5. [ClusterCoordinator] &rarr; (evalúa loadRatio: activeThreads/maxThreads) &rarr; [ClusterCoordinator]</p>
                <p>6. [ClusterCoordinator] &rarr; (ASSIGN_TASK al nodo menos cargado) &rarr; [WorkerNode #2]</p>
                <p>7. [WorkerNode #2] &rarr; (ejecuta en hilo OS con latencia simulada) &rarr; [taskWorker.ts]</p>
                <p>8. [taskWorker.ts] &rarr; (TASK_COMPLETED 650ms) &rarr; [ClusterCoordinator]</p>
                <p>9. [ClusterCoordinator] &rarr; (publica TASK_COMPLETED) &rarr; [EventBus] &rarr; [UI Dashboard]</p>
              </div>

              <div className="pt-4 border-t border-slate-800 text-amber-400 font-bold">
                === FLUJO 2: DETECCIÓN DE NODO CAÍDO Y APLICACIÓN DEL PATRÓN RETRY ===
              </div>
              <div className="space-y-1.5 text-slate-300">
                <p className="text-rose-400">1. [WorkerNode #1] sufre colapso físico (CRASH) o desconexión de red</p>
                <p>2. [WorkerNode #1] deja de emitir pulsos periódicos de Heartbeat</p>
                <p>3. [ClusterCoordinator (HealthChecker)] detecta: <code>Date.now() - lastHeartbeat &gt; 2500ms</code></p>
                <p className="text-rose-400">4. [ClusterCoordinator] marca al Nodo #1 como CRASHED y extrae sus tareas en vuelo</p>
                <p className="text-purple-300">5. [PATRÓN RETRY] Para cada tarea recuperada: <code>task.retries++</code> (ej. Retry #1)</p>
                <p className="text-purple-300">6. [ClusterCoordinator] reinserta la tarea al frente de la cola de despacho prioritario</p>
                <p>7. [ClusterCoordinator] balancea inmediatamente la tarea hacia el nodo sano disponible [WorkerNode #3]</p>
                <p className="text-emerald-400">8. [WorkerNode #3] procesa con éxito la cita recuperada. Cero pérdida de datos.</p>
              </div>
            </div>
          </div>
        )}

        {selectedDiagram === 'deployment' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Network className="h-5 w-5 text-cyan-600" />
                <span>Diagrama de Despliegue Físico y Lógico del Prototipo Distribuido</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Mapeo de la arquitectura en la infraestructura de computación (Navegador & Vercel Edge).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Infraestructura Cloud (Vercel CDN)
                </h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <strong className="text-slate-800">Edge Global Network:</strong>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Despliegue serverless de artefactos estáticos (HTML5, JS Chunks, Vite Bundle optimizado con Gzip/Brotli).
                    </p>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <strong className="text-slate-800">Cero Dependencias de Servidor:</strong>
                    <p className="text-[11px] text-slate-500 mt-1">
                      El sistema distribuido es 100% autónomo y ejecuta la orquestación cliente-side sin cuellos de botella de backend.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Arquitectura Multi-Core (Cliente)
                </h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <strong className="text-emerald-900">Main Thread (Hilo UI / React 19):</strong>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Aloja el Proxy de Entrada, el Coordinador (Mediator) y el EventBus (Observer).
                    </p>
                  </div>
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                    <strong className="text-teal-900">Worker Threads (Pool de Web Workers HTML5):</strong>
                    <p className="text-[11px] text-teal-800 mt-1">
                      Cada nodo físico corre en un hilo de hardware separado, gestionando sus propios slots concurrentes con comunicación mediante <code>postMessage</code> y serialización structuredClone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Justificación de Patrones de Diseño (Para la Rúbrica) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span>Matriz de Justificación de Patrones de Diseño (Criterio Rúbrica)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Sustentación teórica y práctica de cada patrón seleccionado frente a los desafíos de la arquitectura distribuida.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Patrón de Diseño</th>
                <th className="py-2.5 px-3">Ubicación en el Código</th>
                <th className="py-2.5 px-3">Problema que Resuelve</th>
                <th className="py-2.5 px-3">Impacto en Robustez y Mantenibilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3 px-3 font-bold text-emerald-800">
                  1. Proxy (Proxy de Entrada)
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                  <code>src/proxy/HospitalReminderProxy.ts</code>
                </td>
                <td className="py-3 px-3">
                  Evita que clientes externos saturen o conozcan la topología interna del cluster. Valida y enriquece las citas clínicas.
                </td>
                <td className="py-3 px-3 text-emerald-700 font-medium">
                  Seguridad perimetral, rate limiting y control de acceso unificado.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-teal-800">
                  2. Mediator (Coordinador)
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                  <code>src/coordinator/Coordinator.ts</code>
                </td>
                <td className="py-3 px-3">
                  Elimina el acoplamiento directo punto-a-punto entre cola, nodos y clientes. Aplica balanceo <em>Least Loaded</em>.
                </td>
                <td className="py-3 px-3 text-teal-700 font-medium">
                  Facilita agregar o remover nodos en caliente sin alterar la lógica de negocio.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-indigo-800">
                  3. Observer (EventBus)
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                  <code>src/events/EventBus.ts</code>
                </td>
                <td className="py-3 px-3">
                  Permite que la UI, métricas y consolas de auditoría reciban eventos de ciclo de vida sin bloquear el procesamiento.
                </td>
                <td className="py-3 px-3 text-indigo-700 font-medium">
                  Desacoplamiento total entre la capa de presentación y el motor de procesamiento paralelo.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-purple-800">
                  4. Retry Pattern (Resiliencia)
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                  <code>src/coordinator/Coordinator.ts</code> (handleNodeCrashed)
                </td>
                <td className="py-3 px-3">
                  Recupera citas médicas que quedaron a medio procesar tras el colapso abrupto o timeout de un Web Worker.
                </td>
                <td className="py-3 px-3 text-purple-700 font-medium">
                  Cero pérdida de citas médicas (alta disponibilidad y tolerancia a fallos).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
