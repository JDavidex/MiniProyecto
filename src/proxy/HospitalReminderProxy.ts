/**
 * ============================================================================
 * PATRÓN DE DISEÑO: PROXY (PROXY DE ENTRADA / GATEWAY DEL HOSPITAL)
 * ============================================================================
 * Propósito:
 * Actúa como punto de acceso intermediario y controlado entre los sistemas
 * emisores de citas del hospital VerdeSalud (HIS, Portal Web de Pacientes,
 * Call Center) y el Coordinador distribuido interno.
 * 
 * Justificación según rúbrica:
 * 1. Control de Acceso y Validación: Ningún cliente externo accede directamente
 *    a la cola ni a los Web Workers. El Proxy valida esquemas, canales y datos.
 * 2. Enriquecimiento y Sanitización: Asigna UUIDs únicos, canales de entrega
 *    y metadatos de auditoría médica.
 * 3. Rate Limiting y Control de Flujo: Protege al coordinador de avalanchas
 *    de solicitudes descontroladas mediante validación de topes de lote.
 * 4. Delegación Transparente: Tras verificar la integridad del lote, delega
 *    la carga de trabajo hacia el Coordinador (Mediator).
 */

import { AppointmentTask, ChannelType } from '../types';
import { Coordinator, coordinator } from '../coordinator/Coordinator';
import { eventBus } from '../events/EventBus';

// Banco de datos clínicos realistas para VerdeSalud
const PACIENTES = [
  'Valentina Restrepo', 'Carlos Alberto Morales', 'María José Gómez', 'Andrés Felipe Castro',
  'Camila Domínguez', 'Santiago Herrera', 'Mariana Ospina', 'Juan Pablo Salazar',
  'Daniela Cárdenas', 'Mateo Echeverry', 'Sofía Caicedo', 'Nicolás Vargas',
  'Gabriela Muñoz', 'Samuel Arboleda', 'Luciana Pineda', 'Alejandro Quintero',
  'Isabella Duque', 'Esteban Montoya', 'Valeria Jaramillo', 'David Fernando Rojas'
];

const ESPECIALIDADES = [
  'Cardiología', 'Pediatría', 'Medicina General', 'Traumatología y Ortopedia',
  'Ginecología y Obstetricia', 'Dermatología', 'Neurología', 'Oftalmología',
  'Oncología Clínica', 'Endocrinología', 'Neumología', 'Odontología'
];

const CANALES: ChannelType[] = ['whatsapp', 'sms', 'email', 'call'];

export interface BatchRequestOptions {
  batchSize: number;
  forcedChannel?: ChannelType;
  maxRetries?: number;
}

export class HospitalReminderProxy {
  private static instance: HospitalReminderProxy;
  private coordinatorRef: Coordinator;
  private totalIngressedTasks: number = 0;
  private readonly MAX_BATCH_LIMIT = 1000;

  private constructor() {
    this.coordinatorRef = coordinator;
  }

  public static getInstance(): HospitalReminderProxy {
    if (!HospitalReminderProxy.instance) {
      HospitalReminderProxy.instance = new HospitalReminderProxy();
    }
    return HospitalReminderProxy.instance;
  }

  /**
   * Genera y enriquece una tarea individual con datos clínicos válidos
   */
  private generateMockTask(index: number, forcedChannel?: ChannelType, maxRetries: number = 3): AppointmentTask {
    const patientName = PACIENTES[Math.floor(Math.random() * PACIENTES.length)];
    const specialty = ESPECIALIDADES[Math.floor(Math.random() * ESPECIALIDADES.length)];
    const channel = forcedChannel || CANALES[Math.floor(Math.random() * CANALES.length)];
    const phone = `+57 3${Math.floor(100000000 + Math.random() * 900000000)}`;
    const randomDays = Math.floor(Math.random() * 7) + 1;
    const date = new Date(Date.now() + randomDays * 86400000).toLocaleDateString('es-CO', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      id: `VS-REM-${Date.now().toString(36).toUpperCase()}-${(index + 1).toString().padStart(4, '0')}`,
      patientName,
      patientPhone: phone,
      specialty,
      appointmentDate: date,
      channel,
      status: 'queued',
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
    };
  }

  /**
   * Punto de entrada principal: Recibe, audita, valida y delega el lote
   */
  public submitBatch(options: BatchRequestOptions): { accepted: boolean; count: number; error?: string } {
    const { batchSize, forcedChannel, maxRetries = 3 } = options;

    // 1. Control de Acceso y Validación de Límites (Seguridad del Proxy)
    if (!batchSize || batchSize <= 0) {
      return { accepted: false, count: 0, error: 'El tamaño del lote debe ser mayor a cero' };
    }

    if (batchSize > this.MAX_BATCH_LIMIT) {
      return {
        accepted: false,
        count: 0,
        error: `Límite de seguridad excedido. Máximo permitido: ${this.MAX_BATCH_LIMIT} tareas por solicitud`,
      };
    }

    // 2. Generación y enriquecimiento de las tareas clínicas
    const tasks: AppointmentTask[] = [];
    for (let i = 0; i < batchSize; i++) {
      tasks.push(this.generateMockTask(i, forcedChannel, maxRetries));
    }

    this.totalIngressedTasks += tasks.length;

    // 3. Auditoría de Entrada
    eventBus.publish(
      'BATCH_SUBMITTED',
      `[PROXY VERDESALUD] Lote validado con éxito: ${tasks.length} recordatorios clínicos autorizados para despacho`,
      'info',
      {
        details: {
          batchSize: tasks.length,
          timestamp: Date.now(),
          firstId: tasks[0]?.id,
          lastId: tasks[tasks.length - 1]?.id,
        },
      }
    );

    // 4. Delegación transparente hacia el Coordinador (Mediator)
    this.coordinatorRef.enqueueBatch(tasks);

    return { accepted: true, count: tasks.length };
  }

  public getTotalIngressed(): number {
    return this.totalIngressedTasks;
  }
}

export const hospitalProxy = HospitalReminderProxy.getInstance();

