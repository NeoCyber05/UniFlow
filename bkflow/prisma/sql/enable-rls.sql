-- Enable RLS on all public tables so the PostgREST / anon API cannot read or write them.
-- Prisma connects via the postgres role which bypasses RLS, so the app is unaffected.
alter table if exists "Board" enable row level security;
alter table if exists "BoardGraphPlan" enable row level security;
alter table if exists "List" enable row level security;
alter table if exists "Card" enable row level security;
alter table if exists "CardLabel" enable row level security;
alter table if exists "Label" enable row level security;
alter table if exists "CardComment" enable row level security;
alter table if exists "CardCommentReaction" enable row level security;
alter table if exists "Checklist" enable row level security;
alter table if exists "ChecklistItem" enable row level security;
alter table if exists "CardDependency" enable row level security;
alter table if exists "CardAttachment" enable row level security;
alter table if exists "CardUserState" enable row level security;
alter table if exists "AuditLog" enable row level security;
alter table if exists "Notification" enable row level security;
alter table if exists "Semester" enable row level security;
alter table if exists "Course" enable row level security;
alter table if exists "UserPreference" enable row level security;
alter table if exists "NotePage" enable row level security;
alter table if exists "AiNoteEdit" enable row level security;
alter table if exists "AiTaskEdit" enable row level security;
alter table if exists "BoardAiChat" enable row level security;
alter table if exists "NoteDeadline" enable row level security;
