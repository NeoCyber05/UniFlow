-- Additive: cuộc trò chuyện của trang Trợ lý cá nhân (/assistant). Chạy trước khi bật /api/ai/threads
-- (hoặc dùng `npx prisma db push`).
CREATE TABLE IF NOT EXISTS "AssistantThread" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "pinnedAt" TIMESTAMP(3),
  "decisions" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantThread_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AssistantThread_userId_updatedAt_idx" ON "AssistantThread"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "AssistantThread_boardId_idx" ON "AssistantThread"("boardId");

CREATE TABLE IF NOT EXISTS "AssistantMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "parts" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");

alter table if exists "AssistantThread" enable row level security;
alter table if exists "AssistantMessage" enable row level security;
