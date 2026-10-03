# Replay

[![CI](https://github.com/Vd421/letsgo/actions/workflows/ci.yml/badge.svg)](https://github.com/Vd421/letsgo/actions/workflows/ci.yml)

Session replay with AI bug detection. Replay records what users do on a website, lets you
watch those sessions back in a dashboard, and uses the Claude API to summarize each session
and flag likely bugs.

> 🚧 **Work in progress.** Recording, rage-click detection, and a dashboard to watch visits
> back are working. AI summaries come next.

## How it works (planned)

```
Website with recorder snippet (rrweb)
        │  sends recorded events
        ▼
FastAPI (Python) ──► Postgres (session info)
        │        └─► AWS S3 (raw event recordings)
        ▼
Redis + Celery job queue ──► Claude API (summaries + bug detection)
        │
        ▼
React dashboard (list, replay, and read AI summaries)
```

## Tech stack

| Area     | Tools                                                  |
| -------- | ------------------------------------------------------ |
| Backend  | Python, FastAPI, Pydantic                              |
| Data     | Postgres + SQLAlchemy + Alembic, AWS S3                |
| Jobs     | Redis + Celery                                         |
| AI       | Claude API, evals in Python                            |
| Frontend | TypeScript, React, Vite, Tailwind CSS                  |
| Tooling  | Docker, GitHub Actions, pytest, Ruff, ESLint, Prettier |

## Project structure

This is a monorepo: one repo holding the Python API and the JavaScript apps
(npm workspaces).

```
apps/
  api-py/       FastAPI server (Python)
  dashboard/    React dashboard
  demo-site/    Fake shop used to test recording
packages/
  recorder/     rrweb snippet that websites install
  shared/       Types shared by frontend and backend
```

## Getting started

**You need:** [Python](https://www.python.org) 3.12, [Node.js](https://nodejs.org) 22 or newer,
and [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
git clone https://github.com/Vd421/letsgo.git
cd letsgo
npm install                 # install packages for all workspaces
cp .env.example .env        # create your local settings file, then fill in real values
npm run services:up         # start local Postgres + Redis in Docker
```

When you're done: `npm run services:down` (your data is kept).

## Python API

Run these from `apps/api-py` (Git Bash on Windows shown; on Mac/Linux use `bin` instead of `Scripts`):

```bash
cd apps/api-py
py -3.12 -m venv .venv               # once: create the virtual environment
source .venv/Scripts/activate        # every new terminal: switch it on
pip install -r requirements-dev.txt  # install packages
alembic upgrade head                 # create/update the database tables
python -m app.main                   # start the API on http://localhost:4000 (restarts on save)
```

Open http://localhost:4000/docs for interactive API docs (FastAPI makes them for you).

| Command                                     | What it does                                       |
| ------------------------------------------- | -------------------------------------------------- |
| `pytest`                                    | Run the tests (uses a separate `replay_test` DB)   |
| `ruff check .`                              | Find likely bugs                                   |
| `ruff format .`                             | Auto-format Python code                            |
| `alembic revision --autogenerate -m "msg"`  | After changing `app/models.py`: write a migration  |
| `alembic upgrade head`                      | Apply migrations to the database                   |

## Scripts

Run from the repo root:

| Command                 | What it does                                |
| ----------------------- | ------------------------------------------- |
| `npm run services:up`   | Start local Postgres (5432) + Redis (6379)  |
| `npm run services:down` | Stop them (data is kept)                    |
| `npm run lint`          | Find likely bugs with ESLint                |
| `npm run format`        | Auto-format code with Prettier              |
| `npm run format:check`  | Check formatting without changing files     |
| `npm run typecheck`     | TypeScript check for every app              |
| `npm test`              | Dashboard tests (Vitest)                    |
| `npm run shop`          | Start the demo shop on http://localhost:5173 |
| `npm run dashboard`     | Start the dashboard on http://localhost:5174 |

## Try it

With the services and the Python API running:

1. `npm run shop` and open http://localhost:5173. Click around: every 5 seconds the recorder
   sends what you did to the API. The shop has one bug on purpose: checkout silently does
   nothing when the total is over $100. Try it and press Checkout a few times.
2. `npm run dashboard` and open http://localhost:5174:
   - **Overview**: visit counts, rage-click rate, busy times, events per visit.
   - **Sessions**: every visit, with rage clicks marked in orange.
   - **Replay**: click a visit to watch it again, with a timeline and a list of what happened.

**Rage click** = 3+ clicks on the same spot within 2 seconds where the page didn't react
(see `apps/api-py/app/analysis.py`).

Every push to `main` and every Pull Request runs these checks in GitHub Actions:
`lint` + `format:check` + `typecheck` + Vitest for TypeScript, and Ruff + migrations + pytest for the Python API.
