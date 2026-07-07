# Deployment

## Topology A — single VPS with docker-compose (recommended first)

```bash
cp .env.example .env   # fill UBI_EMAIL/UBI_PASSWORD, PAIRING_SECRET, ADMIN_TOKEN; DEMO_MODE=false
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

Services: `app` (Next standalone, :3000), `worker` (WS hub :8787 + queues), `postgres`, `redis`.
Put Cloudflare (or Caddy) in front: proxy `/` → :3000 and `wss://host/live/*` → :8787, enable
HTTP caching for `/operators*`, `/maps*`, `/weapons*` (they're static-generated), WAF on. The
companion's hub URL is then `wss://your-domain/live/ingest`.

## Topology B — Vercel + managed services

Vercel hosts the Next app (build command `npm run build`, env vars from `.env.example`).
Vercel functions cannot hold WebSockets or run schedulers, so the worker must live elsewhere:
Fly.io/Railway with `npm run worker` (Dockerfile works as-is with the command overridden).
Point `DATABASE_URL` at Neon and `REDIS_URL` at Upstash for both. DNS: `live.your-domain` →
worker for WS traffic.

## Operational notes

The Ubisoft service account is your most fragile asset: keep 2FA off, never log into it from a
browser while the site runs (invalidates tickets), and watch for 429s in logs — the session
manager already single-flights logins, but two deployments sharing one account will fight; use
one account per environment. Season rollover: bump `CURRENT_SEASON_ID` (src/lib/constants.ts)
and follow src/data/README.md the day a season ships; the archive job preserves final standings
automatically in the last days (it runs daily). Health: `/api/health` is your uptime probe;
`/admin` shows provider circuits, cache and DB counts. Player privacy: set `optOut` on a Player
row to honor removal requests; deletes cascade snapshots and matches.

## Rate-limit budget (defaults)

Ubisoft: burst 10, sustained 5 req/s process-wide; boards cached 3 min, detailed stats 15 min,
identities 24 h. A profile page view costs ≤6 upstream calls cold, 0 warm. R6Data: 2 req/s,
respect your plan quota (`/api/me/usage`).
