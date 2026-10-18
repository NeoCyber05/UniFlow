-- Additive: Web Push subscriptions + durable reminder deliveries. NOT applied to any DB by the code change.
-- Idempotent. Review the duplicate cleanup (last statement before the unique index) on a copy first.
alter table "Card" add column if not exists "reminderGeneration" text;

create table if not exists "WebPushSubscription" (
  "id" text primary key,
  "userId" text not null,
  "endpoint" text not null,
  "p256dh" text not null,
  "auth" text not null,
  "bindingId" text not null,
  "active" boolean not null default true,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);
create unique index if not exists "WebPushSubscription_endpoint_key" on "WebPushSubscription" ("endpoint");
create index if not exists "WebPushSubscription_userId_active_idx" on "WebPushSubscription" ("userId", "active");

create table if not exists "ReminderDelivery" (
  "id" text primary key,
  "cardId" text not null references "Card" ("id") on delete cascade on update cascade,
  "recipientUserId" text not null,
  "subscriptionId" text not null references "WebPushSubscription" ("id") on delete cascade on update cascade,
  "generation" text not null,
  "dueAt" timestamp(3) not null,
  "nextAttemptAt" timestamp(3) not null,
  "expiresAt" timestamp(3) not null,
  "status" text not null default 'pending',
  "attempts" integer not null default 0,
  "claimToken" text,
  "leaseUntil" timestamp(3),
  "displayTokenHash" text,
  "acceptedAt" timestamp(3),
  "errorCode" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);
create unique index if not exists "ReminderDelivery_cardId_generation_subscriptionId_key"
  on "ReminderDelivery" ("cardId", "generation", "subscriptionId");
create index if not exists "ReminderDelivery_status_nextAttemptAt_idx" on "ReminderDelivery" ("status", "nextAttemptAt");
create index if not exists "ReminderDelivery_subscriptionId_idx" on "ReminderDelivery" ("subscriptionId");

-- One in-app card reminder per dedupeKey, so the worker and GET /api/notifications cannot both insert it.
-- Keeps the oldest row of each duplicate group; other notification types are untouched.
delete from "Notification" n
  using "Notification" keep
  where n."type" = 'CARD_REMINDER' and keep."type" = 'CARD_REMINDER'
    and n."dedupeKey" is not null and n."dedupeKey" = keep."dedupeKey"
    and (keep."createdAt", keep."id") < (n."createdAt", n."id");
create unique index if not exists "Notification_card_reminder_dedupe_key"
  on "Notification" ("dedupeKey") where "type" = 'CARD_REMINDER' and "dedupeKey" is not null;
