/**
 * In-memory ring-buffer logger for diagnostics.
 *
 * Overwolf best practice: never write live game-event (GEP) data to the app's
 * log files. So this logger keeps a bounded buffer in memory that the
 * Diagnostics view can render, and only mirrors non-sensitive lines to the
 * console. Nothing here touches overwolf.log / disk.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogLine {
  at: number;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

const BUFFER_LIMIT = 300;
const buffer: LogLine[] = [];
const listeners = new Set<(line: LogLine) => void>();

function push(level: LogLevel, scope: string, message: string, data?: unknown): void {
  const line: LogLine = { at: Date.now(), level, scope, message, data };
  buffer.push(line);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  for (const l of listeners) l(line);
  if (level === "error") console.error(`[${scope}] ${message}`, data ?? "");
  else if (level === "warn") console.warn(`[${scope}] ${message}`, data ?? "");
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** Create a scoped logger (the scope is prefixed to every line). */
export function createLogger(scope: string): Logger {
  return {
    debug: (m, d) => push("debug", scope, m, d),
    info: (m, d) => push("info", scope, m, d),
    warn: (m, d) => push("warn", scope, m, d),
    error: (m, d) => push("error", scope, m, d),
  };
}

export function getLogBuffer(): readonly LogLine[] {
  return buffer;
}

export function onLog(listener: (line: LogLine) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
