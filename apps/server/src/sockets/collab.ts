import type { Server as IOServer, Socket } from "socket.io";
import type {
  CollabState,
  ClientToServerEvents,
  Profile,
  ServerToClientEvents,
} from "@szavak/shared";
import { prisma } from "../db/prisma.js";
import { findPuzzle } from "../db/puzzle-store.js";

interface RoomState {
  puzzleId: string;
  sessionId: string;
  letters: string[];
  cursors: Record<string, { row: number; col: number }>;
  /** profileId -> Profile metadata */
  members: Map<string, Profile>;
}

const rooms = new Map<string, RoomState>(); // key = puzzleId

async function loadRoom(puzzleId: string): Promise<RoomState | null> {
  const cached = rooms.get(puzzleId);
  if (cached) return cached;
  const puzzle = await findPuzzle(puzzleId);
  if (!puzzle) return null;
  const session = await prisma.collabSession.findFirst({
    where: { puzzleId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return null;
  let letters: string[];
  try {
    const parsed = JSON.parse(session.lettersJson);
    if (Array.isArray(parsed) && parsed.length === puzzle.cells.length) {
      letters = parsed;
    } else {
      letters = puzzle.cells.map(() => "");
    }
  } catch {
    letters = puzzle.cells.map(() => "");
  }
  const room: RoomState = {
    puzzleId,
    sessionId: session.id,
    letters,
    cursors: {},
    members: new Map(),
  };
  rooms.set(puzzleId, room);
  return room;
}

async function persistRoomLetters(room: RoomState) {
  await prisma.collabSession.update({
    where: { id: room.sessionId },
    data: { lettersJson: JSON.stringify(room.letters) },
  });
}

async function checkComplete(room: RoomState): Promise<boolean> {
  const puzzle = await findPuzzle(room.puzzleId);
  if (!puzzle) return false;
  for (let i = 0; i < puzzle.cells.length; i++) {
    const cell = puzzle.cells[i];
    if (cell.isBlack) continue;
    if ((room.letters[i] ?? "").toLocaleUpperCase("hu-HU") !== cell.solution) {
      return false;
    }
  }
  return true;
}

interface SocketAuth {
  profileId: string;
}

export function attachCollab(
  io: IOServer<ClientToServerEvents, ServerToClientEvents>,
) {
  io.on("connection", async (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const auth = socket.handshake.auth as SocketAuth | undefined;
    if (!auth?.profileId) {
      socket.disconnect(true);
      return;
    }
    const profile = await prisma.profile.findUnique({ where: { id: auth.profileId } });
    if (!profile) {
      socket.disconnect(true);
      return;
    }
    const profileMeta: Profile = { id: profile.id, name: profile.name, color: profile.color };

    let joinedPuzzleId: string | null = null;

    socket.on("collab:join", async (puzzleId, ack) => {
      const room = await loadRoom(puzzleId);
      if (!room) return;
      joinedPuzzleId = puzzleId;
      socket.join(`puzzle:${puzzleId}`);
      room.members.set(profile.id, profileMeta);
      // Persist membership (idempotent).
      await prisma.collabMember.upsert({
        where: { sessionId_profileId: { sessionId: room.sessionId, profileId: profile.id } },
        create: { sessionId: room.sessionId, profileId: profile.id },
        update: {},
      });
      const state: CollabState = {
        puzzleId,
        letters: room.letters,
        cursors: { ...room.cursors },
        members: [...room.members.values()],
      };
      ack(state);
      socket.to(`puzzle:${puzzleId}`).emit("presence:join", { profile: profileMeta });
    });

    socket.on("cell:update", async (event) => {
      if (!joinedPuzzleId) return;
      const room = rooms.get(joinedPuzzleId);
      if (!room) return;
      const puzzle = await findPuzzle(joinedPuzzleId);
      if (!puzzle) return;
      const idx = event.row * puzzle.cols + event.col;
      const cell = puzzle.cells[idx];
      if (!cell || cell.isBlack) return;
      room.letters[idx] = (event.letter ?? "").toLocaleUpperCase("hu-HU").slice(0, 1);
      io.to(`puzzle:${joinedPuzzleId}`).emit("cell:update", { ...event, profileId: profile.id });
      await persistRoomLetters(room);
      if (await checkComplete(room)) {
        const memberIds = [...room.members.keys()];
        await prisma.collabSession.update({
          where: { id: room.sessionId },
          data: { endedAt: new Date() },
        });
        for (const profileId of memberIds) {
          await prisma.solve.upsert({
            where: { profileId_puzzleId: { profileId, puzzleId: joinedPuzzleId } },
            create: {
              profileId,
              puzzleId: joinedPuzzleId,
              startedAt: new Date(),
              completedAt: new Date(),
              elapsedMs: 0,
            },
            update: { completedAt: new Date() },
          });
        }
        io.to(`puzzle:${joinedPuzzleId}`).emit("puzzle:complete", {
          profileIds: memberIds,
          finishedAt: new Date().toISOString(),
        });
        rooms.delete(joinedPuzzleId);
      }
    });

    socket.on("cursor:move", (event) => {
      if (!joinedPuzzleId) return;
      const room = rooms.get(joinedPuzzleId);
      if (!room) return;
      room.cursors[profile.id] = { row: event.row, col: event.col };
      socket
        .to(`puzzle:${joinedPuzzleId}`)
        .emit("cursor:move", { ...event, profileId: profile.id });
    });

    socket.on("disconnect", () => {
      if (!joinedPuzzleId) return;
      const room = rooms.get(joinedPuzzleId);
      if (!room) return;
      room.members.delete(profile.id);
      delete room.cursors[profile.id];
      socket.to(`puzzle:${joinedPuzzleId}`).emit("presence:leave", { profileId: profile.id });
    });
  });
}
