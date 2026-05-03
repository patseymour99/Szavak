import { create } from "zustand";
import type { Language, Profile } from "@szavak/shared";

interface SessionState {
  profile: (Profile & { isAdmin: boolean }) | null;
  setProfile: (p: (Profile & { isAdmin: boolean }) | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));

interface PuzzleLangState {
  puzzleLang: Language;
  setPuzzleLang: (lng: Language) => void;
}

const PUZZLE_LANG_KEY = "szavak.puzzleLang";

export const usePuzzleLang = create<PuzzleLangState>((set) => ({
  puzzleLang:
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem(PUZZLE_LANG_KEY) as Language)) ||
    "hu",
  setPuzzleLang: (puzzleLang) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PUZZLE_LANG_KEY, puzzleLang);
    }
    set({ puzzleLang });
  },
}));
