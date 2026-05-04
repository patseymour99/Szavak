# Szavak — családi keresztrejtvény

A Hungarian-first family crossword race app. Each family member has a profile,
everyone races the daily puzzle, and you can drop into a free-for-all
collaborative session and solve a shared puzzle together with live cursors.

- **UI:** Hungarian by default, English toggle (i18next)
- **Puzzles:** auto-generated from a Hungarian / English word + clue bank,
  classic American style (numbered grid, Across / Down clue lists)
- **Daily mode:** one shared puzzle per family per day, ranked by completion
  time (with reveal / check penalties)
- **Collab mode:** Socket.IO room with live colored cursors; last-write-wins
- **Auth:** profile picker + 4-digit PIN per profile

## Repo layout

```
apps/
  server/   Fastify + Socket.IO + Prisma backend
  web/      React + Vite + Tailwind + i18next frontend
packages/
  shared/   Shared TS types (Puzzle, Cell, Clue, socket events, scoring helpers)
data/
  hu-wordbank.json   Hungarian seed wordbank
  en-wordbank.json   English seed wordbank
```

## Quick start (local dev)

Prereqs: Node 20+, pnpm 10+.

```bash
pnpm install
cd apps/server
DATABASE_URL="file:./dev.db" pnpm exec prisma migrate deploy
DATABASE_URL="file:./dev.db" pnpm seed     # creates the family profiles
cd ../..
pnpm dev   # starts web (5173) + server (3001) concurrently
```

Open http://localhost:5173. The seed creates seven profiles for the family —
**Andi** (admin), **Blancica**, **Pat**, **Robi**, **Marcsi**, **Jazi**,
**Zsolesz** — none of them have a PIN yet. Each person picks their own profile
the first time they sign in and chooses a 4-digit PIN; that PIN is then
required on subsequent logins.

If the database has *no* profiles at all (e.g. you wiped the DB without
running the seed), the app falls back to a bootstrap flow: enter a name +
PIN + the `ADMIN_BOOTSTRAP_PIN` (default `0000`) on the login screen to
create the first admin profile.

## Tests

```bash
pnpm -r test
```

Currently covers the crossword generator (templates, fill, determinism,
cross-language) and scoring math.

## Production build

```bash
pnpm build
node apps/server/dist/index.js   # serves API + built web app
```

The Fastify process serves both the API (`/api/*`, `/socket.io`) and the
compiled React app (`/`).

## Deploying to Fly.io

This repo's `Dockerfile` and `fly.toml` deploy the whole app — web, API,
Socket.IO, and the daily cron — as one Fly app backed by a SQLite file on a
persistent volume. (Vercel can't host this stack: serverless functions don't
support long-lived Socket.IO connections, scheduled jobs, or a local DB.)

One-time setup:

```bash
# 1. Install flyctl (https://fly.io/docs/hands-on/install-flyctl/)
brew install flyctl                         # or curl-based installer

# 2. Sign in
flyctl auth signup                          # or `flyctl auth login`

# 3. Create the app, copying the included fly.toml.
#    Pick a unique app name when prompted (e.g. "szavak-csaladi"); update
#    the `app = "..."` line and the `WEB_ORIGIN` URL in fly.toml to match.
flyctl launch --copy-config --no-deploy

# 4. Persistent volume for the SQLite DB (1 GB is way more than enough)
flyctl volumes create szavak_data --size 1 --region fra

# 5. Set production secrets (these aren't checked into the repo)
flyctl secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  ADMIN_BOOTSTRAP_PIN=1234

# 6. First deploy — builds the Docker image, runs Prisma migrations, seeds
#    the seven family profiles, then starts the server.
flyctl deploy
flyctl open                                 # opens the app in your browser
```

Subsequent updates: just `git push` to the branch you deploy from, then
`flyctl deploy`. The seed script is idempotent — already-existing profiles
are kept; new family members added to `apps/server/src/db/seed.ts` are
created on the next deploy.

### Switching to Postgres (optional)

SQLite is fine for ~7 users, but if you'd rather use Fly Postgres:

```bash
flyctl postgres create --name szavak-db --region fra
flyctl postgres attach szavak-db
# `attach` sets DATABASE_URL automatically; remove the DATABASE_URL line
# from fly.toml so the secret isn't shadowed.
```

Then change `apps/server/prisma/schema.prisma`'s
`provider = "sqlite"` to `provider = "postgresql"` and rerun
`pnpm exec prisma migrate dev --name init_pg` locally to regenerate the
migration before redeploying.

## Environment

| var | default | meaning |
|---|---|---|
| `PORT` | `3001` | server port |
| `HOST` | `0.0.0.0` | bind address |
| `DATABASE_URL` | `file:./dev.db` | Prisma URL (SQLite or Postgres). SQLite paths resolve relative to `apps/server/prisma/`. |
| `SESSION_SECRET` | `dev-secret-change-me` | cookie signing secret |
| `WEB_ORIGIN` | `http://localhost:5173` | allowed CORS origin |
| `EXTRA_ORIGINS` | `` | comma-separated additional origins |
| `ADMIN_BOOTSTRAP_PIN` | `0000` | gates first profile creation |
| `TIMEZONE` | `Europe/Budapest` | used for the daily-puzzle cutover |
| `NODE_ENV` | `development` | |

## Known v1 limitations

- **Wordbank size.** The seed bank is small (~350 HU / ~250 EN entries). The
  generator currently only ships **4×4 mini** templates because larger
  fully-open word squares aren't reliably solvable from this bank. To enable
  larger grids, grow the wordbank and add 5×5 / 7×7 templates in
  `apps/server/src/generator/templates.ts`.
- **Duplicate answers.** With a small bank the only achievable 4×4 word
  squares re-use the same word in row + column (e.g.
  `TETO / EGER / TETO / OROM`). The clue list shows the same clue twice in
  those cases. Disable by flipping the `allowDuplicates` flag in
  `apps/server/src/generator/index.ts` once the bank supports it.
- **Daily puzzle is per-family.** No cross-family sharing or public leaderboard
  in v1.

## Adding wordbank entries

Edit `data/hu-wordbank.json` or `data/en-wordbank.json`:

```json
{ "answer": "ALMA", "clue": "Gyümölcs, ami nem esik messze a fájától" }
```

Answers are normalized to uppercase; Hungarian accents (`Á É Í Ó Ö Ő Ú Ü Ű`)
are preserved as single cells. Digraphs like `sz`, `cs`, `gy` collapse to one
character per cell (so `MACSKA` is six cells, not five).

The server reads the bank at boot, so restart after edits.

## License

MIT.
