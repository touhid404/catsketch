-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "ownerId" TEXT,
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "PlanTier" (
    "code" "Plan" NOT NULL,
    "name" TEXT NOT NULL,
    "creationLimit" INTEGER,
    "participantLimit" INTEGER,

    CONSTRAINT "PlanTier_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdRoomsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "WhiteboardSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sceneData" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhiteboardSnapshot_sessionId_key" ON "WhiteboardSnapshot"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_ownerId_createdAt_idx" ON "Session"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Participant_sessionId_joinedAt_idx" ON "Participant"("sessionId", "joinedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_plan_fkey" FOREIGN KEY ("plan") REFERENCES "PlanTier"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardSnapshot" ADD CONSTRAINT "WhiteboardSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Participant"("guestId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve existing rooms before moving their state into dedicated tables.
INSERT INTO "WhiteboardSnapshot" ("id", "sessionId", "sceneData", "revision", "updatedAt")
SELECT gen_random_uuid()::text, "id", "sceneData", "revision", CURRENT_TIMESTAMP FROM "Session";
INSERT INTO "ChatMessage" ("id", "sessionId", "guestId", "username", "text", "createdAt")
SELECT m->>'id', s."id", m->>'guestId', m->>'username', m->>'text', (m->>'createdAt')::timestamp
FROM "Session" s CROSS JOIN LATERAL jsonb_array_elements(s."messages") m
WHERE EXISTS (SELECT 1 FROM "Participant" p WHERE p."guestId" = m->>'guestId')
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "Session" DROP COLUMN "messages", DROP COLUMN "sceneData";
INSERT INTO "PlanTier" ("code", "name", "creationLimit", "participantLimit") VALUES
('FREE', 'Free', 5, 10), ('PRO', 'Premium', NULL, NULL);
ALTER TABLE "User" ADD CONSTRAINT "User_createdRoomsCount_nonnegative" CHECK ("createdRoomsCount" >= 0);
