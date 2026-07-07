/**
 * NotificationService — the single place that raises user-facing alerts.
 *
 * Everything routes through the bus as a `toast`, which the in-game overlay
 * renders as an unobtrusive card. If a native Overwolf notifications API is
 * present at runtime it is used as well (guarded, since it isn't in every
 * client build), but the overlay toast is always the source of truth so the
 * experience is identical in the dev harness.
 */
import { createLogger } from "@/core/log";
import { getBus, type AppBus, type Toast, type ToastKind } from "@/core/bus";

const log = createLogger("notify");

let counter = 0;
const id = () => `toast-${Date.now()}-${counter++}`;

export class NotificationService {
  constructor(private readonly bus: AppBus = getBus()) {}

  notify(input: { title: string; body?: string; kind?: ToastKind; ttl?: number }): void {
    const toast: Toast = {
      id: id(),
      title: input.title,
      body: input.body,
      kind: input.kind ?? "info",
      ttl: input.ttl ?? 6000,
    };
    this.bus.emit("toast", toast);
    this.tryNative(toast);
  }

  /** A coaching tip — styled distinctly and slightly stickier. */
  coach(title: string, body?: string): void {
    this.notify({ title, body, kind: "coach", ttl: 9000 });
  }

  private tryNative(toast: Toast): void {
    // overwolf.notifications isn't typed in every SDK build; probe defensively.
    const ow = (globalThis as { overwolf?: Record<string, unknown> }).overwolf;
    const native = ow?.["notifications"] as
      | { showToastNotification?: (o: unknown, cb?: (r: unknown) => void) => void }
      | undefined;
    if (!native?.showToastNotification) return;
    try {
      native.showToastNotification({ header: toast.title, text: [toast.body ?? ""] });
    } catch (err) {
      log.debug("native notification failed", err);
    }
  }
}
