-- Additive: map of legacy note deadline blocks converted (opt-in, per page) into Cards. NOT applied to any DB by the code change.
-- Idempotent. No FK to Card or NotePage on purpose: the mapping and snapshot survive task deletion; no backfill.
create table if not exists "NoteDeadlineTaskMap" (
  "id" text primary key,
  "userId" text not null,
  "pageId" text not null,
  "blockId" text not null,
  "cardId" text not null,
  "requestId" text not null,
  "beforeBlock" jsonb not null,
  "beforePageRevision" timestamp(3) not null,
  "afterPageRevision" timestamp(3) not null,
  "cardRevision" timestamp(3) not null,
  "convertedAt" timestamp(3) not null default current_timestamp,
  "restoredAt" timestamp(3)
);
create unique index if not exists "NoteDeadlineTaskMap_pageId_blockId_key" on "NoteDeadlineTaskMap" ("pageId", "blockId");
create index if not exists "NoteDeadlineTaskMap_userId_pageId_requestId_idx" on "NoteDeadlineTaskMap" ("userId", "pageId", "requestId");
-- Same policy as enable-rls.sql: block the PostgREST/anon API; Prisma bypasses RLS.
alter table if exists "NoteDeadlineTaskMap" enable row level security;
