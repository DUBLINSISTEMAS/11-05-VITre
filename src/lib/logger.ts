/**
 * Logger estruturado para o Vitrê.
 *
 * Por quê:
 *   - `console.error("...", err)` perde contexto: Vercel agrega como string
 *     bagunçada, sem como filtrar por tipo/loja/operação.
 *   - Logger emite JSON com `level`, `event`, `timestamp` + payload — Vercel
 *     parseia automaticamente em "Filter by JSON".
 *   - Sem dependência externa (não usa Sentry/Pino/winston). Fica pequeno
 *     enquanto MVP, fácil de trocar depois.
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
 */

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

function emit(level: LogLevel, event: string, payload: LogPayload = {}): void {
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
