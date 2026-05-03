import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { io, Socket } from "socket.io-client";
import type {
  CellUpdateEvent,
  ClientToServerEvents,
  CollabState,
  Profile,
  Puzzle,
  ServerToClientEvents,
} from "@szavak/shared";
import { Layout } from "../components/Layout";
import { CrosswordGrid, RemoteCursor } from "../components/CrosswordGrid";
import { ClueList } from "../components/ClueList";
import { api } from "../api";
import { useSession, usePuzzleLang } from "../store";

export default function CollabPuzzle() {
  const { t } = useTranslation();
  const me = useSession((s) => s.profile);
  const puzzleLang = usePuzzleLang((s) => s.puzzleLang);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [letters, setLetters] = useState<string[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [cursors, setCursors] = useState<Record<string, { row: number; col: number }>>({});
  const [active, setActive] = useState({ row: 0, col: 0 });
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [completed, setCompleted] = useState(false);

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  // Start or rejoin a session.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    api.collabStart(puzzleLang).then(async ({ puzzleId }) => {
      if (cancelled) return;
      setPuzzleId(puzzleId);
      const { puzzle } = await api.puzzle(puzzleId);
      if (cancelled) return;
      setPuzzle(puzzle);
      setLetters(puzzle.cells.map(() => ""));
      const first = puzzle.cells.findIndex((c) => !c.isBlack);
      if (first >= 0) {
        setActive({ row: Math.floor(first / puzzle.cols), col: first % puzzle.cols });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [me, puzzleLang]);

  // Connect socket.
  useEffect(() => {
    if (!me || !puzzleId) return;
    const socket = io({
      auth: { profileId: me.id },
      withCredentials: true,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;
    socketRef.current = socket;
    socket.emit("collab:join", puzzleId, (state: CollabState) => {
      setLetters(state.letters);
      setMembers(state.members);
      setCursors(state.cursors);
    });
    socket.on("cell:update", (e: CellUpdateEvent) => {
      if (!puzzle) return;
      setLetters((prev) => {
        const next = prev.slice();
        next[e.row * puzzle.cols + e.col] = e.letter;
        return next;
      });
    });
    socket.on("cursor:move", (e) => {
      setCursors((prev) => ({ ...prev, [e.profileId]: { row: e.row, col: e.col } }));
    });
    socket.on("presence:join", (e) => {
      setMembers((prev) =>
        prev.find((p) => p.id === e.profile.id) ? prev : [...prev, e.profile],
      );
    });
    socket.on("presence:leave", (e) => {
      setMembers((prev) => prev.filter((p) => p.id !== e.profileId));
      setCursors((prev) => {
        const c = { ...prev };
        delete c[e.profileId];
        return c;
      });
    });
    socket.on("puzzle:complete", () => {
      setCompleted(true);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me, puzzleId, puzzle]);

  const remoteCursors = useMemo<RemoteCursor[]>(() => {
    if (!me) return [];
    const out: RemoteCursor[] = [];
    for (const m of members) {
      if (m.id === me.id) continue;
      const c = cursors[m.id];
      if (!c) continue;
      out.push({ profile: m, row: c.row, col: c.col });
    }
    return out;
  }, [members, cursors, me]);

  if (!puzzle) {
    return (
      <Layout>
        <p>{t("collab.starting")}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-baseline gap-4 mb-4">
        <h1 className="text-xl font-semibold">{t("collab.title")}</h1>
        <div className="ml-auto flex flex-wrap gap-2 text-sm text-slate-600">
          <span>{t("collab.online")}:</span>
          {members.map((m) => (
            <span
              key={m.id}
              className="px-2 py-0.5 rounded text-white text-xs"
              style={{ backgroundColor: m.color }}
            >
              {m.name}
            </span>
          ))}
        </div>
      </div>
      {completed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 mb-4 text-emerald-800">
          {t("collab.completed")}
        </div>
      )}
      <div className="flex flex-wrap gap-6">
        <CrosswordGrid
          puzzle={puzzle}
          letters={letters}
          active={active}
          direction={direction}
          remoteCursors={remoteCursors}
          onChange={(r, c, letter) => {
            const idx = r * puzzle.cols + c;
            setLetters((prev) => {
              const next = prev.slice();
              next[idx] = letter;
              return next;
            });
            socketRef.current?.emit("cell:update", { row: r, col: c, letter });
          }}
          onMove={(r, c) => {
            setActive({ row: r, col: c });
            socketRef.current?.emit("cursor:move", { row: r, col: c });
          }}
          onDirectionToggle={() =>
            setDirection((d) => (d === "across" ? "down" : "across"))
          }
        />
        <div className="flex-1 min-w-[280px]">
          <ClueList
            clues={puzzle.clues}
            active={active}
            direction={direction}
            onPick={(clue) => {
              setActive({ row: clue.row, col: clue.col });
              setDirection(clue.direction);
              socketRef.current?.emit("cursor:move", { row: clue.row, col: clue.col });
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
