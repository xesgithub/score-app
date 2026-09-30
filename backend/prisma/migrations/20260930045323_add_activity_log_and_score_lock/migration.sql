-- AlterTable
ALTER TABLE "Judge" ADD COLUMN "scoresLockedAt" DATETIME;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "actorJudgeId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ActivityLog_competitionId_createdAt_idx" ON "ActivityLog"("competitionId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorJudgeId_idx" ON "ActivityLog"("actorJudgeId");
