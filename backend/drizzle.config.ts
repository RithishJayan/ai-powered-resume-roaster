import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const backendRoot = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(backendRoot, ".env.local") });
config({ path: resolve(backendRoot, ".env") });
config({ path: resolve(backendRoot, "..", ".env.local") });
config({ path: resolve(backendRoot, "..", ".env") });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://resume_roast:resume_roast@127.0.0.1:5434/resume_roast",
  },
});
