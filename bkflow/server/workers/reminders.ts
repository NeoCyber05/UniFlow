import * as Sentry from "@sentry/node";

import { db } from "@/lib/db";
import { runReminderBatch, getVapidConfig } from "@/lib/notifications/push-delivery";

const TICK_MS = 15_000;
const BATCH = 50;

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({ dsn, enabled: Boolean(dsn), environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV });

// Without keys every claimed row would be marked unknown; fail loudly instead of draining the queue.
if (!getVapidConfig()) {
  console.error("reminders worker: WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY / WEB_PUSH_SUBJECT must be set");
  process.exit(1);
}

let stopping = false;
let wake: (() => void) | null = null;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => { clearTimeout(timer); resolve(); };
  });

const stop = () => {
  stopping = true;
  wake?.();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

const main = async () => {
  console.log("reminders worker started");

  // Serial ticks: one batch at a time per process, so shutdown only waits for the batch in flight.
  while (!stopping) {
    let full = false;
    try {
      const counts = await runReminderBatch({ now: new Date(), limit: BATCH });
      if (counts.claimed > 0) console.log("reminders batch", JSON.stringify(counts));
      full = counts.claimed >= BATCH;
    } catch (error) {
      Sentry.captureException(error);
      console.error("reminders batch failed", error instanceof Error ? error.message : error);
    }
    if (!full && !stopping) await sleep(TICK_MS);
  }

  await db.$disconnect();
  await Sentry.close(2000);
  console.log("reminders worker stopped");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
