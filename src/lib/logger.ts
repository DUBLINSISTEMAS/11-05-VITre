/**
 * Logger estruturado para o Mangos Pay.
 *
 * Por quê:
 *   - `console.error("...", err)` perde contexto: Vercel agrega como string
 *     bagunçada, sem como filtrar por tipo/loja/operação.
 *   - Logger emite JSON com `level`, `event`, `timestamp` + payload — Vercel
 *     parseia automaticamente em "Filter by JSON".
 *
 * Uso:
 *   logger.error("order.expire.cron_failed", { orderId, err });
 *   logger.warn("restock.partial_miss", { orderId, productId, quantity });
 *   logger.info("auth.signup", { userId, email });
 *
 * Convenções:
 *   - `event` = string namespaced em snake_case `area.subarea.action`.
 *     Facilita grep/filtro: `event:order.*` pega tudo de pedido.
 *   - Para Error: passar como `err` no payload — o logger extrai
 *     `name`/`message`/`stack` automaticamente.
 *   - PII (email, telefone, customerName): NÃO logar exceto em DEBUG.
 *     Use `userId`, `orderId`, IDs opacos.
 *
 * Sentry (T1-3):
 *   - `logger.error(...)` reenvia automaticamente pro Sentry como
 *     `captureException` quando `err` é Error, ou `captureMessage` caso
 *     contrário. `event` vira `tags.event` pra filtrar no dashboard.
 *   - `logger.warn/info/debug` NÃO sobem pro Sentry (ruído > sinal pra Free
 *     tier 5k/mês).
 *   - Se Sentry não estiver inicializado (dev sem DSN), `captureException`
 *     é no-op silencioso.
 */
import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown> & {
  err?: unknown;
};

interface LogRecord {
  level: LogLevel;
  event: string;
  timestamp: string;
  err?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

function serializeError(e: unknown): LogRecord["err"] | undefined {
  if (!e) return undefined;
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
    };
  }
  return {
    name: "NonError",
    message: typeof e === "string" ? e : JSON.stringify(e),
  };
}

// Onda C #11 (auditoria 2026-05-19): gate de verbosidade por ambiente.
// `debug` é silenciado em prod (NODE_ENV === 'production'). `info`/`warn`/
// `error` continuam — `error` é o único que sobe pro Sentry. Em test
// também silenciamos `debug`/`info` pra não poluir output da suite.
const IS_PROD = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test";
const LEVEL_ENABLED: Record<LogLevel, boolean> = {
  debug: !IS_PROD && !IS_TEST,
  info: !IS_TEST,
  warn: true,
  error: true,
};

function emit(level: LogLevel, event: string, payload: LogPayload = {}): void {
  if (!LEVEL_ENABLED[level]) return;
  const { err, ...rest } = payload;
  const record: LogRecord = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...rest,
  };
  const serialized = serializeError(err);
  if (serialized) record.err = serialized;

  const line = JSON.stringify(record);

  if (level === "error") {
    console.error(line);
    // Reenvia pro Sentry só nível `error`. No-op se SDK não inicializado.
    if (err instanceof Error) {
      Sentry.captureException(err, {
        tags: { event },
        extra: rest,
      });
    } else {
      Sentry.captureMessage(event, {
        level: "error",
        tags: { event },
        extra: { ...rest, err: serialized },
      });
    }
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (event: string, payload?: LogPayload) => emit("debug", event, payload),
  info: (event: string, payload?: LogPayload) => emit("info", event, payload),
  warn: (event: string, payload?: LogPayload) => emit("warn", event, payload),
  error: (event: string, payload?: LogPayload) => emit("error", event, payload),
};
