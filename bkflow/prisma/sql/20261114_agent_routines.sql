ALTER TYPE "NOTIFICATION_TYPE" ADD VALUE IF NOT EXISTS 'AGENT_BRIEF';
CREATE TABLE IF NOT EXISTS "AgentRoutine" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "minuteOfDay" INTEGER NOT NULL,
  "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "timeZone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentRoutine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentRoutine_enabled_nextRunAt_idx" ON "AgentRoutine"("enabled", "nextRunAt");
CREATE INDEX IF NOT EXISTS "AgentRoutine_userId_idx" ON "AgentRoutine"("userId");
alter table if exists "AgentRoutine" enable row level security;
