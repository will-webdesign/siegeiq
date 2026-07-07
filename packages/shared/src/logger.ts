type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
// Isomorphic: `process` exists in Node/API/workers but not in the browser
// (web/desktop). Read it off globalThis so this file needs no @types/node.
const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env;
const MIN: Level = env?.NODE_ENV === "production" ? "info" : "debug";

function log(level: Level, scope: string, msg: string, meta?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN]) return;
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    scope,
    msg,
    ...meta,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logger(scope: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", scope, msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", scope, msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", scope, msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", scope, msg, meta),
  };
}
