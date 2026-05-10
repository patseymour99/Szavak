import { FastifyInstance } from "fastify";
import { z } from "zod";
import { computeElapsedMs, type Language } from "@szavak/shared";
import { prisma } from "../db/prisma.js";
import { requireProfile } from "../auth.js";
import { findDailyPuzzle, findPuzzle, savePuzzle, strip } from "../db/puzzle-store.js";
import { dateSeed, generatePuzzle } from "../generator/index.js";
import { env } from "../config.js";

function todayInTz(tz: string): string {
  // YYYY-MM-DD in the configured timezone
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

async function ensureDailyPuzzle(date: string, language: Language) {
  const existing = await findDailyPuzzle(date, language);
  if (existing) return existing;
  const seed = dateSeed(`${date}:${language}`);
  const generated = generatePuzzle({
    language,
    // v1 ships 4x4 with duplicate-answer relaxation while we grow the bank
    // toward true 5x5 minis. The actual bug (IMG_0107 duplicate clue text)
    // is fixed by the new generator regardless of size. See DECISIONS.md.
    size: 4,
    kind: "daily",
    seed,
    date,
    allowDuplicateAnswers: true,
  });
  return savePuzzle(generated);
}

export async function registerPuzzleRoutes(app: FastifyInstance) {
  // Get today's daily puzzle (lazily generates if missing).
  app.get("/api/puzzles/daily", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const Q = z.object({ language: z.enum(["hu", "en"]).default("hu") }).parse(req.query);
    const date = todayInTz(env.TIMEZONE);
    const puzzle = await ensureDailyPuzzle(date, Q.language);
    // Find or create the solver's Solve record (start the timer on first fetch).
    let solve = await prisma.solve.findUnique({
      where: { profileId_puzzleId: { profileId: me.id, puzzleId: puzzle.id } },
    });
    if (!solve) {
      solve = await prisma.solve.create({
        data: { profileId: me.id, puzzleId: puzzle.id, startedAt: new Date() },
      });
    }
    return {
      puzzle: strip(puzzle),
      solve: {
        startedAt: solve.startedAt.toISOString(),
        completedAt: solve.completedAt?.toISOString() ?? null,
        reveals: solve.reveals,
        checks: solve.checks,
        elapsedMs: solve.elapsedMs,
      },
    };
  });

  // Submit solve: client sends final letters; server validates + records.
  const SubmitBody = z.object({
    letters: z.array(z.string()),
    reveals: z.number().int().nonnegative().default(0),
    checks: z.number().int().nonnegative().default(0),
  });

  app.post("/api/puzzles/:id/submit", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = SubmitBody.parse(req.body);
    const puzzle = await findPuzzle(params.id);
    if (!puzzle) return reply.code(404).send({ error: "not_found" });
    if (body.letters.length !== puzzle.cells.length) {
      return reply.code(400).send({ error: "size_mismatch" });
    }
    let errors = 0;
    let allCorrect = true;
    for (let i = 0; i < puzzle.cells.length; i++) {
      const cell = puzzle.cells[i];
      if (cell.isBlack) continue;
      if ((body.letters[i] ?? "").toLocaleUpperCase("hu-HU") !== cell.solution) {
        allCorrect = false;
        if ((body.letters[i] ?? "") !== "") errors++;
      }
    }
    const solve = await prisma.solve.findUnique({
      where: { profileId_puzzleId: { profileId: me.id, puzzleId: puzzle.id } },
    });
    if (!solve) return reply.code(400).send({ error: "no_solve_started" });
    if (!allCorrect) {
      return { ok: false, errors };
    }
    const completedAt = new Date();
    const elapsedMs = computeElapsedMs(
      solve.startedAt.toISOString(),
      completedAt.toISOString(),
      body.reveals,
      body.checks,
    );
    await prisma.solve.update({
      where: { id: solve.id },
      data: {
        completedAt,
        reveals: body.reveals,
        checks: body.checks,
        errors,
        elapsedMs,
      },
    });
    return { ok: true, elapsedMs };
  });

  // Reveal a single letter; increments reveal counter on the Solve.
  const RevealBody = z.object({ row: z.number().int().nonnegative(), col: z.number().int().nonnegative() });
  app.post("/api/puzzles/:id/reveal", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = RevealBody.parse(req.body);
    const puzzle = await findPuzzle(params.id);
    if (!puzzle) return reply.code(404).send({ error: "not_found" });
    const idx = body.row * puzzle.cols + body.col;
    const cell = puzzle.cells[idx];
    if (!cell || cell.isBlack) return reply.code(400).send({ error: "no_letter_here" });
    await prisma.solve.update({
      where: { profileId_puzzleId: { profileId: me.id, puzzleId: puzzle.id } },
      data: { reveals: { increment: 1 } },
    });
    return { letter: cell.solution };
  });

  // Get a single puzzle (used by collab clients to render the grid).
  app.get("/api/puzzles/:id", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const params = z.object({ id: z.string() }).parse(req.params);
    const puzzle = await findPuzzle(params.id);
    if (!puzzle) return reply.code(404).send({ error: "not_found" });
    return { puzzle: strip(puzzle) };
  });

  // Start (or rejoin) a collab session — generates a 7x7 puzzle if no open session.
  app.post("/api/puzzles/collab/start", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const Q = z.object({ language: z.enum(["hu", "en"]).default("hu") }).parse(req.body ?? {});
    // Reuse an open session if one exists.
    const open = await prisma.collabSession.findFirst({
      where: { endedAt: null, puzzle: { language: Q.language } },
      orderBy: { startedAt: "desc" },
      include: { puzzle: true },
    });
    if (open) {
      return { sessionId: open.id, puzzleId: open.puzzleId };
    }
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const generated = generatePuzzle({
      language: Q.language,
      size: 4,
      kind: "collab",
      seed,
      allowDuplicateAnswers: true,
    });
    const saved = await savePuzzle(generated);
    const session = await prisma.collabSession.create({
      data: { puzzleId: saved.id, lettersJson: JSON.stringify(saved.cells.map(() => "")) },
    });
    return { sessionId: session.id, puzzleId: saved.id };
  });

  app.get("/api/puzzles/collab/open", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const sessions = await prisma.collabSession.findMany({
      where: { endedAt: null },
      include: { puzzle: true, members: { include: { profile: true } } },
      orderBy: { startedAt: "desc" },
    });
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        puzzleId: s.puzzleId,
        language: s.puzzle.language,
        rows: s.puzzle.rows,
        cols: s.puzzle.cols,
        startedAt: s.startedAt.toISOString(),
        members: s.members.map((m) => ({ id: m.profileId, name: m.profile.name, color: m.profile.color })),
      })),
    };
  });
}
