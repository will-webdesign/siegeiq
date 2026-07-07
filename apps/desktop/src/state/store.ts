/** Minimal typed store — no external state library, no re-render storms. */
export interface Store<T> {
  getState(): T;
  setState(patch: Partial<T> | ((prev: T) => Partial<T>)): void;
  subscribe(listener: (state: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(s: T) => void>();
  return {
    getState: () => state,
    setState(patch) {
      const p = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...p };
      for (const l of listeners) l(state);
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
