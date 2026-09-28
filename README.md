# Replay

[![CI](https://github.com/Vd421/letsgo/actions/workflows/ci.yml/badge.svg)](https://github.com/Vd421/letsgo/actions/workflows/ci.yml)

Session replay with AI bug detection. Replay records what users do on a website, lets you
watch those sessions back in a dashboard, and uses the Claude API to summarize each session
and flag likely bugs.

> 🚧 **Work in progress.** Phase 0 (repo setup) is complete. App code starts in Phase 1.

## How it works (planned)

```
Website with recorder snippet (rrweb)
        │  sends recorded events
        ▼
Express API ──► Postgres (session info)
        │   └─► Cloudflare R2 (raw event recordings)
        ▼
Redis + BullMQ job queue ──► Claude API (summaries + bug detection)
        │
        ▼
React dashboard (list, replay, and read AI summaries)
```

## Tech stack

| Area     | Tools                                     |
| -------- | ----------------------------------------- |
| Language | TypeScript (Python later for AI evals)    |
| Frontend | React, Vite, Tailwind CSS                 |
| Backend  | Node.js, Express                          |
| Data     | Postgres (Neon) + Prisma, Cloudflare R2   |
| Jobs     | Redis + BullMQ                            |
| AI       | Claude API                                |
| Tooling  | Docker, GitHub Actions, ESLint, Prettier  |

## Project structure

This is a monorepo using npm workspaces.

```
apps/
  api/          Express server
  dashboard/    React dashboard
  demo-site/    Fake shop used to test recording
packages/
  recorder/     rrweb snippet that websites install
  shared/       Types shared by frontend and backend
```

## Getting started

**You need:** [Node.js](https://nodejs.org) 22 or newer, and
[Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
git clone https://github.com/Vd421/letsgo.git
cd letsgo
npm install                 # install packages for all workspaces
cp .env.example .env        # create your local settings file, then fill in real values
npm run services:up         # start local Postgres + Redis in Docker
```

When you're done: `npm run services:down` (your data is kept).

## Scripts

Run from the repo root:

| Command                 | What it does                                |
| ----------------------- | ------------------------------------------- |
| `npm run services:up`   | Start local Postgres (5432) + Redis (6379)  |
| `npm run services:down` | Stop them (data is kept)                    |
| `npm run lint`          | Find likely bugs with ESLint                |
| `npm run format`        | Auto-format code with Prettier              |
| `npm run format:check`  | Check formatting without changing files     |

Every push to `main` and every Pull Request runs `lint` and `format:check` in GitHub Actions.
