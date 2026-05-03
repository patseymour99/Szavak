-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "date" TEXT,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL,
    "cellsJson" TEXT NOT NULL,
    "cluesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Solve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "reveals" INTEGER NOT NULL DEFAULT 0,
    "checks" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "elapsedMs" INTEGER,
    CONSTRAINT "Solve_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Solve_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollabSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "puzzleId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "lettersJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "CollabSession_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollabMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollabMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollabSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollabMember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_name_key" ON "Profile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_kind_language_date_key" ON "Puzzle"("kind", "language", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Solve_profileId_puzzleId_key" ON "Solve"("profileId", "puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "CollabMember_sessionId_profileId_key" ON "CollabMember"("sessionId", "profileId");
