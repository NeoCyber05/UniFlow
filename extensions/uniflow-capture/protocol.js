// Pure logic of the service worker: message validation, pending drafts, sender checks.
// Kept free of `chrome.*` so it runs under `node --test`.

export const CHANNEL = "uniflow-capture";
export const PROTOCOL_VERSION = 1;
export const REQUEST_TTL_MS = 15 * 60_000;
/** Deployed UniFlow; granted at install via host_permissions. Options can switch to localhost for dev. */
export const DEFAULT_UNIFLOW_ORIGIN = "https://uniflow-production-ba94.up.railway.app";

const TEXT_MAX = 4_000;
const URL_MAX = 2_048;
const TITLE_MAX = 200;
const POPUP = { width: 440, height: 640 };
const KEY_PREFIX = "capture:";
const BRIDGE_TYPES = new Set(["CAPTURE_READY", "CAPTURE_SAVED", "CAPTURE_CANCEL"]);

/** Hosts the user can enable. Exact origins only; no <all_urls>. */
export const SOURCE_HOSTS = [
  { id: "slack", label: "Slack (app.slack.com)", patterns: ["https://app.slack.com/*"] },
  {
    id: "teams",
    label: "Microsoft Teams (web)",
    patterns: ["https://teams.microsoft.com/*", "https://teams.live.com/*", "https://teams.cloud.microsoft/*"],
  },
];

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/** Patterns here are always "<scheme>://<host>/*". */
export const matchesPattern = (url, pattern) => originOf(url) === pattern.replace(/\/\*$/, "");

/** http(s) only; drops credentials, query and fragment (they can hold tokens or ids). */
export const sanitizeUrl = (value) => {
  if (typeof value !== "string" || value.length > URL_MAX) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
};

const readTime = (value) => {
  if (typeof value !== "string") return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** Validates the content script payload; returns null when unusable. */
export const readCaptureRequest = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const selectedText = typeof payload.selectedText === "string" ? payload.selectedText.trim() : "";
  if (!selectedText || selectedText.length > TEXT_MAX) return null;
  const pageTitle = typeof payload.pageTitle === "string" ? payload.pageTitle.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX) : "";
  const anchor = payload.anchor && typeof payload.anchor === "object" ? payload.anchor : {};
  return {
    selectedText,
    pageUrl: sanitizeUrl(payload.pageUrl),
    pageTitle: pageTitle || undefined,
    messageSentAt: readTime(payload.messageSentAt),
    anchor: {
      x: finite(anchor.x),
      y: finite(anchor.y),
      availLeft: finite(anchor.availLeft) ?? 0,
      availTop: finite(anchor.availTop) ?? 0,
      availWidth: finite(anchor.availWidth),
      availHeight: finite(anchor.availHeight),
    },
  };
};

const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(value, max)));

/** Popup just below the selection, clamped to the screen work area. */
export const popupBounds = (anchor) => {
  if (!anchor || anchor.x === undefined || anchor.y === undefined || !anchor.availWidth || !anchor.availHeight) return { ...POPUP };
  return {
    left: clamp(anchor.x, anchor.availLeft, anchor.availLeft + anchor.availWidth - POPUP.width),
    top: clamp(anchor.y + 8, anchor.availTop, anchor.availTop + anchor.availHeight - POPUP.height),
    ...POPUP,
  };
};

/** Pending drafts in chrome.storage.session: survives worker restarts, gone when the browser closes. */
export const createStore = (area) => ({
  get: async (requestId) => (typeof requestId === "string" ? (await area.get(KEY_PREFIX + requestId))[KEY_PREFIX + requestId] ?? null : null),
  put: (record) => area.set({ [KEY_PREFIX + record.requestId]: record }),
  remove: (requestId) => area.remove(KEY_PREFIX + requestId),
  all: async () => Object.entries(await area.get(null)).filter(([key]) => key.startsWith(KEY_PREFIX)).map(([, value]) => value),
});

/** Error code when a bridge message may not touch this draft, else null. */
export const checkBridgeSender = (record, sender, now) => {
  if (!record || record.expiresAt <= now) return "missing";
  if (sender.frameId !== 0) return "wrong-frame";
  if (originOf(sender.url) !== record.uniflowOrigin) return "wrong-origin";
  if (!sender.tab || sender.tab.id !== record.targetTabId) return "wrong-tab";
  return null;
};

const captureUrl = (record) => `${record.uniflowOrigin}/capture#request=${record.requestId}`;

export const createHandler = ({ store, extensionId, clock, timeZone, randomId, getConfig, openPopup, openOptions }) => {
  const purgeExpired = async (now) => {
    for (const record of await store.all()) if (record.expiresAt <= now) await store.remove(record.requestId);
  };

  const open = async (record, bounds) => {
    // Stored before the window exists; READY arriving before targetTabId is set fails and the page retries.
    await store.put(record);
    const targetTabId = await openPopup(captureUrl(record), bounds);
    await store.put({ ...record, targetTabId });
  };

  const handle = async (message, sender) => {
    if (!message || message.channel !== CHANNEL || message.v !== PROTOCOL_VERSION) return { ok: false, error: "bad-message" };
    if (!sender || sender.id !== extensionId) return { ok: false, error: "bad-sender" };
    const now = clock();
    await purgeExpired(now);

    if (message.type === "CAPTURE_REQUEST") {
      const config = await getConfig();
      if (!config.uniflowOrigin) {
        openOptions();
        return { ok: false, error: "not-configured" };
      }
      if (!sender.tab || typeof sender.frameId !== "number" || !config.sourcePatterns.some((p) => matchesPattern(sender.url, p))) {
        return { ok: false, error: "host-not-granted" };
      }
      const payload = readCaptureRequest(message.payload);
      if (!payload) return { ok: false, error: "invalid" };
      const { anchor, ...fields } = payload;
      const source = Object.fromEntries(Object.entries({
        ...fields,
        capturedAt: new Date(now).toISOString(),
        timeZone,
      }).filter(([, value]) => value !== undefined));
      await open({
        requestId: randomId(),
        source,
        sourceTabId: sender.tab.id,
        sourceFrameId: sender.frameId,
        targetTabId: null,
        uniflowOrigin: config.uniflowOrigin,
        createdAt: now,
        expiresAt: now + REQUEST_TTL_MS,
      }, popupBounds(anchor));
      return { ok: true };
    }

    if (BRIDGE_TYPES.has(message.type)) {
      const record = await store.get(message.requestId);
      const error = checkBridgeSender(record, sender, now);
      if (error) return { ok: false, error };
      if (message.type === "CAPTURE_READY") return { ok: true, source: record.source };
      await store.remove(record.requestId);
      return { ok: true };
    }

    return { ok: false, error: "bad-message" };
  };

  /** Toolbar click: reopen the newest unexpired draft (popup closed by mistake). */
  const reopenLatest = async () => {
    const now = clock();
    await purgeExpired(now);
    const latest = (await store.all()).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!latest) return false;
    await open(latest, popupBounds(undefined));
    return true;
  };

  return { handle, reopenLatest };
};
