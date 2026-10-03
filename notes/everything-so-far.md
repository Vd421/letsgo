# Everything So Far: the full story of Replay (26 Sep – 3 Oct 2026)

Every phase, every step, every commit, in plain English. Read it top to bottom once, then use
it as a reference. The glossary near the end explains every technical word.

---

## Contents

1. [What we're building](#1-what-were-building)
2. [The timeline at a glance](#2-the-timeline-at-a-glance)
3. [Before Phase 0: first experiments](#3-before-phase-0-first-experiments-26-27-sep)
4. [Phase 0: setting up the workshop](#4-phase-0-setting-up-the-workshop-28-29-sep)
5. [Phase 1: the first API, in TypeScript](#5-phase-1-the-first-api-in-typescript-29-30-sep)
6. [Phase 1b: switching the API to Python](#6-phase-1b-switching-the-api-to-python-3-oct)
7. [Setting up a second laptop](#7-setting-up-a-second-laptop-3-oct)
8. [Finishing the Python switch (PR #4)](#8-finishing-the-python-switch-pr-4)
9. [Phase 2: the recorder and the demo shop (PR #5)](#9-phase-2-the-recorder-and-the-demo-shop-pr-5)
10. [The 10-shopper test](#10-the-10-shopper-test)
11. [How everything connects now](#11-how-everything-connects-now)
12. [Problems we hit, and how we fixed them](#12-problems-we-hit-and-how-we-fixed-them)
13. [Glossary](#13-glossary)
14. [Commands cheat sheet](#14-commands-cheat-sheet)
15. [What's next](#15-whats-next)
16. [Check yourself](#16-check-yourself)

---

## 1. What we're building

**Replay** is a *session replay* tool with AI bug detection.

- A website installs a small piece of code, the **recorder**.
- The recorder notes down everything a visitor does: clicks, scrolls, typing, page changes.
- Those notes are sent to our **API** (our server), which saves them in a **database**.
- Later, a **dashboard** will let you watch any visit back like a video.
- Finally, **Claude (AI)** will read each visit and point out likely bugs, for example
  "the visitor pressed Checkout 5 times and nothing happened".

Companies like Hotjar, FullStory and PostHog sell tools like this. Building one teaches the
whole of full-stack development: browser code, servers, databases, background jobs, AI, and
deployment.

---

## 2. The timeline at a glance

| Date        | Phase                              | Result                                            | Merged as |
| ----------- | ---------------------------------- | ------------------------------------------------- | --------- |
| 26–27 Sep   | First experiments                  | Learned git basics with a `hello.txt` file        | –         |
| 28–29 Sep   | **Phase 0**: project setup          | Tools, folders, Docker, CI, README                | PR #2, #3 |
| 29–30 Sep   | **Phase 1**: API in TypeScript      | Express server, database, `/sessions` routes      | never merged |
| 3 Oct       | **Phase 1b**: API in Python         | Rebuilt the API with FastAPI, plus 9 tests        | PR #4     |
| 3 Oct       | **Phase 2**: recorder + demo shop   | Real visits recorded and saved; 17 tests          | PR #5     |
| 4 Oct       | **Phase 3**: dashboard             | Design approved; Overview, Sessions, real Replay; rage detection; 60 tests | PR #6, #7, #8 |
| next        | Phase 4 or 5                        | Cloud storage, or Claude explaining each visit    | –         |

The project lives at https://github.com/Vd421/letsgo. The official version is the `main` branch.

---

## 3. Before Phase 0: first experiments (26–27 Sep)

| Commit    | Date          | Message        | What happened                                    |
| --------- | ------------- | -------------- | ------------------------------------------------ |
| `25ea839` | 26 Sep 15:36  | first commit   | The very first snapshot: a test file `hello.txt` |
| `aa7861f` | 27 Sep 23:38  | edited hello   | Changed the file and saved a second snapshot     |

**What you learned:** a **commit** is a saved snapshot of the project. Each commit remembers
the one before it, so git can always go back in time. That's why `hello.txt` can still be seen
today with `git show aa7861f:hello.txt`, even though the file was deleted later.

---

## 4. Phase 0: setting up the workshop (28–29 Sep)

**Goal:** prepare every tool and folder *before* writing any app code, like setting up a
kitchen before cooking.

### The commits

| Commit    | Date         | Message                                                       |
| --------- | ------------ | ------------------------------------------------------------- |
| `e156aad` | 28 Sep 03:46 | add CLAUDE.md, remove hello.txt                               |
| `55a142c` | 28 Sep 03:50 | Initial commit *(made by GitHub when the repo was created)*   |
| `0cd66cf` | 28 Sep 03:51 | Merge remote-tracking branch 'origin/main'                    |
| `91bef0f` | 28 Sep 04:06 | add gitignore and gitattributes, remove readme                |
| `51176c7` | 28 Sep 04:15 | set up workspaces, typescript, eslint, prettier, env example  |
| `8071d70` | 29 Sep 00:36 | add docker compose for postgres and redis                     |
| `d741080` | 29 Sep 01:17 | add github actions ci                                         |
| `0e861dc` | 29 Sep 01:47 | **Merge pull request #2** (setup/ci)                          |
| `9075c41` | 29 Sep 01:52 | add readme, finish phase 0                                    |
| `eead6c3` | 29 Sep 01:53 | **Merge pull request #3** (setup/readme)                      |

### Step by step

**1. `CLAUDE.md`** (`e156aad`)
A file Claude reads at the start of every session. Claude forgets everything between chats, so
this file is its memory: what the project is, the tech stack, the commands, the current phase,
and your rules ("explain things simply", "never commit without asking", and so on).

**2. Connecting to GitHub** (`55a142c`, `0cd66cf`)
GitHub created the repo with its own first commit (a README), while your laptop had different
commits. The two histories didn't match, so we **merged** them, which kept everything from
both sides. Then we **pushed** (uploaded) to GitHub. `origin` is git's nickname for the GitHub copy.

**3. `.gitignore` and `.gitattributes`** (`91bef0f`)
- `.gitignore` lists files git must never save: `node_modules/` (downloaded packages, which are
  huge and can be re-downloaded), `.env` (secrets), `dist/` (build output), and `*.log`.
- `.gitattributes` makes every file use **LF** line endings. Windows normally uses CRLF, and the
  mix causes noisy warnings and fake "changes".

**4. Workspaces, TypeScript, ESLint, Prettier, `.env.example`** (`51176c7`)
- **npm workspaces** turn the repo into a **monorepo**: one repo holding several apps
  (`apps/api`, `apps/dashboard`, `apps/demo-site`, `packages/recorder`, `packages/shared`).
  One `npm install` at the top installs everything.
- **TypeScript**, with shared rules in `tsconfig.base.json` (strict mode on). We pinned version
  **6.0**, because the ESLint plugin didn't support TypeScript 7 yet.
- **ESLint** finds likely bugs, and **Prettier** formats code neatly.
- **`.env.example`** lists the settings the app needs, with no real values. Your real values go
  in `.env`, which never goes to GitHub.

**5. Docker Compose** (`8071d70`)
`docker-compose.yml` runs **Postgres 17** (the database, port 5432) and **Redis 8** (fast
memory storage for job queues later, port 6379) inside Docker on your laptop. One command
starts both: `npm run services:up`. Your data lives in **volumes**, so it survives restarts.

**6. CI with GitHub Actions** (`d741080`, merged as **PR #2**)
`.github/workflows/ci.yml` tells GitHub: on every push to `main` and every Pull Request, borrow
a fresh computer, install everything, and run `lint` and `format:check`. You opened and merged
your **first Pull Request**.

**7. README** (`9075c41`, merged as **PR #3**)
The project's front page on GitHub: what it is, the planned design, the tech stack, and how to
run it, plus a green "CI passing" badge. Phase 0 was complete.

---

## 5. Phase 1: the first API, in TypeScript (29–30 Sep)

**Goal:** a server that can store and list sessions. All of this was on the branch
`feature/api`. **It was never merged**, because we rebuilt it in Python instead (section 6).
Everything you learned here carried straight over.

### The commits

| Commit    | Date         | Message                       |
| --------- | ------------ | ----------------------------- |
| `2110d86` | 29 Sep 02:19 | add express api server        |
| `6cc7874` | 29 Sep 02:30 | add health route              |
| `4e4dd79` | 29 Sep 04:36 | load settings from env        |
| `7867a4e` | 30 Sep 01:23 | add learning notes            |
| `a2b1f86` | 30 Sep 01:44 | add prisma and session table  |
| `3735543` | 30 Sep 03:38 | add sessions routes with zod  |
| `240cfaf` | 30 Sep 03:38 | add day 3 notes               |

### Step by step

1. **Express server** (`2110d86`): a program that waits for requests on port 4000 and answers them.
2. **`GET /health`** (`6cc7874`): the simplest route. It answers `{"status":"ok"}`, which means
   "I'm alive". Real services use a route like this so monitoring tools can check on them.
3. **Settings from `.env`** (`4e4dd79`): `config.ts` read `PORT` and `DATABASE_URL`. A bad value
   (like `PORT=banana`) stopped the server immediately with a clear error. This is called
   **failing fast**: it's better to crash at startup than to run half-broken.
4. **Learning notes** (`7867a4e`, `240cfaf`): the `notes/` folder with your daily notes.
5. **Prisma + the `Session` table** (`a2b1f86`): Prisma let TypeScript talk to Postgres. The
   **schema** described the table, and a **migration** built it. You wrote the
   `eventCount` column yourself.
6. **`POST /sessions` and `GET /sessions` with Zod** (`3735543`): POST saves a new session,
   and GET lists them. **Zod** checked incoming data first: `url` had to be a real web address.
   Bad data got a `400` error that said which field was wrong.

---

## 6. Phase 1b: switching the API to Python (3 Oct)

**Why switch?** You wanted a Python backend, because Python is in high demand for jobs and is
the main language for AI work. Only the **backend** moved. Browsers can only run JavaScript, so
the recorder, shop and dashboard stay in TypeScript.

### The commits (branch `feature/python-api`)

| Commit    | Date         | Message                      |
| --------- | ------------ | ---------------------------- |
| `94cf0a6` | 3 Oct 20:57  | add python fastapi api       |
| `be7bf8d` | 3 Oct 20:57  | add big picture notes        |
| `c1c9c6b` | 3 Oct 21:10  | add python switch todo list  |

### What each tool was replaced with

| Job                      | TypeScript version | Python version  |
| ------------------------ | ------------------ | --------------- |
| Web framework            | Express            | **FastAPI**     |
| Runs the server          | Node (`tsx`)       | **uvicorn**     |
| Checks incoming data     | Zod                | **Pydantic**    |
| Talks to the database    | Prisma             | **SQLAlchemy**  |
| Database migrations      | `prisma migrate`   | **Alembic**     |
| Tests                    | (never written)    | **pytest**      |
| Lint + format            | ESLint + Prettier  | **Ruff**        |
| Package list             | `package.json`     | `requirements.txt` |
| Private package folder   | `node_modules/`    | `.venv/` (virtual environment) |
| Background jobs (later)  | BullMQ             | **Celery**      |
| File storage (later)     | Cloudflare R2      | **AWS S3**      |

### The files in `apps/api-py/`

| File                  | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `app/main.py`         | Starts the app and plugs in the routes. Free docs page at `/docs`.    |
| `app/config.py`       | Reads settings from `.env`; refuses to start without `DATABASE_URL`.  |
| `app/db.py`           | The shared database connection. `get_db` gives each request its own.  |
| `app/models.py`       | Database tables, written as Python classes.                           |
| `app/schemas.py`      | The "bouncer": the shape of data allowed in and out.                  |
| `app/routes/sessions.py` | The `/sessions` routes.                                            |
| `tests/`              | Automatic tests. They use a separate `replay_test` database.          |
| `alembic/`, `alembic.ini` | Migration setup.                                                  |
| `requirements*.txt`   | Exact package versions.                                               |
| `pyproject.toml`      | Settings for Ruff and pytest.                                         |

### Things that changed in behaviour

- Bad data now gets **422** instead of 400. That's FastAPI's standard code for "I understood
  the request, but the data breaks the rules".
- `GET /sessions` now lists the **newest first**.
- The JSON still uses camelCase (`userAgent`), so from outside the API looks the same as before.
- The table is now called `sessions`, and the Python class is `ReplaySession`, so it isn't
  confused with SQLAlchemy's own database "Session".

---

## 7. Setting up a second laptop (3 Oct)

None of this created commits, but it's real work you'll repeat on every new computer.

| Problem                                                    | Cause                                               | Fix                                                        |
| ---------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Docker: "virtualisation support wasn't detected"           | **WSL** (Windows Subsystem for Linux) wasn't installed. The CPU setting was already on. | `wsl --install` as administrator, then restart              |
| A plain `git pull` brought nothing new                     | The new work was on a **different branch**          | `git fetch --all`, then `git switch feature/...`           |
| Python 3.14 installed, but the project uses 3.12           | The website's default download is the newest version | `py install 3.12`. Both versions can live side by side.   |
| `node` / `npm` not found                                   | Node wasn't installed                               | `winget install OpenJS.NodeJS.LTS`                         |
| `fatal: not a git repository`                              | The terminal was one folder too high                | `cd letsgo` first                                          |
| `git push`: "Invalid username or token"                    | This laptop wasn't signed in to GitHub              | Ran `git push` yourself, then signed in through the browser pop-up |

**Lesson:** match your local versions to CI's (Python 3.12 here). Otherwise something can work
on your laptop and fail on GitHub, or the other way round.

**The virtual environment (`.venv`)** is a private folder of Python packages just for this
project, so different projects don't fight over package versions. Switch it on in each new
terminal with `source .venv/Scripts/activate`, and you'll see `(.venv)` at the start of the line.

---

## 8. Finishing the Python switch (PR #4)

| Commit    | Date        | Message                          |
| --------- | ----------- | -------------------------------- |
| `325e191` | 3 Oct 21:32 | add sessions table migration     |
| `629a1ec` | 3 Oct 21:32 | remove old express api           |
| `9d90956` | 3 Oct 21:49 | **Merge pull request #4**        |

### The hidden gap: there was no migration

The Python code *described* the `sessions` table, but nothing had *built* it in the real
database. CI was still green. Why? The tests build their own tables straight from
`models.py` and skip the migrations. **Lesson: a green CI only proves what the tests actually
check.**

### What we did

1. **Wrote the first Alembic migration.** `alembic revision --autogenerate` compares
   `models.py` with the real database and writes the difference down as a migration file.
   We **read the file before applying it**, because autogenerate can get things wrong.
2. **Applied it** with `alembic upgrade head`. Then we tested the **undo** (`downgrade base`)
   and **redo** (`upgrade head`), so we know both directions work.
3. **Tried it for real**: started the server, saved a session, and listed it. Bad data got 422.
4. **Deleted the old TypeScript API** (`git rm -r apps/api`). `npm install` then removed **229
   packages**, and the npm security warnings dropped to **0**, because they had all come from Prisma.
5. **Committed, pushed, opened PR #4.** Both CI jobs went green, and you merged it.

---

## 9. Phase 2: the recorder and the demo shop (PR #5)

**Goal:** record real visits to a real web page and save them through the API.

| Commit    | Date        | Message                       |
| --------- | ----------- | ----------------------------- |
| `494945b` | 3 Oct 22:14 | add session events api        |
| `f9ce3cf` | 3 Oct 22:14 | add recorder and demo shop    |
| `76e7212` | 3 Oct 22:14 | run typecheck in ci           |
| `e3bee32` | 3 Oct 22:18 | **Merge pull request #5**     |

### Step 1: the `session_events` table

Each row is **one batch** of recorded events (a few seconds' worth), linked to its session.

- **Why a separate table?** One visit can produce hundreds of batches. Squeezing them all into
  one row of `sessions` would make that row huge and slow. Instead: one session, many batches.
  This is called a **one-to-many** relationship.
- **`session_id` is a foreign key**: it must match a real `sessions.id`, or Postgres refuses it.
- **`ondelete="CASCADE"`**: delete a session and its batches are deleted with it, so nothing is
  left behind.
- **An index on `session_id`** makes "find every batch for this session" fast, like the index
  at the back of a book.
- **`events` uses JSONB**, Postgres's type for storing JSON. rrweb events are already JSON.
- Migration: `8ed99e459428_create_session_events_table.py`.
- A side fix in the tests: emptying `sessions` now needs `TRUNCATE sessions CASCADE`, because
  another table points at it.

### Step 2: two new routes

| Route                            | What it does                                                         |
| -------------------------------- | -------------------------------------------------------------------- |
| `POST /sessions/{id}/events`     | Saves one batch and adds to `eventCount`. Replies `{"received": 2, "eventCount": 2}`. |
| `GET /sessions/{id}/events`      | Returns every event of a session, oldest first, as one list.         |

The rules:
- An unknown session ID gets **404** ("no such session").
- A batch must contain between **1 and 1000** events. Anything else gets 422.
- The count is added up **inside Postgres** (`event_count + 10`), so two batches arriving at
  the same moment can't overwrite each other's total.

There are 6 new tests in `tests/test_events.py`.

### Step 3: CORS (the permission slip)

The shop runs at `localhost:5173` and the API at `localhost:4000`. To a browser, those are two
different **origins**, and by default a page from one origin can't read answers from another.
This browser rule protects people: it stops a random website from reading your data off other
sites. The API now says "requests from `http://localhost:5173` are allowed". The setting is
`cors_origins` in `config.py`. There are 2 tests: the shop is allowed, and a stranger site is not.

### Step 4: the demo shop (`apps/demo-site`)

- Built with **Vite**, a tool that serves a website on your laptop and reloads it as you save.
- It has 3 products (☕ mug $12, 👕 T-shirt $25, 🎧 headphones $89), a cart, an email box,
  and a checkout button.
- **It has one bug on purpose:** if the total is **over $100**, checkout silently does nothing.
  There's no error and no success message. Real users react by pressing the button again and
  again ("rage clicks"). In Phase 5, the AI will learn to spot this.
- Its port is fixed at 5173 (`--strictPort`), because that's the address the API's CORS allows.

### Step 5: the recorder (`packages/recorder`)

`startRecording({ apiUrl })` does four things:
1. **Starts a session**: `POST /sessions` with the page address and the browser info, and gets an ID back.
2. **Records with rrweb**: every change on the page becomes an event in a pile (the buffer).
3. **Sends batches**: every **5 seconds** it mails the pile to `POST /sessions/{id}/events`,
   then starts an empty pile. Sending in groups instead of one event at a time means far fewer
   requests.
4. **Sends a last batch when the visitor leaves** (`pagehide`), using `keepalive`, so the
   request survives the tab closing.

**Privacy:** `maskAllInputs: true` records *that* someone typed, but saves `*****` instead of
what they typed. Emails and passwords never leave the visitor's browser.

### Step 6: checks

- 17 Python tests (9 old + 8 new), plus Ruff, ESLint, Prettier, and the new **TypeScript check**
  (`npm run typecheck`), which CI now runs too.
- An **end-to-end test**: a hidden Edge browser opened the shop, and the API received the
  session plus its first 2 events.
- Your own visit was recorded: 95 seconds, 31 clicks, 25 typing events, all hidden as `*`.

---

## 10. The 10-shopper test

A tool called **Playwright** drove 10 browsers at once, each shopping differently.

| # | Shopper                              | Total       | Checkout presses | Shop showed       | Result             |
| - | ------------------------------------ | ----------- | ---------------- | ----------------- | ------------------ |
| 1 | Mug only                             | $12         | 1                | ✅ Order placed   | Works              |
| 2 | T-shirt only                         | $25         | 1                | ✅ Order placed   | Works              |
| 3 | Mug + T-shirt                        | $37         | 1                | ✅ Order placed   | Works              |
| 4 | Headphones only                      | $89         | 1                | ✅ Order placed   | Works              |
| 5 | 4 T-shirts                           | **$100**    | 1                | ✅ Order placed   | Works              |
| 6 | Empty cart                           | $0          | 1                | "cart is empty"   | Works              |
| 7 | Headphones + mug                     | **$101**    | 5                | nothing           | 🐛 Bug             |
| 8 | Headphones + 3 T-shirts              | $164        | 5                | nothing           | 🐛 Bug             |
| 9 | 4 mugs + 3 T-shirts                  | $123        | 5                | nothing           | 🐛 Bug             |
| 10 | $101, removes the mug, tries again  | $101 → $89  | 6                | ✅ Order placed   | 🐛 Bug, then works |

**What it proved:**
- The bug triggers exactly **above** $100. Shopper #5 ($100) worked, and #7 ($101) failed.
  Testing right at an edge like this is called a **boundary test**.
- The recorder caught **every click**. For example, #9: 7 adds + 5 checkouts = 12 clicks recorded.
- All 10 emails were saved as `*****`.
- Broken visits leave **more events** (38–58) than happy ones (11–30). That's the footprint the
  AI will look for.

---

## 11. How everything connects now

```
🛒 Demo shop (localhost:5173, TypeScript + Vite)
     │  the visitor clicks, scrolls, types
     ▼
📹 Recorder (rrweb), inside the shop page
     │  1. POST /sessions                 → gets a session ID
     │  2. every 5s: POST /sessions/{id}/events  (a batch of events)
     ▼          ↑ the browser allows this because of CORS
🐍 Python API (localhost:4000, FastAPI)
     │  Pydantic checks the data → 422 if it's bad, 404 if the session is unknown
     │  SQLAlchemy turns Python into SQL
     ▼
🗄️ Postgres (in Docker, port 5432)
     sessions        one row per visit (url, browser, start time, eventCount)
     session_events  one row per batch, linked to its session
```

**How one change travels from your keyboard to `main`:**

```
write code → Ruff / ESLint / Prettier / TypeScript / pytest on your laptop
  → git commit (a snapshot on your branch)
  → git push (upload the branch)
  → Pull Request (ask to merge into main)
  → CI runs every check on a fresh computer: ✅ or ❌
  → a human clicks Merge
  → git pull on main (bring the merged version back to your laptop)
```

---

## 12. Problems we hit, and how we fixed them

| Problem                                         | Lesson                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| TypeScript 7 broke ESLint                       | New major versions can break other tools. **Pin** versions that work.    |
| Prisma's "latest" was an unfinished 8.0 release | "latest" isn't always stable. We picked 7.10.                            |
| CI was green, but there was no migration         | Tests only prove what they actually test.                               |
| Ruff flagged my import order and a long line    | Linters catch small slips before they reach GitHub.                      |
| `npm run shop -- --port 5173` started Vite in a folder called "5173" | Extra settings passed through npm can land in the wrong place. We put the port inside the `dev` script instead. |
| A "Merge" by Claude was blocked                 | Merging into `main` stays a human decision. Claude opens PRs; you click Merge. |

---

## 13. Glossary

**Git and GitHub**
- **Repository (repo):** the project folder plus its full history.
- **Commit:** a saved snapshot. Permanent, and it points to the commit before it.
- **Branch:** a movable bookmark pointing to a commit. A separate line of work, so `main` stays safe.
- **`main`:** the official branch. Only finished, checked work goes in.
- **Push / pull:** upload to GitHub / download from GitHub.
- **Fetch:** download information about new commits and branches without changing your files.
- **Merge:** join two lines of work. A **fast-forward** just slides the bookmark forward.
- **Pull Request (PR):** a GitHub page asking to merge a branch into `main`, with a list of every
  change and the CI results.
- **CI (Continuous Integration):** a robot that runs every check on a fresh computer for each push and PR.

**Servers and APIs**
- **Server:** a program that waits for requests and answers them.
- **API:** the set of addresses (routes) a server answers, and what it expects at each one.
- **Route:** an address + a method + the code that runs, e.g. `GET /health`.
- **GET / POST:** "give me something" / "here is something new, save it".
- **Status codes:** `200` OK · `201` Created · `400`/`422` bad data · `404` not found · `500` server crashed.
- **JSON:** the text format servers and browsers use to send data, e.g. `{"status":"ok"}`.
- **Port:** a numbered door on a computer. API = 4000, shop = 5173, Postgres = 5432, Redis = 6379.
- **CORS:** a browser rule. A page may only read answers from another origin if that origin allows it.
- **Validation:** checking incoming data against rules before using it (Pydantic, and before that Zod).

**Databases**
- **Database / table / row / column:** a filing cabinet / one drawer / one folder / one label every folder has.
- **SQL:** the database's own language.
- **ORM (SQLAlchemy):** a translator that lets you use Python instead of SQL.
- **Model:** a Python class describing a table.
- **Migration:** a saved, ordered instruction for changing the database's structure. Like git
  commits, but for tables.
- **Primary key:** each row's unique ID.
- **Foreign key:** a column that must match another table's primary key. It links the tables.
- **CASCADE:** when the parent row is deleted, its linked rows are deleted too.
- **Index:** a lookup shortcut that makes searching by a column fast.
- **JSONB:** a Postgres column type for storing JSON.

**Tools**
- **Docker:** runs programs in sealed boxes (**containers**) built from recipes (**images**).
- **Volume:** storage outside a container, so data survives restarts.
- **WSL:** Windows Subsystem for Linux. Docker uses it on Windows.
- **Virtual environment (`.venv`):** a private folder of Python packages for one project.
- **pip / npm:** download packages for Python / for JavaScript.
- **Pinning:** using an exact version (`fastapi==0.142.2`) so every machine gets the same code.
- **Linter (Ruff, ESLint):** spots likely bugs. **Formatter (Ruff format, Prettier):** tidies layout.
- **Type check (TypeScript):** checks that values are the kind you said they'd be.
- **Test (pytest):** code that runs your code and checks the answers automatically.
- **Fixture:** shared test setup, e.g. a test client connected to an empty test database.
- **End-to-end test:** testing the whole chain at once, from the browser through the API to the database.
- **Boundary test:** testing right at the edge of a rule ($100 vs $101).

**Replay-specific**
- **Session:** one visit to a website.
- **Event:** one recorded change on the page (click, scroll, typing, a page change).
- **Batch:** a group of events sent together every 5 seconds.
- **rrweb:** the open-source library that records and replays web pages.
- **Masking:** replacing typed text with `*` for privacy.
- **Rage clicks:** clicking the same thing again and again because nothing happens. A classic bug signal.

---

## 14. Commands cheat sheet

**Every time you start work** (Git Bash, from `letsgo/`):

```bash
git switch main && git pull          # get the latest official version
npm run services:up                  # start Postgres + Redis (Docker Desktop must be running)
cd apps/api-py
source .venv/Scripts/activate        # switch on the Python environment
alembic upgrade head                 # bring the database up to date
python -m app.main                   # API on http://localhost:4000  (docs: /docs)
```

In a **second terminal**, from `letsgo/`:

```bash
npm run shop                         # demo shop on http://localhost:5173
```

**Checks** (run them before every commit):

```bash
npm run lint && npm run format:check && npm run typecheck     # from letsgo/
ruff check . && ruff format --check . && pytest              # from apps/api-py, venv on
```

**Database:**

```bash
alembic revision --autogenerate -m "describe the change"   # after editing app/models.py
alembic upgrade head                                       # apply migrations
alembic downgrade -1                                       # undo the last one
```

**Git, for a new feature:**

```bash
git switch -c feature/my-thing       # new branch
git add <files> && git commit -m "short message"
git push -u origin feature/my-thing  # then open a PR on GitHub
```

**When you're done:** `npm run services:down` (your data is kept).

---

## 15. What's next

**Phase 3: the dashboard and the replay player.** It's a React app in `apps/dashboard` that
lists all sessions and plays any of them back like a video, using rrweb's player and
`GET /sessions/{id}/events`. **Done on 4 Oct** (PRs #6, #7, #8). The full story is in
`notes/2026-10-04.md`, and the approved design is in `docs/design/dashboard-mockup.html`.

After that:
- **Phase 4:** move event storage from Postgres to AWS S3 (cheaper for large amounts of data).
- **Phase 5:** Celery background jobs send each session to Claude to summarize it and flag bugs.
- **Phase 6:** deploy to AWS, plus Python **evals** that measure how good the AI's answers are.

---

## 16. Check yourself

Try answering before you look at the answers.

1. What's the difference between a commit and a branch?
2. Why does `.env` never go to GitHub, while `.env.example` does?
3. CI was green even though no migration existed. Why?
4. Why are events stored in a separate table, instead of inside the `sessions` row?
5. What happens if the recorder sends a batch for a session ID that doesn't exist?
6. Why does the shop need CORS permission to talk to the API?
7. Why does the recorder send batches every 5 seconds instead of each event at once?
8. Why was shopper #5 ($100) such an important test?
9. What does `maskAllInputs` protect?
10. Why can't Claude merge into `main` by itself?

<details>
<summary>Answers</summary>

1. A commit is a permanent snapshot. A branch is just a movable bookmark pointing at a commit.
2. `.env` holds real secrets (passwords, API keys). `.env.example` only lists the setting names,
   so other people know what to fill in.
3. The tests build their own tables directly from `models.py` and never run the migrations, so
   nothing in CI noticed they were missing.
4. One session can have hundreds of batches. Keeping them in their own table (one-to-many)
   keeps each row small and fast to work with.
5. The API replies **404** and saves nothing. The foreign key would also stop it at the database level.
6. The shop (port 5173) and the API (port 4000) are different origins. Browsers block reading
   answers across origins unless the server allows it.
7. Far fewer requests. One request per 5 seconds instead of dozens per second.
8. It tests the exact edge of the rule. It proves the bug starts *above* $100, not *at* $100.
9. Everything typed into inputs (emails, passwords, card numbers). Only `*` is recorded.
10. `main` is the official version. A human should approve what goes in, so a safety rule
    blocks automatic merges.

</details>
