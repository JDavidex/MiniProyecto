/**
 * ============================================================================
 * PATRÓN DE DISEÑO: OBSERVER (PUBLICADOR / SUSCRIPTOR)
 * ============================================================================
 * Propósito:
 * Desacopla la lógica del sistema distribuido (Proxy, Coordinador, Nodos de
 * trabajo) de la interfaz de usuario y los monitores en tiempo real.
 * 
 * Justificación según rúbrica:
 * En un sistema distribuido de mensajería/recordatorios, los eventos de ciclo
 * de vida (asignación de tareas, finalización, caídas de nodos y heartbeats)
 * deben ser transmitidos a múltiples observadores (panel React, métricas, logs)
 * sin que los componentes productores conozcan la existencia ni la tecnología
 * de los consumidores.
 */

import { SystemEvent, EventType, EventSeverity } from '../types';

type EventCallback = (event: SystemEvent) => void;

export class EventBus {
  private static instance: EventBus;
  private subscribers: Map<EventType | '*', Set<EventCallback>> = new Map();
  private eventHistory: SystemEvent[] = [];
  private readonly maxHistoryLength = 200;

  private constructor() {}

  /**
   * Obtiene la instancia única del EventBus (Singleton complementario al Observer)
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Registra un observador interesado en un tipo de evento o en todos ('*')
   * @param eventType Tipo de evento a escuchar o '*' para todos
   * @param callback Función que se ejecutará al publicarse el evento
   * @returns Función de desuscripción limpia
   */
  public subscribe(eventType: EventType | '*', callback: EventCallback): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(callback);

    // Retorna función para desuscribirse fácilmente (cleanup en React useEffect)
    return () => {
      const set = this.subscribers.get(eventType);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  /**
   * Publica un evento a todos los observadores registrados
   */
  public publish(
    type: EventType,
    message: string,
    severity: EventSeverity = 'info',
    extras?: { nodeId?: string; taskId?: string; details?: Record<string, unknown> }
  ): SystemEvent {
    const event: SystemEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type,
      message,
      severity,
      nodeId: extras?.nodeId,
      taskId: extras?.taskId,
      details: extras?.details,
    };

    // Almacenar en buffer histórico con límite
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.shift();
    }

    // Notificar observadores específicos del tipo de evento
    const specificSubscribers = this.subscribers.get(type);
    if (specificSubscribers) {
      specificSubscribers.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`Error en observador de evento [${type}]:`, err);
        }
      });
    }

    // Notificar observadores globales ('*')
    const wildcardSubscribers = this.subscribers.get('*');
    if (wildcardSubscribers) {
      wildcardSubscribers.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`Error en observador global de evento:`, err);
        }
      });
    }

    return event;
  }

  /**
   * Obtiene copia del historial de eventos
   */
  public getHistory(): SystemEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Limpia el historial de eventos
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }
}

export const eventBus = EventBus.getInstance();
