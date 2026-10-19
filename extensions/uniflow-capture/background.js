import { CHANNEL, DEFAULT_UNIFLOW_ORIGIN, SOURCE_HOSTS, createHandler, createStore } from "./protocol.js";

const SELECTION_SCRIPT = "uniflow-selection";
const BRIDGE_SCRIPT = "uniflow-bridge";

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
  if (!(await handler.reopenLatest())) chrome.runtime.openOptionsPage();
});

/** Content scripts exist only for hosts the user granted; revoking a host removes them. */
const syncScripts = async () => {
  const registered = await chrome.scripting.getRegisteredContentScripts();
  if (registered.length > 0) await chrome.scripting.unregisterContentScripts({ ids: registered.map((script) => script.id) });

  const sourcePatterns = await getGrantedSourcePatterns();
  const uniflowOrigin = await getUniflowOrigin();
  const scripts = [];
  if (sourcePatterns.length > 0) {
    scripts.push({ id: SELECTION_SCRIPT, matches: sourcePatterns, js: ["selection.js"], allFrames: true, runAt: "document_idle" });
  }
  if (uniflowOrigin) {
    scripts.push({ id: BRIDGE_SCRIPT, matches: [`${uniflowOrigin}/capture*`], js: ["bridge.js"], allFrames: false, runAt: "document_start" });
  }
  if (scripts.length > 0) await chrome.scripting.registerContentScripts(scripts);
};

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await syncScripts();
  if (reason === "install") chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(syncScripts);
chrome.permissions.onAdded.addListener(syncScripts);
chrome.permissions.onRemoved.addListener(syncScripts);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "uniflowOrigin" in changes) void syncScripts();
});
