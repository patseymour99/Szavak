import type { DailyLeaderboard, Language, Profile, Puzzle } from "@szavak/shared";

async function http<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  me: () => http<{ profile: (Profile & { isAdmin: boolean }) | null }>("/api/auth/me"),
  login: (profileId: string, pin: string) =>
    http<{ profile: Profile & { isAdmin: boolean } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ profileId, pin }),
    }),
  logout: () => http<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  listProfiles: () => http<{ profiles: Profile[] }>("/api/profiles"),
  createProfile: (name: string, pin: string, bootstrapPin?: string) =>
    http<{ profile: Profile & { isAdmin: boolean } }>("/api/profiles", {
      method: "POST",
      body: JSON.stringify({ name, pin, bootstrapPin }),
    }),
  deleteProfile: (id: string) =>
    http<{ ok: true }>(`/api/profiles/${id}`, { method: "DELETE" }),
  daily: (language: Language) =>
    http<{
      puzzle: Puzzle;
      solve: { startedAt: string; completedAt: string | null; reveals: number; checks: number; elapsedMs: number | null };
    }>(`/api/puzzles/daily?language=${language}`),
  reveal: (puzzleId: string, row: number, col: number) =>
    http<{ letter: string }>(`/api/puzzles/${puzzleId}/reveal`, {
      method: "POST",
      body: JSON.stringify({ row, col }),
    }),
  submit: (puzzleId: string, letters: string[], reveals: number, checks: number) =>
    http<{ ok: boolean; elapsedMs?: number; errors?: number }>(
      `/api/puzzles/${puzzleId}/submit`,
      { method: "POST", body: JSON.stringify({ letters, reveals, checks }) },
    ),
  collabStart: (language: Language) =>
    http<{ sessionId: string; puzzleId: string }>("/api/puzzles/collab/start", {
      method: "POST",
      body: JSON.stringify({ language }),
    }),
  collabOpen: () =>
    http<{
      sessions: Array<{
        id: string;
        puzzleId: string;
        language: Language;
        rows: number;
        cols: number;
        startedAt: string;
        members: Profile[];
      }>;
    }>("/api/puzzles/collab/open"),
  puzzle: (id: string) => http<{ puzzle: Puzzle }>(`/api/puzzles/${id}`),
  dailyLeaderboard: (language: Language, date?: string) =>
    http<DailyLeaderboard & { language: Language }>(
      `/api/leaderboard/daily?language=${language}${date ? `&date=${date}` : ""}`,
    ),
  monthlyLeaderboard: (language: Language, month?: string) =>
    http<{
      month: string;
      language: Language;
      entries: Array<{
        profile: Profile;
        totalMs: number;
        solves: number;
      }>;
    }>(`/api/leaderboard/monthly?language=${language}${month ? `&month=${month}` : ""}`),
};
