/**
 * Background controller — the single long-lived owner of game state and the
 * orchestrator that wires the services together. Runs in the background window
 * under Overwolf; in dev mode each page instantiates its own controller with
 * the mock GEP source.
 *
 * Responsibilities:
 *   • reduce the normalized GEP event stream into immutable AppState,
 *   • publish every snapshot on the bus so any window can consume it,
 *   • drive the content, socket, notification and coaching services.
 */
import { createGepSource, type GepSource, type SiegeEvent } from "@/lib/gep";
import { runtimeMode } from "@/lib/ow/env";
import { createStore, type Store } from "@/state/store";
import { initialAppState, type AppState, type KillFeedEntry } from "@/state/app-state";
import { getBus, type AppBus } from "@/core/bus";
import { NotificationService } from "@/services/notification-service";
import { SocketService } from "@/services/socket-service";
import { ContentService } from "@/services/content-service";
import { CoachingService } from "@/services/coaching-service";
import { GepHealthService } from "@/services/gep-health-service";

const FEED_LIMIT = 30;
const LOG_LIMIT = 200;

export class SiegeIQController {
  readonly store: Store<AppState>;
  readonly bus: AppBus;
  readonly notifications: NotificationService;
  readonly socket: SocketService;
  readonly content: ContentService;
  private readonly coaching: CoachingService;
  private readonly gepHealth: GepHealthService;
  private gep: GepSource;

  constructor() {
    this.store = createStore(initialAppState(runtimeMode()));
    this.bus = getBus();
    this.gep = createGepSource();
    this.notifications = new NotificationService(this.bus);
    this.socket = new SocketService(this.bus);
    this.content = new ContentService(this.bus);
    this.coaching = new CoachingService(this.notifications, this.socket);
    this.gepHealth = new GepHealthService((degraded) => {
      this.gep.setDegradedFeatures(degraded);
      this.refreshGepStatus();
    });
  }

  async start(): Promise<void> {
    // Broadcast every state snapshot so decoupled windows can subscribe.
    this.store.subscribe((s) => this.bus.emit("state:changed", s));

    this.content.start();
    this.gepHealth.start();
    this.socket.connect(import.meta.env.VITE_WS_URL as string | undefined);

    this.gep.on((e) => {
      this.reduce(e);
      this.coaching.handle(e, this.store.getState());
    });
    await this.gep.start();
    this.refreshGepStatus();
    setInterval(() => this.refreshGepStatus(), 5000);
  }

  toggleOverlay(): void {
    this.store.setState((s) => ({ overlayVisible: !s.overlayVisible }));
  }

  private refreshGepStatus(): void {
    this.store.setState({ gep: this.gep.status() });
  }

  private feed(s: AppState, entry: Omit<KillFeedEntry, "at">): KillFeedEntry[] {
    return [...s.killFeed, { ...entry, at: Date.now() }].slice(-FEED_LIMIT);
  }

  private reduce(e: SiegeEvent): void {
    this.store.setState((s) => {
      const eventLog = [...s.eventLog, { at: Date.now(), event: e }].slice(-LOG_LIMIT);
      const base: Partial<AppState> = { eventLog };
      switch (e.type) {
        case "game_launched":
          return { ...base, gameRunning: true };
        case "game_closed":
          return {
            ...base,
            gameRunning: false,
            matchActive: false,
            live: null,
            phase: "unknown",
          };
        case "phase":
          return { ...base, phase: e.phase };
        case "match_start":
          return {
            ...base,
            matchActive: true,
            sessionRounds: [],
            killFeed: this.feed(s, { text: "Match started", kind: "match" }),
          };
        case "match_end":
          return {
            ...base,
            matchActive: false,
            side: null,
            myOperator: null,
            killFeed: this.feed(s, { text: "Match ended", kind: "match" }),
          };
        case "side":
          return { ...base, side: e.side };
        case "operator_selected":
          return { ...base, myOperator: e.operatorSlug };
        case "roster_update":
          return { ...base, live: { ...e.state, side: s.side } };
        case "round_start":
          return {
            ...base,
            roundKills: 0,
            roundDeaths: 0,
            killFeed: this.feed(s, { text: `Round ${e.round} started`, kind: "round" }),
          };
        case "round_end":
          return {
            ...base,
            sessionRounds: [
              ...s.sessionRounds,
              {
                round: e.round,
                won: e.won,
                kills: s.roundKills,
                deaths: s.roundDeaths,
                side: s.side,
                outcomeType: e.outcomeType,
              },
            ],
            killFeed: this.feed(s, {
              text: e.won === null ? `Round ${e.round} ended` : e.won ? `Round ${e.round} won` : `Round ${e.round} lost`,
              kind: "round",
            }),
          };
        case "kill":
          return {
            ...base,
            roundKills: s.roundKills + 1,
            killFeed: this.feed(s, { text: e.headshot ? "Kill (headshot)" : "Kill", kind: "kill" }),
          };
        case "death":
          return {
            ...base,
            roundDeaths: s.roundDeaths + 1,
            killFeed: this.feed(s, { text: e.killer ? `Killed by ${e.killer}` : "You died", kind: "death" }),
          };
        case "knocked_out":
          return { ...base, killFeed: this.feed(s, { text: "Knocked down", kind: "death" }) };
        case "defuser_planted":
          return { ...base, killFeed: this.feed(s, { text: "Defuser planted", kind: "objective" }) };
        case "defuser_disabled":
          return { ...base, killFeed: this.feed(s, { text: "Defuser disabled", kind: "objective" }) };
        case "score":
          return base;
        case "map":
        case "game_mode":
          return base;
        default:
          return base;
      }
    });
  }
}
