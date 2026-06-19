# Geobiograph.io

A browser-based geography + history guessing game. You're shown the **birth and
death locations** of a historical figure on a world map and must guess who it is.
Every wrong guess reveals one more biographical clue — up to six — in the spirit
of GeoGuessr × Wordle × historical trivia.

> The full product spec lives in [CONTEXT.md](CONTEXT.md).

---

## Tech stack

| Layer        | Tech                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| **Frontend** | Vite · React · TypeScript · Zustand · React Router · TanStack Query · TailwindCSS v4 · MapLibre GL JS |
| **Backend**  | Node.js · Express · TypeScript (REST API)                                  |
| **Database** | MongoDB (figures, daily challenges, leaderboards, analytics)               |
| **Cache**    | Redis (game sessions, search suggestions, daily puzzle)                    |
| **Maps**     | Custom SVG Mercator renderer over a bundled world-countries GeoJSON — no WebGL or tile server, renders on any browser |
| **Data**     | Curated dataset enriched from the Wikipedia REST API                       |

MongoDB and Redis run locally via **Docker Compose**.

---

## Prerequisites

- [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io) 9+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for MongoDB + Redis)

---

## Quick start

From the repository root:

```bash
# 1. Start MongoDB + Redis (Docker)
docker compose up -d

# 2. Backend — install, seed the database, run the API
cd apps/backend
pnpm install
pnpm seed        # loads 24 figures + fetches portraits from Wikipedia
pnpm dev         # API on http://localhost:4000

# 3. Frontend — install and run (in a second terminal)
cd apps/frontend
pnpm install
pnpm dev         # app on http://localhost:5173
```

Open **http://localhost:5173** and play. The Vite dev server proxies `/api/*`
to the backend, so no CORS configuration is needed in development.

> `pnpm seed --no-wiki` seeds without contacting Wikipedia (offline mode);
> figures then fall back to initials instead of portraits.

---

## How the game works

- The map shows a **green marker (birth)** and **red marker (death)**. Place names
  are hidden until the game ends.
- Type a name and guess. Search supports **exact, partial, and fuzzy** matching
  (e.g. `Issac Newten` → Isaac Newton).
- Each **wrong guess** reveals the next clue:

  | Hint | Reveals |
  | ---- | ------- |
  | 1 | Lifespan — born, died, age |
  | 2 | Identity — ethnicity, nationality, gender |
  | 3 | Occupation — industry & roles |
  | 4 | Historical significance |
  | 5 | A unique characteristic |
  | 6 | Portrait (or initials fallback) |

- **Scoring**: start at `1000`, `−150` per wrong guess, `+500` bonus for a
  first-guess solve, minimum `0`. A loss scores `0`.
- **Daily Challenge** (`/daily`): everyone gets the same figure each UTC day.
- **Leaderboard** (`/leaderboard`): solved games can post a score.

---

## API

| Method | Endpoint                                   | Description                          |
| ------ | ------------------------------------------ | ------------------------------------ |
| GET    | `/api/health`                              | Service health + figure count        |
| GET    | `/api/game/random`                         | Start a random game                  |
| GET    | `/api/game/daily`                          | Start today's daily challenge        |
| GET    | `/api/game/:gameId`                        | Current game state                   |
| POST   | `/api/game/guess`                          | `{ gameId, guess }` → result + hint  |
| GET    | `/api/search?q=ein`                        | Fuzzy search suggestions             |
| GET    | `/api/leaderboard?mode=daily&date=…`       | Top scores                           |
| POST   | `/api/leaderboard`                         | `{ gameId, name }` → submit a score  |

The in-progress answer is never sent to the client; it is only revealed once a
game is over. Scores are validated server-side against the stored session.

---

## Project structure

```
.
├── docker-compose.yml          # MongoDB + Redis
├── CONTEXT.md                  # product spec
└── apps
    ├── backend                 # Express REST API (TypeScript)
    │   ├── src
    │   │   ├── config/         # env + game constants
    │   │   ├── db/             # mongo + redis clients
    │   │   ├── data/figures.ts # curated historical figures
    │   │   ├── services/       # game, search, daily, scoring, leaderboard
    │   │   ├── routes/         # express routers
    │   │   ├── utils/          # normalize, fuzzy, hints, score
    │   │   ├── seed.ts         # DB seeder (+ Wikipedia enrichment)
    │   │   ├── scripts/smoke.ts# end-to-end API smoke test
    │   │   └── index.ts        # server entrypoint
    │   └── .env.example
    └── frontend                # Vite + React app
        └── src
            ├── components/     # MapView, SearchBar, HintGrid, ResultScreen, …
            ├── pages/          # GamePage, LeaderboardPage
            ├── store/          # Zustand game store
            └── lib/            # api client, query client, helpers
```

---

## Useful scripts

**Backend** (`apps/backend`)

| Script             | Description                              |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | Run API with watch (tsx)                 |
| `pnpm start`       | Run API once                             |
| `pnpm seed`        | Seed MongoDB (with Wikipedia portraits)  |
| `pnpm typecheck`   | TypeScript check                         |
| `pnpm exec tsx src/scripts/smoke.ts` | End-to-end API smoke test |

**Frontend** (`apps/frontend`)

| Script         | Description                  |
| -------------- | ---------------------------- |
| `pnpm dev`     | Vite dev server (port 5173)  |
| `pnpm build`   | Type-check + production build |
| `pnpm preview` | Preview the production build |

---

## Configuration

Backend reads from `apps/backend/.env` (see `.env.example`):

```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
MONGO_URL=mongodb://localhost:27017
MONGO_DB=geobiograph
REDIS_URL=redis://localhost:6379
```

Frontend reads `VITE_API_URL` (defaults to `/api`, proxied in dev). For a
deployed frontend, set it to the full backend URL.

---

## Notes

- The figure dataset is a **curated set of 24 real, deceased, non-mythological
  figures** spanning the easy/medium/hard tiers from the spec. Each record links
  back to Wikidata + Wikipedia, and the seeder pulls portraits and summaries from
  the Wikipedia REST API. To grow the catalogue, add entries to
  [`apps/backend/src/data/figures.ts`](apps/backend/src/data/figures.ts) and re-run `pnpm seed`.
- Tearing down the databases: `docker compose down` (add `-v` to also delete the
  stored data volumes).
```
