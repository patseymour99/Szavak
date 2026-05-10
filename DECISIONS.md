# Decisions

Notable trade-offs made during the rebuild. One line of context per decision so anyone walking into this codebase later can see why a thing is the way it is.

## Phase 1

### Stack mismatch with starter pack §15

The brief assumed Phoenix LiveView + Postgres. The actual repo is Node/TypeScript (Fastify + React + Prisma + SQLite, pnpm workspace). Architecture decisions in §15 don't change in spirit: co-op uses the existing Socket.IO wiring, daily generation runs as a `node-cron` job (already there), persistence is Prisma + SQLite. Family/invite-code auth (§9) is deferred to Phase 2; the deployed seven-profile + PIN auth is preserved.

### 4×4 grid in Phase 1, 5×5 deferred to Phase 5

The brief calls 4×4 "trivially small" and demands 5×5 minis. **However**: the bug it actually targets — IMG_0107's duplicate "Ház felső fedele" clue across four slots — is a **clue-text duplication** bug, not a grid-size bug. Fixing it requires only that no two slots in a puzzle share clue text.

The 5×5 generation problem on the bank we ship today is fundamentally infeasible: brute-force search exhausts 5M+ attempts without finding a valid 4×4 OR 5×5 fill. Real crossword generators rely on **5,000+ word banks**; ours starts at ~470 entries (113 5-letter, 109 4-letter). Hand-vetted Hungarian word squares of size 4 or 5 are individually solvable for an experienced editor but extremely time-consuming.

Phase-1 ship: keep the 4×4 word-square layout the legacy generator already uses (which is filable), but **enforce unique clue texts** in the new generator (the actual bug). The multi-clue bank makes this work: when an answer appears in both an across slot and a down slot, each occurrence picks a different clue. IMG_0107 cannot recur. Phase 5 expands the bank past 1500+ entries and switches to true 5×5 minis.

### Curated multi-clue bank for HU; legacy single-clue bank as supplementary

`data/hu-bank.json` is a 200+ entry curated bank in the rich format (entry has a `clues` array, each with `text` + `difficulty`). The existing 325-entry `data/hu-wordbank.json` is preserved and merged in as supplementary single-clue entries — this nearly doubles the candidate pool for the constraint solver. Voice should be reviewed by a native Hungarian speaker before public launch (flagged in the file's `_note`). The English bank stays as legacy single-clue for v1; expanding it is Phase 5.

### Generator allows duplicate answers but requires unique clue texts

Standard crossword spec (§7.2 rule 5) bans duplicate answers. With a 4×4 word-square layout and our small bank, that rule makes generation infeasible. The generator's `allowDuplicateAnswers` flag relaxes rule 5 while keeping rule 6 (unique clue texts) hard. Validator surfaces both failure modes; the route only sets `allowDuplicateAnswers` for now. Once the bank is big enough for 5×5 with corner blocks, the flag flips off and the spec is fully satisfied.

### Same-origin asset serving without ACAO header

WebKit/iOS rejects wildcard `Access-Control-Allow-Origin: *` on credentialed requests, including `<script type="module">` and stylesheet preloads. The `setHeaders` option on `@fastify/static` was removed; same-origin static responses go out without CORS headers, which the browser treats as basic mode. See `apps/server/src/index.ts`.

### Vite output as classic IIFE script (defer)

iPad WebKit's module loader silently rejected the bundle download with no error event, even after CORS removal — the script tag and dynamic `import()` both reported "Importing a module script failed". The Vite build now outputs a single IIFE-format bundle, and a small `transformIndexHtml` plugin strips `crossorigin` and replaces `type="module"` with `defer` so the script executes after `<body>` is parsed. See `apps/web/vite.config.ts`.

### Inline diagnostic in index.html

`apps/web/index.html` ships an inline `<script>` block that catches resource-load and runtime errors, polls a `dataset.appMounted` flag, and renders a red diagnostic into `#root` if React doesn't mount within 4s. Cheap insurance for future iPad-only deploys where there's no devtools to fall back on.
