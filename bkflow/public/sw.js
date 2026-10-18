// UniFlow reminder service worker. Scope "/". It caches nothing and never stores auth tokens.
// Push payload is only { deliveryId, bindingId, displayToken }; the text shown is always generic.
const DB = "uniflow-push";
const SEEN_TTL_MS = 24 * 60 * 60 * 1000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same DB/store as web/lib/desktop-notifications.ts (binding + seen delivery ids).
const idb = (mode, run) =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("kv", mode);
      const request = run(tx.objectStore("kv"));
      tx.oncomplete = () => { db.close(); resolve(request && request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
const get = (key) => idb("readonly", (s) => s.get(key));
const put = (key, value) => idb("readwrite", (s) => s.put(value, key));

const pruneSeen = () =>
  idb("readwrite", (s) => {
    const cursorRequest = s.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith("seen:") && Date.now() - cursor.value > SEEN_TTL_MS) cursor.delete();
      cursor.continue();
    };
    return cursorRequest;
  });

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const handlePush = async (event) => {
  let data = null;
  try { data = event.data.json(); } catch { /* malformed: ignore */ }
  if (!data || !ID.test(data.deliveryId || "") || typeof data.displayToken !== "string") return;

  // Logged out, switched account or never enabled here: show nothing.
  const binding = await get("binding");
  if (!binding || binding.bindingId !== data.bindingId) return;
  if (await get("seen:" + data.deliveryId)) return;

  let allowed = false;
  try {
    const res = await fetch("/api/push/display", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ deliveryId: data.deliveryId, displayToken: data.displayToken }),
    });
    allowed = res.ok && (await res.json()).allowed === true;
  } catch { /* offline: do not show stale data */ }
  if (!allowed) return;

  // Binding may have been cleared while we were waiting for the network.
  const again = await get("binding");
  if (!again || again.bindingId !== data.bindingId) return;

  // Marked before showing: a crash in between loses one reminder instead of duplicating it.
  await put("seen:" + data.deliveryId, Date.now());
  await self.registration.showNotification("UniFlow", {
    body: "Bạn có một nhắc hạn. Mở UniFlow để xem.",
    tag: "reminder:" + data.deliveryId,
    icon: "/logo.png",
    data: { deliveryId: data.deliveryId },
  });
  await pruneSeen().catch(() => {});
};

self.addEventListener("push", (event) => event.waitUntil(handlePush(event)));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deliveryId = event.notification.data && event.notification.data.deliveryId;
  if (!ID.test(deliveryId || "")) return;

  // Same-origin path only; the app resolves the delivery after sign-in and checks access.
  const url = "/reminders/" + deliveryId;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    }),
  );
});
