# Replay

A session-replay tool with AI bug detection. It records user sessions in the browser,
stores them, lets you replay them in a dashboard, and uses the Claude API to summarize
sessions and flag likely bugs.

## Architecture (planned)
rrweb recorder (browser) â†’ FastAPI (Python) â†’ Postgres (metadata) + AWS S3 (event blobs)
â†’ Redis + Celery (background jobs, e.g. AI analysis) â†’ React dashboard.
AI summaries/bug detection via the Claude API. AI evals in Python.
Stack switched on 2026-10-03 (from Express/TS backend) because vd wants a Python, job-market-focused stack.

## Folder structure (planned monorepo)
- apps/dashboard   â†’ React + TypeScript + Vite + Tailwind dashboard (npm workspace)
- apps/api-py      â†’ FastAPI server (Python, venv + pip + requirements.txt)
- apps/demo-site   â†’ fake shop used to test recording
- packages/recorder â†’ the rrweb snippet sites install
- packages/shared  â†’ types shared by frontend and backend
- evals/           â†’ Python evals for AI summaries (later)

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
- `npm install`          â†’ install packages for all workspaces
- `npm run lint`         â†’ ESLint: find likely bugs
- `npm run format`       â†’ Prettier: auto-format all files
- `npm run format:check` â†’ Prettier: check formatting without changing files
- `npm run services:up`  â†’ start local Postgres (port 5432) + Redis (port 6379) in Docker
- `npm run services:down` â†’ stop them (data is kept in Docker volumes)
- `npm run typecheck`    â†’ TypeScript check for every workspace that has a typecheck script
- `npm test`             â†’ dashboard tests (Vitest, apps/dashboard/src/**/*.test.ts)
- `npm run dashboard`    â†’ dashboard (Vite) on http://localhost:5174
- `npm run shop`         â†’ demo shop (Vite) on http://localhost:5173 (port fixed: the API's CORS allows it)

Python API, run from apps/api-py with the venv active (`source .venv/Scripts/activate`):
- `pip install -r requirements-dev.txt` â†’ install Python packages into .venv
- `python -m app.main` â†’ start the API on http://localhost:4000 (restarts on save); docs at /docs
- `pytest` â†’ run tests (creates/uses a separate `replay_test` database)
- `ruff check .` / `ruff format .` â†’ lint / auto-format Python
- `alembic revision --autogenerate -m "msg"` â†’ after editing app/models.py: write a migration
- `alembic upgrade head` â†’ apply migrations

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
(Pydantic, camelCase JSON like the old API, bad data â†’ 422), pytest, Ruff, CI job `api-py`.
Old Prisma tables ("Session", _prisma_migrations) are left in the local DB; they don't clash.
First Alembic migration `5faa56f9945a` (create sessions table) added + checked (upgrade, downgrade,
real server POST/GET). Old Express API (apps/api) deleted. Merged as PR #4 on 2026-10-03.
Phase 2 (recorder + demo shop), approved plan, on branch `feature/recorder` (built 2026-10-03):
1. `session_events` table (model EventBatch: one row per batch, events as JSONB, FK â†’ sessions CASCADE)
2. POST/GET /sessions/{id}/events (404 for unknown session, max 1000 events/batch, bumps event_count)
3. CORS (settings.cors_origins, default http://localhost:5173)  4. apps/demo-site: Vite + plain TS shop
with a deliberate bug (checkout silently fails over $100)  5. packages/recorder: rrweb 2.1.7,
startRecording(), batches every 5s, maskAllInputs  6. checked end-to-end with headless Edge
7. CI runs `npm run typecheck`. Merged as PR #5 on 2026-10-03. Also tested with 10 Playwright
shoppers (6 orders OK, 4 hit the bug as designed). Events live in Postgres for now; Phase 4 moves them to S3.
Phase 3 (dashboard + replay player), on branch `feature/dashboard`:
0. notes + CLAUDE.md (DONE, PR #6)  1. apps/dashboard: React 19 + TS + Vite 8 + Tailwind 4, port 5174, in CORS (DONE)
2. Session/SessionCreate/EventBatchSaved types in packages/shared, used by dashboard + recorder (DONE)
3. GET /sessions/{id} + tests (DONE)  Also: Tiny Shop restyled (Bricolage Grotesque + Figtree) (DONE).
Steps 1-3 committed 2026-10-04, not yet PR'd.
DESIGN APPROVED by vd on 2026-10-04 after many rounds: docs/design/dashboard-mockup.html (open it in a browser;
also published at https://claude.ai/artifact/XUtDquUUMCxHhZR9wVLgtN). Build the real dashboard to match it:
- Dark-first (near-black #0b0b0c, panels #161618 / #1f1f22, radius ~24px), light mode via toggle.
- Only two accents: orange-red #f0623f = problems/rage, violet #8d90f7 = normal activity/good outcomes.
  Text calm: soft white headings, grey labels. No gradient text, no coloured headings ("not flashy").
- Fonts: Funnel Display (numbers) + Funnel Sans (text) + Geist Mono (times/IDs); the Sessions page and the
  Recent visits table use Bricolage Grotesque + Figtree (same as Tiny Shop).
- Pages: Overview (4 KPI cards with badges, "Clicks by visitor" heatmap, "Events per visit" line chart with
  hover tooltip, Outcomes tiles, Recent visits table), Sessions (table with click strips + filter chips),
  Replay (browser frame, own controls: play/restart/speed/skip idle/fullscreen, activity timeline with click
  dots + rage zone, Moments/Visitor/AI tabs; autoplays on open; no decorative background).
- vd rejected: ghost-cursor background on the replay page, big marketing headline, dark-navy separate stage.
DONE 2026-10-04: 4a design tokens (apps/dashboard/src/index.css: @theme inline over CSS vars, dark default,
data-theme="light" + localStorage "replay-theme")  4b shell: React Router 8 (BrowserRouter), Layout/Sidebar/
TopBar, routes / (Overview placeholder), /sessions, /sessions/:id (Replay placeholder), /replay (â†’ newest)
4d rage detection: app/analysis.py (pure analyze(events)). Rage = 3+ DEAD clicks (no rrweb mutation within
500ms) on the same element / within 30px, inside 2s. First version without the dead-click check wrongly
flagged "4 T-shirts" (fast Add clicks); real recordings exposed it. GET /sessions and /sessions/{id} now
return SessionSummary (durationMs, clickCount, rageClickCount, hasRage, clicks[{at,rage}]); computed per
request (fine for now). 4c Sessions page with real data (filters, search via ?q=, 10s refresh, states).
Also: Tiny Shop validates the email at checkout (type=email + pattern, red message, no order).
DONE 2026-10-04: 5 Replay page (rrweb Replayer driven by replay/useReplayer.ts, our own Theatre/Timeline/
Controls/Inspector, Moments built from events in replay/moments.ts, fits tall/narrow windows)
6 Overview from real data (computeStats in src/stats.ts, done in the browser for local time zones;
KpiCards, Heatmap "Visits by time", hand-drawn SVG EventsChart, Outcomes, RecentVisits).
Empty visits (eventCount < 3) are hidden everywhere. Steps 0-6 merged as PR #7 on 2026-10-04.
8 Vitest (25 tests: format/stats/moments, pass in any time zone) + `npm test` in CI, branch
feature/dashboard-tests. Step 7 polish skipped by vd's choice ("finish this phase and move on").
PHASE 3 COMPLETE once the tests PR is merged. Open item: delete test-robot visits only if vd agrees.
Next: Phase 4 (event storage â†’ AWS S3) or Phase 5 (Celery + Claude AI summaries): ask vd which first.
Note: the shop and dashboard Vite servers listen on 127.0.0.1 (host setting) because Node on Windows otherwise listened only on ::1 and browsers got "can't be reached"; CORS allows both localhost and 127.0.0.1.
Note: on this Windows laptop `uvicorn --reload` got stuck twice (old code kept answering). Run the API
without --reload and restart it after API changes; check for leftovers on port 4000.
Full learning notes of everything so far: notes/everything-so-far.md.
Later phases: 2 recorder + demo shop, 3 dashboard replay, 4 S3, 5 Celery + Claude AI, 6 deploy (AWS) + evals.

## Git workflow (what we actually do)
- Remote: https://github.com/Vd421/letsgo (`origin`), default branch `main`.
- Per feature: new branch (e.g. `setup/ci`, `feature/express-server`) â†’ commit â†’ push â†’
  Pull Request â†’ vd merges on github.com â†’ `git pull` on main â†’ delete the branch.
- No `gh` CLI. Claude can open PRs and read CI results via the GitHub REST API, using the token
  from `git credential fill` (never print it). Merging into main is ALWAYS vd's click (blocked for Claude).
- Guide PRs one click at a time; vd finds long multi-step instructions hard to follow.
Note: TypeScript is pinned to 6.0.x because typescript-eslint doesn't support TS 7 yet.

## About the developer
vd is a beginner learning full-stack development by building this project.
Started frontend from zero knowledge on 2026-10-03: wants to learn "side by side" (a short lesson,
then a small build step, repeat), in easy plain English (not childish), with their own code as examples.
Dev machine is Windows, using Git Bash in VS Code. Give Git Bash-compatible commands.

## How to work with me
- Teach as we go, in plain English. Explain *why*, not just *what*. Define jargon the first time.
- Explain every file before creating it: what it is, why it's needed, what's in it.
- No big changes without a plan I approve first.
- Work in small steps. Stop after each step so I can ask questions.
- Leave small, beginner-sized pieces for me to write myself, with hints.
- After finishing a step, ask me 1â€“2 quick questions to check I understood.

## Rules
- Before saying something works, run it and show me the output.
- Git: never commit or push without asking me. Use a new branch per feature.
  Short commit messages like "add express server" or "fix cors error".
- Never commit secrets (API keys, database URLs). Put them in `.env`, which is git-ignored.
- Keep this file up to date: update "Current phase" and "Commands" as things change.
