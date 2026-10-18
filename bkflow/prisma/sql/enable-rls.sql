-- Enable RLS on all public tables so the PostgREST / anon API cannot read or write them.
-- Prisma connects via the postgres role which bypasses RLS, so the app is unaffected.
alter table "Board" enable row level security;
alter table "List" enable row level security;
alter table "Card" enable row level security;
alter table "CardLabel" enable row level security;
alter table "Label" enable row level security;
alter table "Comment" enable row level security;
alter table "CommentReaction" enable row level security;
alter table "Checklist" enable row level security;
alter table "ChecklistItem" enable row level security;
alter table "CardDependency" enable row level security;
alter table "CardAttachment" enable row level security;
alter table "CardUserState" enable row level security;
alter table "AuditLog" enable row level security;
alter table "Notification" enable row level security;
alter table "Semester" enable row level security;
alter table "Course" enable row level security;
alter table "UserPreference" enable row level security;
alter table "NotePage" enable row level security;
alter table "AiNoteEdit" enable row level security;
alter table "AiChatSession" enable row level security;
