# Replay

A session-replay tool with AI bug detection. It records user sessions in the browser,
stores them, lets you replay them in a dashboard, and uses the Claude API to summarize
sessions and flag likely bugs.

## Architecture (planned)
rrweb recorder (browser) → FastAPI (Python) → Postgres (metadata) + AWS S3 (event blobs)
→ Redis + Celery (background jobs, e.g. AI analysis) → React dashboard.
AI summaries/bug detection via the Claude API. AI evals in Python.
Stack switched on 2026-10-03 (from Express/TS backend) because vd wants a Python, job-market-focused stack.

## Folder structure (planned monorepo)
- apps/dashboard   → React + TypeScript + Vite + Tailwind dashboard (npm workspace)
- apps/api-py      → FastAPI server (Python, venv + pip + requirements.txt)
- apps/demo-site   → fake shop used to test recording
- packages/recorder → the rrweb snippet sites install
- packages/shared  → types shared by frontend and backend
- evals/           → Python evals for AI summaries (later)

## Tech stack
- Backend: Python 3.12 + FastAPI, Pydantic (validation), uvicorn (server)
- Database: Postgres, via SQLAlchemy + Alembic (migrations)
- Queue: Redis + Celery
- Storage: AWS S3 for session events
- AI: Claude API; evals in Python
- Tests: pytest. Lint/format: Ruff (Python), ESLint + Prettier (frontend)
- Frontend + recorder: TypeScript, React + Vite + Tailwind CSS (browsers only run JavaScript)
- Infra: Docker (local Postgres + Redis), GitHub Actions for CI, deploy to AWS later
- Python tooling: plain venv + pip (chosen to teach the basics). Run Python with `py` on this machine
  (`python` is a broken Windows Store alias). Use `py -3.12`: the C:\Python313 install is broken
  (no Lib folder, "Could not find platform independent libraries"). Inside the venv, plain `python` works.
  Second laptop (set up 2026-10-03): Python install manager with 3.14 (default) + 3.12 added via
  `py install 3.12`; the venv was made with `py -V:3.12 -m venv .venv`. Node 24 installed via winget.

## Commands
Run from the repo root:
- `npm install`          → install packages for all workspaces
- `npm run lint`         → ESLint: find likely bugs
- `npm run format`       → Prettier: auto-format all files
- `npm run format:check` → Prettier: check formatting without changing files
- `npm run services:up`  → start local Postgres (port 5432) + Redis (port 6379) in Docker
- `npm run services:down` → stop them (data is kept in Docker volumes)

Python API, run from apps/api-py with the venv active (`source .venv/Scripts/activate`):
- `pip install -r requirements-dev.txt` → install Python packages into .venv
- `python -m app.main` → start the API on http://localhost:4000 (restarts on save); docs at /docs
- `pytest` → run tests (creates/uses a separate `replay_test` database)
- `ruff check .` / `ruff format .` → lint / auto-format Python
- `alembic revision --autogenerate -m "msg"` → after editing app/models.py: write a migration
- `alembic upgrade head` → apply migrations

Docker Desktop must be running first ("Engine running").

## Current phase
Phase 0 (repo setup) COMPLETE on 2026-09-29: git + GitHub, .gitignore/.gitattributes, npm workspaces,
TypeScript, ESLint + Prettier, .env.example, Docker Compose (Postgres + Redis), GitHub Actions CI
(.github/workflows/ci.yml runs lint + format:check), README.
Phase 1 (Express API + database), approved plan, on branch `feature/api`:
1. Express + TS + tsx dev server (DONE)  2. GET /health (DONE)
3. .env loading via Node --env-file-if-exists + src/config.ts (DONE)
4. Prisma + Session table (DONE)  5. POST/GET /sessions with Zod (DONE, src/routes/sessions.ts)
6-8 (tests, CI, PR) were never done in TypeScript; feature/api was never merged.
Steps 1-5 above were built in TypeScript, then the stack switched to Python (2026-10-03).
Phase 1b (rebuild API in Python), approved plan, on branch `feature/python-api`, folder apps/api-py:
Steps 0-7 built together on 2026-10-03 at vd's request: venv, FastAPI /health, config.py
(pydantic-settings), SQLAlchemy model `ReplaySession` (table `sessions`) + Alembic, POST/GET /sessions
(Pydantic, camelCase JSON like the old API, bad data → 422), pytest, Ruff, CI job `api-py`.
Old Prisma tables ("Session", _prisma_migrations) are left in the local DB; they don't clash.
First Alembic migration `5faa56f9945a` (create sessions table) added + checked (upgrade, downgrade,
real server POST/GET). Old Express API (apps/api) deleted. NEXT: PR feature/python-api → main + merge.
Later phases: 2 recorder + demo shop, 3 dashboard replay, 4 S3, 5 Celery + Claude AI, 6 deploy (AWS) + evals.

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
