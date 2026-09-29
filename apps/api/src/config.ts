// All settings the API needs, read from environment variables in one place.
// Values come from the repo-root .env file (loaded by the dev/start scripts).

const port = Number(process.env.PORT ?? 4000);

// Fail fast with a clear message instead of starting with a broken setting.
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive whole number, got "${process.env.PORT}"`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env at the repo root.");
}

export const config = { port, databaseUrl };
