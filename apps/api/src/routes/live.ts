import type { FastifyInstance } from "fastify";
import { getLiveState, pairingToken } from "../live/live-server";

const UUID_ISH = /^[0-9a-f-]{20,40}$/i;

export async function liveRoutes(app: FastifyInstance) {
  /** Live state poll endpoint (WS is the primary transport). */
  app.get<{ Params: { profileId: string } }>("/live/:profileId", async (req, reply) => {
    return reply.send({ data: getLiveState(req.params.profileId) });
  });

  /** Issues a companion pairing token. Tokens are HMAC-signed and only
   *  authorize pushing live events for that profile — nothing else. */
  app.post<{ Body: { profileId?: string } }>("/live/pair", async (req, reply) => {
    const profileId = req.body?.profileId ?? "";
    if (!UUID_ISH.test(profileId)) {
      return reply.status(400).send({ error: "invalid profileId" });
    }
    return reply.send({ data: { token: pairingToken(profileId) } });
  });
}
