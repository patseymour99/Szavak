import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireProfile } from "../auth.js";
import { env } from "../config.js";

function todayInTz(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function registerLeaderboardRoutes(app: FastifyInstance) {
  // Daily leaderboard for a given date (defaults to today in TZ).
  app.get("/api/leaderboard/daily", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const Q = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        language: z.enum(["hu", "en"]).default("hu"),
      })
      .parse(req.query);
    const date = Q.date ?? todayInTz(env.TIMEZONE);
    const puzzle = await prisma.puzzle.findUnique({
      where: { kind_language_date: { kind: "daily", language: Q.language, date } },
    });
    if (!puzzle) return { date, language: Q.language, entries: [] };
    const solves = await prisma.solve.findMany({
      where: { puzzleId: puzzle.id, completedAt: { not: null } },
      include: { profile: true },
      orderBy: [{ elapsedMs: "asc" }, { completedAt: "asc" }],
    });
    return {
      date,
      language: Q.language,
      entries: solves.map((s) => ({
        profile: { id: s.profile.id, name: s.profile.name, color: s.profile.color },
        elapsedMs: s.elapsedMs ?? 0,
        errors: s.errors,
        completedAt: s.completedAt!.toISOString(),
      })),
    };
  });

  // Monthly aggregate leaderboard (sum of daily times, count of solves).
  app.get("/api/leaderboard/monthly", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    const Q = z
      .object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        language: z.enum(["hu", "en"]).default("hu"),
      })
      .parse(req.query);
    const today = todayInTz(env.TIMEZONE);
    const month = Q.month ?? today.slice(0, 7);
    const start = `${month}-01`;
    const [yy, mm] = month.split("-").map(Number);
    const nextMonth = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, "0")}`;
    const end = `${nextMonth}-01`;

    const puzzles = await prisma.puzzle.findMany({
      where: { kind: "daily", language: Q.language, date: { gte: start, lt: end } },
    });
    const puzzleIds = puzzles.map((p) => p.id);
    const solves = await prisma.solve.findMany({
      where: { puzzleId: { in: puzzleIds }, completedAt: { not: null } },
      include: { profile: true },
    });
    const agg = new Map<
      string,
      {
        profile: { id: string; name: string; color: string };
        totalMs: number;
        solves: number;
      }
    >();
    for (const s of solves) {
      const existing = agg.get(s.profileId) ?? {
        profile: { id: s.profile.id, name: s.profile.name, color: s.profile.color },
        totalMs: 0,
        solves: 0,
      };
      existing.totalMs += s.elapsedMs ?? 0;
      existing.solves += 1;
      agg.set(s.profileId, existing);
    }
    const entries = [...agg.values()].sort((a, b) => {
      if (b.solves !== a.solves) return b.solves - a.solves;
      return a.totalMs - b.totalMs;
    });
    return { month, language: Q.language, entries };
  });
}
