// Runs only on hosts the user granted. Reads nothing until the user selects text, and sends
// nothing until a real click on the button. Never reads the conversation around the selection,
// except the single timestamp of the message that contains it.
(() => {
  if (window.__uniflowCaptureLoaded) return;
  window.__uniflowCaptureLoaded = true;

  const CHANNEL = "uniflow-capture";
  const TEXT_MAX = 4_000;
  const SENSITIVE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
  const MAX_DEPTH = 12;
  const YEAR_MS = 366 * 24 * 3_600_000;

  let host = null;
  let button = null;
  let pending = null;

  const elementOf = (node) => (node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement ?? null);

  const parseTimestamp = (el) => {
    const raw = el.getAttribute("datetime") ?? el.getAttribute("data-ts");
    if (!raw) return undefined;
    // Slack: data-ts="1697600000.123456" (epoch seconds). Teams: <time datetime="ISO">.
    const time = /^\d{9,11}(\.\d+)?$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw);
    if (!Number.isFinite(time)) return undefined;
    const now = Date.now();
    if (time > now + 5 * 60_000 || time < now - YEAR_MS) return undefined;
    return new Date(time).toISOString();
  };

  /**
   * Sent time of the message holding the selection: walk up from the selection to the first
   * ancestor that contains a timestamp. Exactly one → use it; several → ambiguous, give up
   * (the app then asks the user to confirm the date).
   */
  const findMessageTime = (range) => {
    let el = elementOf(range.commonAncestorContainer);
    for (let depth = 0; el && el !== document.body && depth < MAX_DEPTH; depth++, el = el.parentElement) {
      const found = el.querySelectorAll("time[datetime], [data-ts]");
      if (found.length === 1) return parseTimestamp(found[0]);
      if (found.length > 1) return undefined;
    }
    return undefined;
  };

  const hide = () => {
    if (host) host.style.display = "none";
    pending = null;
  };

  const ensureButton = () => {
    if (host) return;
    host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:2147483647;display:none;";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>
      button{font:500 13px system-ui,sans-serif;color:#fff;background:#2563eb;border:0;border-radius:8px;padding:6px 10px;
        box-shadow:0 4px 12px rgba(0,0,0,.2);cursor:pointer}
      button:hover{background:#1d4ed8} button:disabled{background:#64748b;cursor:default}
      button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
    </style><button type="button">+ Thêm vào UniFlow</button>`;
    button = shadow.querySelector("button");
    // Keep the page selection while clicking.
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", onClick);
    document.documentElement.appendChild(host);
  };

  const show = (rect, tooLong) => {
    ensureButton();
    button.disabled = tooLong;
    button.textContent = tooLong ? "Đoạn chọn quá dài (tối đa 4000 ký tự)" : "+ Thêm vào UniFlow";
    host.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 260))}px`;
    host.style.top = `${rect.bottom + 6 > window.innerHeight - 40 ? Math.max(4, rect.top - 40) : rect.bottom + 6}px`;
    host.style.display = "block";
  };

  const onSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return hide();
    const range = selection.getRangeAt(0);
    if (elementOf(range.startContainer)?.closest(SENSITIVE) || elementOf(range.endContainer)?.closest(SENSITIVE)) return hide();
    const text = selection.toString().trim();
    if (!text) return hide();
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return hide();
    // Kept in memory only; nothing leaves the page before the click.
    pending = { text, rect, messageSentAt: findMessageTime(range) };
    show(rect, text.length > TEXT_MAX);
  };

  async function onClick(event) {
    if (!event.isTrusted || !pending || pending.text.length > TEXT_MAX) return;
    const { text, rect, messageSentAt } = pending;
    const chromeHeight = Math.max(0, window.outerHeight - window.innerHeight);
    button.disabled = true;
    button.textContent = "Đang mở UniFlow…";
    try {
      const response = await chrome.runtime.sendMessage({
        channel: CHANNEL,
        v: 1,
        type: "CAPTURE_REQUEST",
        payload: {
          selectedText: text,
          pageUrl: location.href,
          pageTitle: document.title,
          messageSentAt,
          anchor: {
            x: window.screenX + rect.left,
            y: window.screenY + chromeHeight + rect.bottom,
            availLeft: screen.availLeft ?? 0,
            availTop: screen.availTop ?? 0,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
          },
        },
      });
      if (response?.ok) return hide();
      button.textContent = response?.error === "not-configured" ? "Chưa cài đặt địa chỉ UniFlow" : "Không mở được UniFlow";
    } catch {
      // Extension reloaded or removed: this copy of the script is orphaned.
      hide();
    }
  }

  document.addEventListener("mouseup", () => setTimeout(onSelection, 0), true);
  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") return hide();
    if (event.shiftKey || event.key === "Shift") setTimeout(onSelection, 0);
  }, true);
  document.addEventListener("selectionchange", () => {
    if (window.getSelection()?.isCollapsed) hide();
  });
  window.addEventListener("scroll", hide, true);
  window.addEventListener("blur", hide);
})();
