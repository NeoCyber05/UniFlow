// Browser side of desktop reminders. Everything environment-specific goes through `DesktopEnv` so tests use fakes.

export type DesktopReminderResult = { state: "enabled" | "denied" | "unsupported" | "error" };
export type DesktopReminderState = "enabled" | "disabled" | "denied" | "unsupported";

type Binding = { userId: string; subscriptionId: string; bindingId: string };

type PushSubscriptionLike = { toJSON(): unknown; unsubscribe(): Promise<boolean> };
type RegistrationLike = {
  pushManager: {
    getSubscription(): Promise<PushSubscriptionLike | null>;
    subscribe(options: { userVisibleOnly: boolean; applicationServerKey: BufferSource }): Promise<PushSubscriptionLike>;
  };
  getNotifications(): Promise<{ close(): void }[]>;
};

export type DesktopEnv = {
  supported(): boolean;
  permission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  getUserId(): Promise<string | null>;
  api(path: string, init?: RequestInit): Promise<Response>;
  registerWorker(): Promise<RegistrationLike>;
  store: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void>; delete(key: string): Promise<void> };
};

const BINDING_KEY = "binding";

// IndexedDB (not localStorage) so every tab and the service worker see the same binding. Same DB/store names as public/sw.js.
const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("uniflow-push", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kv");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idb = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction("kv", mode).objectStore("kv"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

export const browserEnv = (): DesktopEnv => ({
  supported: () =>
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && "indexedDB" in window,
  permission: () => Notification.permission,
  requestPermission: () => Notification.requestPermission(),
  getUserId: async () => {
    // Loaded lazily so importing this module never requires Supabase env (tests).
    const { supabase } = await import("./supabase");
    return (await supabase.auth.getSession()).data.session?.user.id ?? null;
  },
  api: (path, init) => fetch(path, init),
  registerWorker: async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return navigator.serviceWorker.ready as unknown as Promise<RegistrationLike>;
  },
  store: {
    get: async (key) => (await idb("readonly", (s) => s.get(key))) ?? null,
    set: async (key, value) => { await idb("readwrite", (s) => s.put(value, key)); },
    delete: async (key) => { await idb("readwrite", (s) => s.delete(key)); },
  },
});

export const urlBase64ToUint8Array = (value: string) => {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const readBinding = async (env: DesktopEnv) => (await env.store.get(BINDING_KEY)) as Binding | null;

export const getDesktopReminderState = async (env: DesktopEnv = browserEnv()): Promise<DesktopReminderState> => {
  if (!env.supported()) return "unsupported";
  if (env.permission() === "denied") return "denied";
  return (await readBinding(env)) && env.permission() === "granted" ? "enabled" : "disabled";
};

/** Chỉ gọi khi người dùng bấm nút; không bao giờ tự xin quyền. */
export const enableDesktopReminders = async (env: DesktopEnv = browserEnv()): Promise<DesktopReminderResult> => {
  if (!env.supported()) return { state: "unsupported" };

  try {
    let permission = env.permission();
    if (permission === "default") permission = await env.requestPermission();
    if (permission !== "granted") return { state: "denied" };

    const userId = await env.getUserId();
    if (!userId) return { state: "error" };

    const config = await env.api("/api/push/config");
    const publicKey = config.ok ? ((await config.json()) as { publicKey: string | null }).publicKey : null;
    if (!publicKey) return { state: "error" };

    const registration = await env.registerWorker();
    const subscription = (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      }));

    const res = await env.api("/api/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    // Browser permission alone is not "enabled": only a stored server registration is.
    if (!res.ok) return { state: "error" };

    const { subscriptionId, bindingId } = (await res.json()) as { subscriptionId: string; bindingId: string };
    await env.store.set(BINDING_KEY, { userId, subscriptionId, bindingId } satisfies Binding);
    return { state: "enabled" };
  } catch {
    return { state: "error" };
  }
};

/** Local binding goes first, so a failing network can never leave it enabled. */
export const disableDesktopReminders = async (env: DesktopEnv = browserEnv()): Promise<void> => {
  const binding = await readBinding(env);
  if (!binding) return;

  await env.store.delete(BINDING_KEY);

  let registration: RegistrationLike | null = null;
  try {
    registration = await env.registerWorker();
    for (const notification of await registration.getNotifications()) notification.close();
  } catch { /* best effort */ }

  try {
    await env.api("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscriptionId: binding.subscriptionId }),
    });
  } catch { /* offline or already signed out: unsubscribe below still invalidates the endpoint */ }

  try {
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
  } catch { /* best effort */ }
};

/** Auth changed (sign-out here or in another tab, or another account): a binding of a different user must not survive. */
export const reconcileDesktopReminders = async (userId: string | null, env: DesktopEnv = browserEnv()): Promise<void> => {
  const binding = await readBinding(env);
  if (binding && binding.userId !== userId) await disableDesktopReminders(env);
};
