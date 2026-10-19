-- Additive: receipts/undo snapshots for AI task edits. NOT applied to any DB by the code change; apply before shipping /api/ai/edits.
CREATE TABLE IF NOT EXISTS "AiTaskEdit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "appliedUpdatedAt" TIMESTAMP(3) NOT NULL,
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiTaskEdit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiTaskEdit_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiTaskEdit_userId_requestId_key" ON "AiTaskEdit"("userId", "requestId");
CREATE INDEX IF NOT EXISTS "AiTaskEdit_userId_cardId_createdAt_idx" ON "AiTaskEdit"("userId", "cardId", "createdAt");
alter table if exists "AiTaskEdit" enable row level security;
