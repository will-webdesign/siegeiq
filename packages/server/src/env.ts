import { z } from "zod";

/**
 * Central, validated environment access. Server-only — never import from
 * client components. Everything is optional so the app boots credential-free
 * in demo mode; providers report themselves unavailable when unconfigured.
 */
const EnvSchema = z.object({
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  PROVIDER_ORDER: z.string().optional().default("ubisoft,r6data,demo"),
  UBI_EMAIL: z.string().optional().default(""),
  UBI_PASSWORD: z.string().optional().default(""),
  R6DATA_API_KEY: z.string().optional().default(""),
  DATABASE_URL: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  LIVE_WS_PORT: z.coerce.number().optional().default(8787),
  PAIRING_SECRET: z.string().optional().default("dev-pairing-secret"),
  ADMIN_TOKEN: z.string().optional().default(""),
  NEXT_PUBLIC_SITE_URL: z.string().optional().default("http://localhost:3000"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}

export function isDemoMode(): boolean {
  const e = env();
  // Demo mode is on when explicitly enabled, or when nothing is configured.
  if (e.DEMO_MODE) return true;
  return !e.UBI_EMAIL && !e.R6DATA_API_KEY;
}

export function providerOrder(): string[] {
  return env()
    .PROVIDER_ORDER.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
