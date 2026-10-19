import { DEFAULT_UNIFLOW_ORIGIN, SOURCE_HOSTS } from "./protocol.js";

const status = document.getElementById("status");
const originInput = document.getElementById("origin");
const say = (text) => (status.textContent = text);

const normalizeOrigin = (value) => {
  const url = new URL(value.trim());
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.origin !== DEFAULT_UNIFLOW_ORIGIN && !(local && url.protocol === "http:")) {
    throw new Error(`Chỉ dùng ${DEFAULT_UNIFLOW_ORIGIN} hoặc http://localhost khi chạy thử.`);
  }
  return url.origin;
};

const { uniflowOrigin = DEFAULT_UNIFLOW_ORIGIN } = await chrome.storage.local.get("uniflowOrigin");
originInput.value = uniflowOrigin;

document.getElementById("origin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const origin = normalizeOrigin(originInput.value);
    // Must run inside the click: permissions.request needs a user gesture.
    if (!(await chrome.permissions.request({ origins: [`${origin}/*`] }))) return say("Chưa được cấp quyền cho địa chỉ này.");
    const { uniflowOrigin: previous } = await chrome.storage.local.get("uniflowOrigin");
    if (previous && previous !== origin && previous !== DEFAULT_UNIFLOW_ORIGIN) await chrome.permissions.remove({ origins: [`${previous}/*`] }).catch(() => {});
    await chrome.storage.local.set({ uniflowOrigin: origin });
    originInput.value = origin;
    say(`Đã lưu ${origin}.`);
  } catch (error) {
    say(error instanceof Error ? error.message : "Địa chỉ không hợp lệ.");
  }
});

const { origins = [] } = await chrome.permissions.getAll();
const hosts = document.getElementById("hosts");
for (const host of SOURCE_HOSTS) {
  const label = document.createElement("label");
  label.className = "host";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = host.patterns.every((pattern) => origins.includes(pattern));
  box.addEventListener("change", async () => {
    const granted = box.checked
      ? await chrome.permissions.request({ origins: host.patterns })
      : !(await chrome.permissions.remove({ origins: host.patterns }));
    box.checked = granted;
    say(granted ? `Đã bật cho ${host.label}. Tải lại tab đang mở để dùng.` : `Đã tắt cho ${host.label}.`);
  });
  label.append(box, host.label);
  hosts.append(label);
}
