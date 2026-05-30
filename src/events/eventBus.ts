/**
 * Minimal typed event bus. Synchronous fan-out, per-listener error isolation
 * (one throwing listener never blocks siblings). Zero dependencies.
 */

export type Listener<T> = (payload: T) => void;

/** Map of event name -> payload type. */
export type EventMap = Record<string, unknown>;

export class EventBus<E extends EventMap> {
  private listeners = new Map<keyof E, Set<Listener<unknown>>>();

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<unknown>);
    return () => {
      set!.delete(fn as Listener<unknown>);
    };
  }

  /** Subscribe for a single emission. */
  once<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  /** Emit synchronously to all current listeners. */
  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch {
        /* listener errors are isolated */
      }
    }
  }

  /** Remove all listeners for an event, or all events when omitted. */
  clear(event?: keyof E): void {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
  }
}
