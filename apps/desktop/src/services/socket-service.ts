/**
 * SocketService — reconnecting WebSocket to the SiegeIQ backend.
 *
 * This is the live channel the app will use for server-driven features: real
 * time AI coaching, cross-device session sync, and push content updates. It is
 * intentionally lazy — nothing connects unless a URL is configured
 * (VITE_WS_URL) — and fully dev-safe: a missing URL or a closed server just
 * leaves the service `idle`/`closed` without throwing. Connection state is
 * broadcast on the bus so any window can reflect it.
 */
import { Emitter } from "@/core/events";
import { createLogger } from "@/core/log";
import { getBus, type AppBus, type SocketStatus } from "@/core/bus";

const log = createLogger("socket");

const MIN_BACKOFF = 1000;
const MAX_BACKOFF = 30_000;

export interface InboundMessage {
  type: string;
  payload?: unknown;
}

interface SocketEvents {
  message: InboundMessage;
  status: SocketStatus;
}

export class SocketService {
  private readonly emitter = new Emitter<SocketEvents>();
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private status: SocketStatus = "idle";
  private backoff = MIN_BACKOFF;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRun = false;

  constructor(private readonly bus: AppBus = getBus()) {}

  on<K extends keyof SocketEvents>(type: K, listener: (payload: SocketEvents[K]) => void): () => void {
    return this.emitter.on(type, listener);
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  /** Begin (or retarget) the connection. No-op when url is falsy. */
  connect(url: string | null | undefined): void {
    if (!url || typeof WebSocket === "undefined") {
      log.info("socket disabled (no url configured)");
      return;
    }
    this.url = url;
    this.shouldRun = true;
    this.open();
  }

  send(message: InboundMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  close(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.setStatus("closed");
  }

  private open(): void {
    if (!this.url) return;
    this.setStatus(this.backoff === MIN_BACKOFF ? "connecting" : "reconnecting");
    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      log.warn("socket construct failed", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.backoff = MIN_BACKOFF;
      this.setStatus("open");
      log.info("socket open");
    };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as InboundMessage;
        this.emitter.emit("message", msg);
      } catch {
        /* ignore malformed frames */
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      if (this.shouldRun) this.scheduleReconnect();
      else this.setStatus("closed");
    };
    this.ws.onerror = () => this.ws?.close();
  }

  private scheduleReconnect(): void {
    this.setStatus("reconnecting");
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }

  private setStatus(status: SocketStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.emitter.emit("status", status);
    this.bus.emit("socket:status", status);
  }
}
