# Replay

A session-replay tool with AI bug detection. It records user sessions in the browser,
stores them, lets you replay them in a dashboard, and uses the Claude API to summarize
sessions and flag likely bugs.

## Architecture (planned)
rrweb recorder (browser) → Express API → Postgres (metadata) + Cloudflare R2 (event blobs)
→ Redis + BullMQ (background jobs, e.g. AI analysis) → React dashboard.
AI summaries/bug detection via the Claude API. Python used later for AI evals.

## Folder structure (planned monorepo, npm workspaces)
- apps/dashboard   → React + Vite + Tailwind dashboard
- apps/api         → Express server (routes/, services/, jobs/, db/)
- apps/demo-site   → fake shop used to test recording
- packages/recorder → the rrweb snippet sites install
- packages/shared  → types shared by frontend and backend
- evals/           → Python evals for AI summaries (later)

## Tech stack
- Language: TypeScript everywhere (Python only for evals)
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: Postgres (Neon), via Prisma
- Storage: Cloudflare R2 (S3-compatible) for session events
- Queue: Redis + BullMQ
- Infra: Docker (local Postgres + Redis), GitHub Actions for CI

## Commands
Run from the repo root:
- `npm install`          → install packages for all workspaces
- `npm run lint`         → ESLint: find likely bugs
- `npm run format`       → Prettier: auto-format all files
- `npm run format:check` → Prettier: check formatting without changing files
- `npm run services:up`  → start local Postgres (port 5432) + Redis (port 6379) in Docker
- `npm run services:down` → stop them (data is kept in Docker volumes)

- `npm run dev -w @replay/api` → start the API on http://localhost:4000 (restarts on save)
- `npm run typecheck -w @replay/api` → TypeScript type check for the API

Docker Desktop must be running first ("Engine running").

## Current phase
Phase 0 (repo setup) COMPLETE on 2026-09-29: git + GitHub, .gitignore/.gitattributes, npm workspaces,
TypeScript, ESLint + Prettier, .env.example, Docker Compose (Postgres + Redis), GitHub Actions CI
(.github/workflows/ci.yml runs lint + format:check), README.
Phase 1 (Express API + database), approved plan, on branch `feature/api`:
1. Express + TS + tsx dev server (DONE)  2. GET /health (DONE)
3. .env loading via Node --env-file-if-exists + src/config.ts (DONE)
4. Prisma + Session table (NEXT)  5. POST/GET /sessions with Zod
6. Vitest + Supertest tests  7. CI runs typecheck + tests  8. README/CLAUDE.md, PR + merge.
Later phases: 2 recorder + demo shop, 3 dashboard replay, 4 R2, 5 BullMQ + Claude AI, 6 deploy + evals.

## Git workflow (what we actually do)
- Remote: https://github.com/Vd421/letsgo (`origin`), default branch `main`.
- Per feature: new branch (e.g. `setup/ci`, `feature/express-server`) → commit → push →
  vd opens + merges the Pull Request on github.com (no `gh` CLI installed) → `git pull` on main
  → delete the branch.
- Guide PRs one click at a time; vd finds long multi-step instructions hard to follow.
Note: TypeScript is pinned to 6.0.x because typescript-eslint doesn't support TS 7 yet.

## About the developer
vd is a beginner learning full-stack development by building this project.
Dev machine is Windows, using Git Bash in VS Code. Give Git Bash-compatible commands.

## How to work with me
- Teach as we go, in plain English. Explain *why*, not just *what*. Define jargon the first time.
- Explain every file before creating it: what it is, why it's needed, what's in it.
- No big changes without a plan I approve first.
- Work in small steps. Stop after each step so I can ask questions.
- Leave small, beginner-sized pieces for me to write myself, with hints.
- After finishing a step, ask me 1–2 quick questions to check I understood.

## Rules
- Before saying something works, run it and show me the output.
- Git: never commit or push without asking me. Use a new branch per feature.
  Short commit messages like "add express server" or "fix cors error".
- Never commit secrets (API keys, database URLs). Put them in `.env`, which is git-ignored.
- Keep this file up to date: update "Current phase" and "Commands" as things change.
