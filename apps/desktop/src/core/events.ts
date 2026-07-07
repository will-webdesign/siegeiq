/**
 * Tiny typed event emitter — the primitive every service is built on.
 *
 * Generic over an event map so listeners are fully type-checked:
 *   const e = new Emitter<{ tick: number; done: void }>();
 *   e.on("tick", (n) => n.toFixed());   // n: number
 *   e.emit("done");                      // no payload required
 */
export type Listener<T> = (payload: T) => void;

// Events whose payload is `void` may be emitted with no argument.
type EmitArgs<T> = [T] extends [void] ? [] : [payload: T];

export class Emitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as Listener<unknown>);
    return () => this.off(type, listener);
  }

  once<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.listeners.get(type)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof Events>(type: K, ...args: EmitArgs<Events[K]>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    const payload = (args.length ? args[0] : undefined) as Events[K];
    // Copy so a listener that unsubscribes mid-dispatch doesn't disturb iteration.
    for (const l of [...set]) l(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
