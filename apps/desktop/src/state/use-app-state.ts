import { useSyncExternalStore } from "react";
import { getController } from "./access";
import type { AppState } from "./app-state";

export function useAppState(): AppState {
  const controller = getController();
  return useSyncExternalStore(
    (cb) => controller.store.subscribe(() => cb()),
    () => controller.store.getState(),
  );
}
