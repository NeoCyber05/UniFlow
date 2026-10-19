// Page side of the UniFlow Capture extension handshake (extensions/uniflow-capture/bridge.js).

export const CAPTURE_CHANNEL = "uniflow-capture";

export type BridgeWindow = Pick<Window, "postMessage" | "addEventListener" | "removeEventListener"> & {
  location: { origin: string };
};

export type CaptureSourceResult =
  | { ok: true; source: unknown }
  | { ok: false; reason: string };

// "wrong-tab": the worker has not recorded this popup's tab yet; anything else is final.
const RETRYABLE = new Set(["wrong-tab"]);

export const readCaptureRequestId = (hash: string) => hash.match(/^#request=([0-9a-f-]{36})$/i)?.[1] ?? null;

const post = (win: BridgeWindow, type: string, requestId: string) =>
  win.postMessage({ channel: CAPTURE_CHANNEL, v: 1, from: "app", type, requestId }, win.location.origin);

/** Asks the extension for the selected text of this request. `source` is untrusted: validate it. */
export const requestCaptureSource = (
  requestId: string,
  { win = window as BridgeWindow, timeoutMs = 6_000, intervalMs = 400 }: { win?: BridgeWindow; timeoutMs?: number; intervalMs?: number } = {},
) =>
  new Promise<CaptureSourceResult>((resolve) => {
    const finish = (result: CaptureSourceResult) => {
      clearInterval(interval);
      clearTimeout(timeout);
      win.removeEventListener("message", onMessage);
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== win || event.origin !== win.location.origin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.channel !== CAPTURE_CHANNEL || data.v !== 1 || data.from !== "bridge") return;
      // The bridge may load after the page: answer its hello right away.
      if (data.type === "BRIDGE_READY") return post(win, "CAPTURE_READY", requestId);
      if (data.requestId !== requestId) return;
      if (data.type === "CAPTURE_DRAFT") finish({ ok: true, source: data.source });
      if (data.type === "CAPTURE_UNAVAILABLE" && !RETRYABLE.has(String(data.reason))) finish({ ok: false, reason: String(data.reason) });
    };
    win.addEventListener("message", onMessage);
    const interval = setInterval(() => post(win, "CAPTURE_READY", requestId), intervalMs);
    const timeout = setTimeout(() => finish({ ok: false, reason: "no-extension" }), timeoutMs);
    post(win, "CAPTURE_READY", requestId);
  });

export const notifyCapture = (requestId: string, type: "CAPTURE_SAVED" | "CAPTURE_CANCEL", win: BridgeWindow = window) =>
  post(win, type, requestId);

/** Version of the installed UniFlow Capture extension (bridge.js marks <html> at document_start), else null. */
export const getCaptureExtensionVersion = () =>
  typeof document === "undefined" ? null : document.documentElement.dataset.uniflowCapture ?? null;
