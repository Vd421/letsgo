# The Big Picture: every tool in Replay, and how they connect

Three parts:
1. One analogy that holds everything together 🍽️
2. Each tool: what it is, why we need it, where it lives in the project
3. How they connect: one request, and one code change

---

## Part 1: The big analogy, a restaurant 🍽️

Replay is a **restaurant**. Customers (websites, the dashboard) send in orders. The kitchen prepares them,
and ingredients are kept in the storeroom.

| Restaurant                                   | Tool             | Job                                          |
| -------------------------------------------- | ---------------- | -------------------------------------------- |
| The building + electricity                   | **Node**         | Makes it possible to run anything at all     |
| The head waiter taking orders                | **Express**      | Receives requests, sends answers             |
| The menu                                     | **Routes**       | The list of things you can order             |
| The order checker                            | **Zod**          | Rejects orders that make no sense            |
| The runner to the storeroom                  | **Prisma**       | Fetches and stores things for the kitchen    |
| The storeroom                                | **Postgres**     | Where everything is kept permanently         |
| The ticket rail of pending orders            | **Redis**        | Fast to-do list for background jobs          |
| The storeroom renovation plans               | **Migrations**   | Saved instructions for changing the shelves  |
| The locked safe with keys and addresses      | **.env**         | Secret settings, never shown to anyone       |
| The rules for writing recipes clearly        | **TypeScript**   | Catches mistakes before cooking              |
| The supplier who delivers equipment          | **npm**          | Downloads ready-made tools                   |
| The health inspector reading recipes         | **ESLint**       | Spots likely mistakes                        |
| The person who neatly retypes recipes        | **Prettier**     | Makes the code look tidy                     |
| A storeroom-in-a-box you can set up anywhere | **Docker**       | Runs Postgres + Redis on my laptop           |
| "Here's my recipe change, please review"     | **Pull Request** | Asks to add my changes to the main project   |
| An automatic inspector checking every change | **CI**           | Robot that runs the checks on GitHub         |

---

## Part 2: Each tool, in detail

- 🟢 **Group A, the running app:** what's working when someone uses Replay
- 🔵 **Group B, writing the code:** helpers while I write code
- 🟣 **Group C, teamwork and safety:** saving, sharing and checking work

### 🟢 GROUP A: The running app

#### Node.js: the engine
- **What:** JavaScript was made to run only inside web browsers. Node.js lets it run anywhere (laptop, cloud server).
- **Why:** our backend is written in JavaScript/TypeScript, and Node is what runs it.
- **In the project:** Node v24. Every `npm run dev` is Node running my code.
- 🧸 Node = the **electricity**. You never see it, but nothing works without it.

#### Express: the server framework
- **What:** a **server** is a program that waits for requests and sends back answers, all day.
  Express is a ready-made toolkit that makes writing one easy.
- **Why:** so I can write "when someone asks for `/health`, reply ok" instead of hundreds of lines of networking code.
- **In the project:** `apps/api/src/index.ts`. `express()` creates the server, and `app.listen(port)` starts it on port 4000.
- 🧸 Express = the **head waiter**: takes every order, passes it on, brings back the answer.

#### Routes: the menu
- **What:** a route = **address + verb + code that runs**. **GET** = "give me something". **POST** = "save this new thing".
- **Why:** every feature of the backend is a route. With no matching route, you get **404 Cannot GET**.
- **In the project:**

  | Route            | Does                                 |
  | ---------------- | ------------------------------------ |
  | `GET /`          | "Replay API is running"              |
  | `GET /health`    | "I'm alive": `{"status":"ok"}`       |
  | `POST /sessions` | Save a new session                   |
  | `GET /sessions`  | List all sessions                    |

  (in `apps/api/src/index.ts` and `apps/api/src/routes/sessions.ts`)
- 🧸 Routes = the **menu**. Not on the menu? "Sorry, we don't serve that" (404).

#### Zod: the bouncer
- **What:** checks data against **rules**, like "`url` must exist and be a real web address".
- **Why:** **anyone on the internet can send anything** (missing fields, garbage, attacks). Zod stops bad data at the door.
- **In the project:** `createSessionSchema` in `routes/sessions.ts`. Good data → **201 Created**.
  Bad data → **400** + a clear message, like `"field": "url", "Invalid URL"`.
- 🧸 Zod = the person who **checks each order makes sense**. "Pizza with no base? Rejected."

#### Postgres: the database
- **What:** a program that **stores data permanently and finds it fast**, in **tables**
  (rows = items, columns = fields each item has).
- **Why:** servers have **goldfish memory**. Restart one and it forgets everything. Postgres remembers forever.
- **In the project:** runs in Docker on port **5432**. One table, `Session`: `id`, `url`, `userAgent`,
  `startedAt`, `endedAt`, `eventCount` (my column!).
- 🧸 Postgres = the **storeroom** with labelled shelves.

#### Prisma: the translator
- **What:** Postgres speaks **SQL** (`SELECT * FROM "Session"`). Prisma lets me talk to it **in TypeScript**
  and translates.
- **Why:** I write `prisma.session.findMany()` instead of SQL, TypeScript knows every column
  (typos get a red underline), and one **schema** file describes all the tables.
- **In the project:** `apps/api/prisma/schema.prisma` (the blueprint), `apps/api/src/db.ts` (the one shared
  connection). Routes use `prisma.session.create(...)` and `prisma.session.findMany()`.
- 🧸 Prisma = the **runner** between the kitchen and the storeroom, who speaks both languages.

#### Migrations: renovation plans for the database
- **What:** each change to the blueprint → Prisma writes a **migration** (a small SQL file saying exactly
  what changed), applied **in order**.
- **Why:** every computer (my laptop, a teammate's, the live server) gets **identical tables**.
  No changing the database by hand.
- **In the project:** `apps/api/prisma/migrations/..._init/migration.sql` → `CREATE TABLE "Session" (...)`.
  Make a new one with `npm run db:migrate -w @replay/api`.
- 🧸 Migrations = **renovation plans**. Like **git commits, but for the database**.

#### Redis: the super-fast to-do list
- **What:** storage kept **in memory** (RAM), so it's extremely fast. Good for short-lived things.
- **Why (later, Phase 5):** AI analysis takes seconds. The server drops a job on a to-do list
  ("analyse session #42") and replies instantly, then a background worker picks up the job. Redis holds the list,
  using a tool called **BullMQ**.
- **In the project:** runs in Docker on port **6379**. **Not used yet.**
- 🧸 Redis = the **ticket rail** where pending orders hang.

#### `.env`: the locked safe of settings
- **What:** a text file of **settings** (environment variables): port, database address, later API keys.
- **Why:** **secrets never go in code** (code goes to GitHub, where keys can be stolen), and each computer
  can use different settings without code changes.
- **In the project:** `.env` = real values, **git-ignored**. `.env.example` = names only, goes to GitHub.
  `apps/api/src/config.ts` reads the settings and **fails fast** if one is wrong (`PORT=banana`).
- 🧸 `.env` = the **locked safe**. `.env.example` = a **list of what should be in the safe**, with no actual keys.

### 🔵 GROUP B: Writing the code

#### npm: the app store for code
- **What:** **N**ode **P**ackage **M**anager. It downloads **packages** (ready-made code: Express, Prisma, Zod)
  and runs **scripts** (`npm run dev`).
- **In the project:** `package.json` = the packages needed + scripts. `package-lock.json` = the **exact** versions.
  `node_modules/` = the downloads (git-ignored, recreated with `npm install`).
- 🧸 npm = the **supplier**, so you don't build your own oven.

#### TypeScript: JavaScript with safety rules
- **What:** JavaScript + **types** (labels for what kind of thing each value is). It checks code
  **before it runs** and underlines mistakes in red.
  ```ts
  const port: number = "banana"; // ❌ "banana" is not a number
  ```
- **In the project:** every `.ts` file. The rules are in `tsconfig.base.json`. Check with `npm run typecheck -w @replay/api`.
- 🧸 TypeScript = **rules for writing recipes clearly**, so mistakes get caught before cooking.

#### ESLint: the mistake-spotter
- **What:** flags code that's **probably a bug**, even if it's allowed (e.g. a variable never used).
- **In the project:** `eslint.config.mjs`. Run it with `npm run lint`.
- 🧸 ESLint = the **health inspector**: "you listed eggs but never used them. Mistake?"

#### Prettier: the neat-freak
- **What:** auto-formats code (spacing, quotes, line length). It changes how the code *looks*, not what it *does*.
- **In the project:** `.prettierrc.json`. `npm run format` fixes, `npm run format:check` only checks.
- 🧸 Prettier = **retypes every recipe in the same neat format**.

| Tool       | Catches                                   |
| ---------- | ----------------------------------------- |
| TypeScript | **Wrong types**: "that's text, not a number" |
| ESLint     | **Likely bugs**: "you never used this"    |
| Prettier   | **Messy formatting**: spaces, quotes      |

### 🟣 GROUP C: Teamwork and safety

#### Docker: a kitchen-in-a-box
- **What:** runs programs in **containers**, sealed boxes with everything they need.
  **Image** = the recipe for a box, **container** = a running box.
- **Why:** one command gives **identical** Postgres + Redis on any computer, and they can be wiped anytime.
- **In the project:** `docker-compose.yml`. `npm run services:up` / `npm run services:down`.
  **Volumes** keep the data safe outside the boxes, so it survives restarts.
- 🧸 Docker = a **storeroom-in-a-box**. Ship it anywhere, and it's exactly the same.

#### Pull Requests: "please review my changes"
- **Git basics:** a **commit** is a saved snapshot. A **branch** is a separate line of work, so `main` stays safe.
- **What:** a **PR** is a GitHub page saying "I did work on my branch. Please review it, and merge it into `main` if it's good".
- **Why:** `main` should always work. Every changed line can be reviewed, **CI runs automatically**,
  and there's a history of what changed and why.
- **In the project:** I merged **PR #2** (CI) and **PR #3** (README) myself. Current work is on `feature/api`.
- 🧸 PR = "here's my proposed recipe change, please **taste-test it** before adding it to the official book".

#### CI (Continuous Integration): the robot inspector
- **What:** on every push to `main` and every PR, **GitHub lends a fresh computer**. It installs everything,
  runs the checks (ESLint + Prettier), and shows ✅ or ❌.
- **Why:** people forget to run checks, and the robot never does. A clean computer catches "works on my laptop" problems.
  A ❌ warns you **before** broken code reaches `main`.
- **In the project:** `.github/workflows/ci.yml`. It's the green **"CI passing"** badge on the README.
- 🧸 CI = an **automatic inspector** checking every proposed change, every time.

---

## Part 3: How it all connects 🔗

### Journey 1: one request through the running app

```
📱 Website sends:  POST /sessions  { "url": "https://shop.test/cart" }
        │
        ▼
⚡ NODE is running our server code
        │
        ▼
🧑‍🍳 EXPRESS receives the request at port 4000 (the port comes from .env)
        │
        ▼
📋 ROUTE: Express finds the menu item → POST /sessions in routes/sessions.ts
        │
        ▼
🚪 ZOD checks the data. Is "url" a real web address?
        │   ❌ no  → reply 400 "Invalid URL"  (stops here)
        │   ✅ yes ↓
        ▼
🏃 PRISMA translates prisma.session.create(...) into SQL
        │   (connects using DATABASE_URL from .env)
        ▼
🗄️ POSTGRES (running inside DOCKER) saves the row in the Session table
        │   (the table exists because a MIGRATION built it)
        ▼
🏃 PRISMA brings back the saved session (with id, startedAt, eventCount 0)
        │
        ▼
🧑‍🍳 EXPRESS replies 201 Created + the saved session
        │
        ▼
📱 Website gets the answer ✅

(Later: the route will also drop a job on REDIS → "analyse this session with AI")
```

### Journey 2: one code change from my keyboard to `main`

```
⌨️  I write code in a .ts file
        │
        ├─ TYPESCRIPT underlines type mistakes in red (instantly, in VS Code)
        ├─ ESLINT flags likely bugs          (npm run lint)
        ├─ PRETTIER tidies the formatting    (npm run format)
        │
        ▼
📦 Need a new tool? NPM downloads it (npm install zod)
        │
        ▼
💾 git commit → saved snapshot on my branch
        │
        ▼
☁️  git push → my branch is now on GitHub
        │
        ▼
📬 PULL REQUEST: "please merge my branch into main"
        │
        ▼
🤖 CI robot: fresh computer → npm ci → lint → format:check
        │   ❌ → fix it, push again
        │   ✅ ↓
        ▼
✅ Merge → the change is now part of main
        │
        ▼
⬇️  git pull → my laptop's main is up to date
```

---

## One sentence each 📝

| Tool             | In one sentence                                                     |
| ---------------- | ------------------------------------------------------------------- |
| **Node**         | Runs JavaScript outside the browser                                 |
| **npm**          | Downloads ready-made code and runs my shortcuts                     |
| **TypeScript**   | JavaScript with labels that catch mistakes before running           |
| **ESLint**       | Spots code that's probably a bug                                    |
| **Prettier**     | Makes code look neat and consistent                                 |
| **Express**      | Toolkit for building the server                                     |
| **Routes**       | The server's menu: address + verb + code                            |
| **Zod**          | Checks incoming data and rejects bad stuff                          |
| **Prisma**       | Lets TypeScript talk to the database                                |
| **Postgres**     | The database that stores everything permanently                     |
| **Migrations**   | Saved, ordered instructions for changing the database               |
| **Redis**        | Super-fast to-do list for background jobs (used later)              |
| **`.env`**       | Settings and secrets, kept out of the code and out of GitHub        |
| **Docker**       | Runs Postgres + Redis in identical boxes on any computer            |
| **Pull Request** | Asking to merge my branch into `main`, with review                  |
| **CI**           | Robot that checks every push and PR automatically                   |

**Don't memorise all of this. Remember the two journeys in Part 3.** The rest comes with practice.
