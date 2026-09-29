-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightPercent" REAL NOT NULL,
    "maxScore" REAL NOT NULL DEFAULT 5,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Criterion_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bibNumber" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Competitor_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Judge_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "judgeId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Score_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Judge_accessToken_key" ON "Judge"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "Score_judgeId_competitorId_criterionId_key" ON "Score"("judgeId", "competitorId", "criterionId");
