import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit por padrão lê .env. Forçamos .env.local para alinhar com Next.
config({ path: ".env.local" });

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});
