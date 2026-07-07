/**
 * useToasts — subscribes the current window to `toast` events on the app bus
 * and manages their lifetime (auto-dismiss after ttl, newest first, bounded).
 * Any window can render notifications by calling this; the overlay does.
 */
import { useEffect, useState } from "react";
import { getBus, type Toast } from "@/core/bus";

const MAX_VISIBLE = 4;

export function useToasts(): { toasts: Toast[]; dismiss: (id: string) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

    const off = getBus().on("toast", (toast) => {
      setToasts((prev) => [toast, ...prev].slice(0, MAX_VISIBLE));
      if (toast.ttl > 0) timers.set(toast.id, setTimeout(() => dismiss(toast.id), toast.ttl));
    });

    return () => {
      off();
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  return { toasts, dismiss: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)) };
}
