import { CHANNEL, DEFAULT_UNIFLOW_ORIGIN, SOURCE_HOSTS, createHandler, createStore } from "./protocol.js";

const DEV_BRIDGE_SCRIPT = "uniflow-dev-bridge";

/** Production unless the developer picked localhost in the options page. */
const getUniflowOrigin = async () => {
  const { uniflowOrigin = DEFAULT_UNIFLOW_ORIGIN } = await chrome.storage.local.get("uniflowOrigin");
  return (await chrome.permissions.contains({ origins: [`${uniflowOrigin}/*`] })) ? uniflowOrigin : null;
};

const getGrantedSourcePatterns = async () => {
  const { origins = [] } = await chrome.permissions.getAll();
  return SOURCE_HOSTS.flatMap((host) => host.patterns).filter((pattern) => origins.includes(pattern));
};

const handler = createHandler({
  store: createStore(chrome.storage.session),
  extensionId: chrome.runtime.id,
  clock: () => Date.now(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  randomId: () => crypto.randomUUID(),
  getConfig: async () => ({ uniflowOrigin: await getUniflowOrigin(), sourcePatterns: await getGrantedSourcePatterns() }),
  openPopup: async (url, bounds) => {
    const win = await chrome.windows.create({ url, type: "popup", focused: true, ...bounds });
    return win.tabs?.[0]?.id ?? null;
  },
  openOptions: () => chrome.runtime.openOptionsPage(),
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.channel !== CHANNEL) return false;
  handler.handle(message, sender).then(sendResponse, () => sendResponse({ ok: false, error: "internal" }));
  return true;
});

chrome.action.onClicked.addListener(async () => {
  if (!(await handler.reopenLatest())) chrome.tabs.create({ url: `${await getUniflowOrigin() ?? DEFAULT_UNIFLOW_ORIGIN}/capture/welcome` });
});

/** Production pages get bridge.js from the manifest; a localhost dev origin needs it registered at runtime. */
const syncDevBridge = async () => {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [DEV_BRIDGE_SCRIPT] });
  if (registered.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [DEV_BRIDGE_SCRIPT] });
  const origin = await getUniflowOrigin();
  if (!origin || origin === DEFAULT_UNIFLOW_ORIGIN) return;
  await chrome.scripting.registerContentScripts([
    { id: DEV_BRIDGE_SCRIPT, matches: [`${origin}/*`], js: ["bridge.js"], runAt: "document_start" },
  ]);
};

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await syncDevBridge();
  if (reason === "install") chrome.tabs.create({ url: `${DEFAULT_UNIFLOW_ORIGIN}/capture/welcome` });
});
chrome.runtime.onStartup.addListener(syncDevBridge);
chrome.permissions.onAdded.addListener(syncDevBridge);
chrome.permissions.onRemoved.addListener(syncDevBridge);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "uniflowOrigin" in changes) void syncDevBridge();
});
