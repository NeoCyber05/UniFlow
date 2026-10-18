-- Additive update for databases that already have the current schema.
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "pageStyle" JSONB;
CREATE TABLE IF NOT EXISTS "NotePage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Trang mới',
  "content" TEXT NOT NULL DEFAULT '',
  "style" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotePage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NotePage_userId_orgId_updatedAt_idx" ON "NotePage"("userId", "orgId", "updatedAt");
