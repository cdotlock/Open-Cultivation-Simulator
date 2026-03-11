import { StatusDelta, EventMap } from "@/interfaces/dto";
import { GamePush } from "@/app/actions/generated/prisma";

// Event types
type EventKey<T extends EventMap> = keyof T & string;
type EventCallback<T extends EventMap, K extends EventKey<T>> = (payload: T[K]) => void;

class EventBus<T extends EventMap> {
  private events: Map<EventKey<T>, Set<EventCallback<T, EventKey<T>>>>;

  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to an event
   * @param eventName Event name to subscribe to
   * @param callback Callback function to be called when event is emitted
   * @returns Unsubscribe function
   */
  on<K extends EventKey<T>>(eventName: K, callback: EventCallback<T, K>): () => void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }

    const callbacks = this.events.get(eventName)!;
    callbacks.add(callback as EventCallback<T, EventKey<T>>);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback as EventCallback<T, EventKey<T>>);
      if (callbacks.size === 0) {
        this.events.delete(eventName);
      }
    };
  }

  /**
   * Subscribe to an event and unsubscribe after first trigger
   * @param eventName Event name to subscribe to
   * @param callback Callback function to be called when event is emitted
   * @returns Unsubscribe function
   */
  once<K extends EventKey<T>>(eventName: K, callback: EventCallback<T, K>): () => void {
    const unsubscribe = this.on(eventName, ((payload: T[K]) => {
      unsubscribe();
      callback(payload);
    }) as EventCallback<T, K>);
    return unsubscribe;
  }

  /**
   * Emit an event with payload
   * @param eventName Event name to emit
   * @param payload Payload to pass to callback functions
   */
  emit<K extends EventKey<T>>(eventName: K, payload: T[K]): void {
    const callbacks = this.events.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in event ${eventName} callback:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event
   * @param eventName Event name to clear listeners for
   */
  off<K extends EventKey<T>>(eventName: K): void {
    this.events.delete(eventName);
  }

  /**
   * Remove all event listeners
   */
  clear(): void {
    this.events.clear();
  }
}

// Define your event types
interface AppEventMap extends EventMap {
  'game:push': { 
    id: number;
    push: GamePush;
    delta: StatusDelta;
   };
}

// Create a singleton instance with typed events
const eventBus = new EventBus<AppEventMap>();

export default eventBus;
