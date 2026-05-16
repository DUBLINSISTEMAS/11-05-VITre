/**
 * Re-export de todo o schema. Drizzle lê daqui via `schema: "./src/db/schema"` em drizzle.config.ts.
 */
export * from "./auth";
export * from "./catalog";
export * from "./customer";
export * from "./inventory";
export * from "./order";
export * from "./store";
