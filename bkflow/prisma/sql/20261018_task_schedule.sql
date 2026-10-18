-- Additive: independent work schedule + date-only deadline for Card, order revision for Checklist.
-- Idempotent; no backfill, legacy startDate/dueDate untouched.
alter table "Card" add column if not exists "deadlineOn" date;
alter table "Card" add column if not exists "scheduledOn" date;
alter table "Card" add column if not exists "scheduledStartAt" timestamp(3);
alter table "Card" add column if not exists "scheduledEndAt" timestamp(3);
alter table "Checklist" add column if not exists "orderVersion" integer not null default 0;

alter table "Card" drop constraint if exists "Card_deadline_exclusive_check";
alter table "Card" add constraint "Card_deadline_exclusive_check"
  check ("deadlineOn" is null or "dueDate" is null);

alter table "Card" drop constraint if exists "Card_schedule_single_kind_check";
alter table "Card" add constraint "Card_schedule_single_kind_check"
  check ("scheduledOn" is null or ("scheduledStartAt" is null and "scheduledEndAt" is null));

alter table "Card" drop constraint if exists "Card_schedule_range_pair_check";
alter table "Card" add constraint "Card_schedule_range_pair_check"
  check (("scheduledStartAt" is null) = ("scheduledEndAt" is null));

alter table "Card" drop constraint if exists "Card_schedule_range_order_check";
alter table "Card" add constraint "Card_schedule_range_order_check"
  check ("scheduledStartAt" is null or "scheduledEndAt" > "scheduledStartAt");
