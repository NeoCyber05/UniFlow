// Injected only into <UniFlow origin>/capture*. Relays the page's capture messages to the
// service worker, which checks tab/frame/origin/id before answering. Carries no tokens.
(() => {
  const CHANNEL = "uniflow-capture";
  const FROM_APP = new Set(["CAPTURE_READY", "CAPTURE_SAVED", "CAPTURE_CANCEL"]);
  const post = (message) => window.postMessage({ channel: CHANNEL, v: 1, from: "bridge", ...message }, location.origin);

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.v !== 1 || data.from !== "app") return;
    if (!FROM_APP.has(data.type) || typeof data.requestId !== "string") return;

    chrome.runtime
      .sendMessage({ channel: CHANNEL, v: 1, type: data.type, requestId: data.requestId })
      .then((response) => {
        if (data.type !== "CAPTURE_READY") return;
        post(response?.ok
          ? { type: "CAPTURE_DRAFT", requestId: data.requestId, source: response.source }
          : { type: "CAPTURE_UNAVAILABLE", requestId: data.requestId, reason: response?.error ?? "unknown" });
      })
      .catch(() => post({ type: "CAPTURE_UNAVAILABLE", requestId: data.requestId, reason: "extension" }));
  });

  post({ type: "BRIDGE_READY" });
})();
