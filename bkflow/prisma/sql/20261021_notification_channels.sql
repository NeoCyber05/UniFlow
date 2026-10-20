-- Additive: external reminder channels (Slack/Teams/Discord webhooks, Telegram) reuse WebPushSubscription.
-- NOT applied to any DB by the code change. Idempotent.
alter table "WebPushSubscription" add column if not exists "channel" text not null default 'webpush';
