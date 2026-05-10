import cron from "node-cron";
import { env } from "../config.js";
import { dateSeed, generatePuzzle } from "../generator/index.js";
import { findDailyPuzzle, savePuzzle } from "../db/puzzle-store.js";
import type { Language } from "@szavak/shared";

const LANGS: Language[] = ["hu", "en"];

function todayInTz(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

async function generateForDate(date: string) {
  for (const language of LANGS) {
    const existing = await findDailyPuzzle(date, language);
    if (existing) continue;
    const seed = dateSeed(`${date}:${language}`);
    const generated = generatePuzzle({ language, size: 4, kind: "daily", seed, date, allowDuplicateAnswers: true });
    await savePuzzle(generated);
    // eslint-disable-next-line no-console
    console.log(`[scheduler] generated daily puzzle ${date} ${language}`);
  }
}

export function startDailyScheduler() {
  // Generate today's puzzle on boot if missing.
  generateForDate(todayInTz(env.TIMEZONE)).catch((err) => {
    console.error("[scheduler] initial generation failed", err);
  });
  // Also schedule midnight (Europe/Budapest) cron.
  cron.schedule(
    "1 0 * * *",
    () => {
      generateForDate(todayInTz(env.TIMEZONE)).catch((err) => {
        console.error("[scheduler] midnight generation failed", err);
      });
    },
    { timezone: env.TIMEZONE },
  );
}
