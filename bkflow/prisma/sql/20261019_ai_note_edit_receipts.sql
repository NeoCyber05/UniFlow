-- Additive: idempotency receipt on AI page edits. NOT applied to any DB by the code change; apply before shipping the AI page route.
-- Idempotent. Old rows keep NULL requestId (Postgres unique allows many NULLs); no backfill.
alter table "AiNoteEdit" add column if not exists "requestId" text;
alter table "AiNoteEdit" add column if not exists "requestFingerprint" text;
alter table "AiNoteEdit" add column if not exists "beforeUpdatedAt" timestamp(3);
create unique index if not exists "AiNoteEdit_userId_requestId_key" on "AiNoteEdit" ("userId", "requestId");
