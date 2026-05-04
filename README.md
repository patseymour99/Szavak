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

```bash
flyctl launch --copy-config            # uses the included fly.toml + Dockerfile
flyctl secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  ADMIN_BOOTSTRAP_PIN=1234 \
  DATABASE_URL="file:/data/szavak.db"   # or a Postgres URL
flyctl volumes create szavak_data --size 1   # if using SQLite
# uncomment the [mounts] section in fly.toml first
flyctl deploy
```

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

## Switching to Postgres

1. Edit `apps/server/prisma/schema.prisma`, change `provider = "sqlite"` to
   `provider = "postgresql"`.
2. Set `DATABASE_URL` to your Postgres URL.
3. `cd apps/server && pnpm exec prisma migrate dev --name init_pg`.

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
