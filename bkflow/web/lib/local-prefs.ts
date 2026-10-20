// Tùy chọn theo thiết bị (localStorage). Mọi truy cập bọc try/catch: chế độ riêng tư có thể chặn storage.
const read = (key: string) => {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
};

export const START_PATHS = ["/my/today", "/my/calendar", "/my/upcoming", "/pages"] as const;
export type StartPath = (typeof START_PATHS)[number];

export const getStartPath = (): StartPath => {
  const value = read("uniflow-start-path");
  return (START_PATHS as readonly string[]).includes(value ?? "") ? (value as StartPath) : "/my/today";
};
export const setStartPath = (value: StartPath) => write("uniflow-start-path", value);

/** Mức nhắc tự chọn khi thẻ vừa có hạn nộp; "none" = không tự đặt. */
export const getDefaultReminder = () => read("uniflow-reminder-lead") ?? "none";
export const setDefaultReminder = (value: string) => write("uniflow-reminder-lead", value);

export const isSoundEnabled = () => read("uniflow-sound") !== "disabled";
export const setSoundEnabled = (on: boolean) => write("uniflow-sound", on ? "enabled" : "disabled");

export const playChime = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    // Hai nốt C5 -> E5 ngắn.
    for (const [freq, start, end, gain] of [[523.25, 0, 0.3, 0.12], [659.25, 0.1, 0.45, 0.15]] as const) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      vol.gain.setValueAtTime(gain, now + start);
      vol.gain.exponentialRampToValueAtTime(0.001, now + end);
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + end);
    }
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // audio context blocked or unsupported
  }
};

export const playNotificationSound = () => {
  if (isSoundEnabled()) playChime();
};
