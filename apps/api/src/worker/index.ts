/**
 * SiegeIQ worker process — run alongside the Next.js app:
 *   npm run worker
 * Hosts the live-match WebSocket hub and background queues.
 */
import { logger } from "@siegeiq/shared";
import { startLiveServer } from "../live/live-server";
import { startQueues } from "./queues";

const log = logger("worker");

async function main() {
  startLiveServer();
  await startQueues();
  log.info("worker up");
}

main().catch((e) => {
  log.error("worker crashed", { error: String(e) });
  process.exit(1);
});
