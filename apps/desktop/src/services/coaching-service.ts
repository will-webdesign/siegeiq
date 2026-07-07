/**
 * CoachingService — the seam where game events become coaching.
 *
 * Today it turns factual match milestones into overlay nudges (match/round
 * outcomes, session record) without ever fabricating tactical claims — the
 * product's rule is evidence over speculation. It also forwards live match
 * state to the backend socket, which is where server-side AI coaching will
 * plug in: the model's replies arrive as `coach` messages and are surfaced
 * through the same NotificationService, so no UI changes are needed later.
 */
import { createLogger } from "@/core/log";
import type { SiegeEvent } from "@/lib/gep";
import type { AppState } from "@/state/app-state";
import type { NotificationService } from "./notification-service";
import type { SocketService, InboundMessage } from "./socket-service";

const log = createLogger("coach");

export class CoachingService {
  constructor(
    private readonly notifications: NotificationService,
    private readonly socket?: SocketService,
  ) {
    this.socket?.on("message", (m) => this.onServerMessage(m));
  }

  /** Called by the controller after each event is reduced into state. */
  handle(event: SiegeEvent, state: AppState): void {
    switch (event.type) {
      case "round_end": {
        if (event.won === true) this.notifications.notify({ title: `Round ${event.round} won`, kind: "success", ttl: 4000 });
        else if (event.won === false) this.notifications.notify({ title: `Round ${event.round} lost`, kind: "warning", ttl: 4000 });
        break;
      }
      case "match_end": {
        const rounds = state.sessionRounds;
        const wins = rounds.filter((r) => r.won === true).length;
        const losses = rounds.filter((r) => r.won === false).length;
        this.notifications.coach("Match complete", `Session record ${wins}–${losses}. Open Session Report for the breakdown.`);
        break;
      }
      default:
        break;
    }
    // Forward live state to the backend for server-side coaching (no-op if the
    // socket isn't connected).
    if (state.live) this.socket?.send({ type: "live_state", payload: state.live });
  }

  private onServerMessage(msg: InboundMessage): void {
    if (msg.type !== "coach_tip") return;
    const p = msg.payload as { title?: string; body?: string } | undefined;
    if (!p?.title) return;
    log.info("server coach tip", p.title);
    this.notifications.coach(p.title, p.body);
  }
}
