CREATE TABLE IF NOT EXISTS "AiNoteEdit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "notePageId" TEXT NOT NULL,
  "beforeContent" TEXT NOT NULL,
  "afterContent" TEXT NOT NULL,
  "appliedUpdatedAt" TIMESTAMP(3) NOT NULL,
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiNoteEdit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiNoteEdit_notePageId_fkey" FOREIGN KEY ("notePageId") REFERENCES "NotePage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AiNoteEdit_userId_orgId_notePageId_createdAt_idx" ON "AiNoteEdit"("userId", "orgId", "notePageId", "createdAt");
