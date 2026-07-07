import type { FastifyInstance } from "fastify";
import { fail, ok, parsePlatform } from "../envelope";
import {
  getBoards,
  getMaps,
  getMatches,
  getOperators,
  getProgression,
  getRankHistory,
  getSummary,
  getWeapons,
  searchPlayer,
} from "@siegeiq/server/services/player-service";
import { isDemoProfileId } from "@siegeiq/server/providers/demo";
import { createGoal, getGoalProgress } from "@siegeiq/server/coaching/engine";
import { getSessionReport } from "@siegeiq/server/coaching/session-report";
import type { GoalType } from "@siegeiq/shared/goal-types";

const UUID_ISH = /^[0-9a-f-]{20,40}$/i;
const GOAL_TYPES: GoalType[] = ["reduce_early_deaths"];

function validProfileId(profileId: string): boolean {
  return UUID_ISH.test(profileId) || isDemoProfileId(profileId);
}

export async function playersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { platform?: string; name?: string } }>(
    "/players/search",
    async (req, reply) => {
      const platform = parsePlatform(req.query.platform ?? null);
      const name = (req.query.name ?? "").trim();
      if (!platform || name.length < 2 || name.length > 30) {
        return reply
          .status(400)
          .send({ error: "platform (uplay|psn|xbl) and name (2–30 chars) are required" });
      }
      try {
        return await ok(reply, await searchPlayer(platform, name));
      } catch (e) {
        return fail(reply, e);
      }
    },
  );

  app.get<{
    Params: { profileId: string; section: string };
    Querystring: { platform?: string; gameMode?: string; goalType?: string };
  }>("/players/:profileId/:section", async (req, reply) => {
    const { profileId, section } = req.params;
    const platform = parsePlatform(req.query.platform ?? null) ?? "uplay";
    // "goals"/"session-report" also accept demo profileIds — the demo goal
    // loop must be fully usable with zero credentials.
    const idOk =
      section === "goals" || section === "session-report"
        ? validProfileId(profileId)
        : UUID_ISH.test(profileId);
    if (!idOk) return reply.status(400).send({ error: "invalid profileId" });
    try {
      switch (section) {
        case "boards":
          return await ok(reply, await getBoards(profileId, platform));
        case "summary": {
          const mode = (req.query.gameMode ?? "all") as "all" | "ranked" | "casual" | "unranked";
          return await ok(reply, await getSummary(profileId, platform, mode));
        }
        case "operators":
          return await ok(reply, await getOperators(profileId, platform));
        case "weapons":
          return await ok(reply, await getWeapons(profileId, platform));
        case "maps":
          return await ok(reply, await getMaps(profileId, platform));
        case "progression":
          return await ok(reply, await getProgression(profileId, platform));
        case "rank-history":
          return reply.send({ data: await getRankHistory(profileId) });
        case "matches":
          return reply.send({ data: await getMatches(profileId) });
        case "goals": {
          const goalType = (req.query.goalType ?? "reduce_early_deaths") as GoalType;
          return reply.send({ data: await getGoalProgress(profileId, goalType) });
        }
        case "session-report":
          return reply.send({ data: await getSessionReport(profileId) });
        default:
          return reply.status(404).send({ error: `unknown section “${section}”` });
      }
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post<{ Params: { profileId: string; section: string }; Body: { goalType?: string } }>(
    "/players/:profileId/:section",
    async (req, reply) => {
      const { profileId, section } = req.params;
      if (!validProfileId(profileId)) {
        return reply.status(400).send({ error: "invalid profileId" });
      }
      if (section !== "goals") {
        return reply.status(404).send({ error: `unsupported POST section “${section}”` });
      }
      const goalType = req.body?.goalType as GoalType | undefined;
      if (!goalType || !GOAL_TYPES.includes(goalType)) {
        return reply.status(400).send({ error: "unsupported goalType" });
      }
      try {
        await createGoal(profileId, goalType);
        return reply.send({ data: await getGoalProgress(profileId, goalType) });
      } catch (e) {
        return fail(reply, e);
      }
    },
  );
}
