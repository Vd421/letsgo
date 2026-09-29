// Prisma settings: where the schema and migrations live, and which database to use.
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Load the repo-root .env file (Prisma commands run from apps/api). CI has no .env, so skip if missing.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
