import assert from "node:assert/strict";
import test from "node:test";
import { THEME_PRESETS, ALL_THEME_PRESETS, THEME_COLLECTIONS, getActivePreset, createAppearanceQueue } from "./appearance-presets";
import { BACKGROUNDS, isAccentId, isBackgroundId } from "@/constants/appearance";
import { UpdateAppearance } from "@/actions/appearance/update-appearance/schema";
import { existsSync, readFileSync } from "node:fs";

test("default preset and legacy pair need no preference rewrite", () => {
  assert.equal(getActivePreset({ accent: "blue", background: "glow" }), "classic");
  assert.equal(getActivePreset({ accent: "violet", background: "plain" }), "legacy");
  assert.deepEqual(THEME_PRESETS.map(p => [p.accent, p.background]), [["blue", "glow"], ["violet", "lavender"], ["emerald", "mint"]]);
});

test("curated gallery has twelve distinct valid themes and four per collection", () => {
  assert.equal(ALL_THEME_PRESETS.length, 12);
  assert.equal(new Set(ALL_THEME_PRESETS.map(p => p.id)).size, 12);
  assert.equal(new Set(ALL_THEME_PRESETS.map(p => `${p.accent}:${p.background}`)).size, 12);
  for (const collection of THEME_COLLECTIONS) {
    assert.equal(ALL_THEME_PRESETS.filter(p => p.category === collection.id).length, 4);
  }
  for (const preset of ALL_THEME_PRESETS) {
    assert.ok(isAccentId(preset.accent));
    assert.ok(isBackgroundId(preset.background));
    assert.ok(UpdateAppearance.safeParse({ accent: preset.accent, background: preset.background }).success);
  }
});

test("illustrated themes use the same self-contained SVG for thumbnail and wallpaper", () => {
  const illustrated = ALL_THEME_PRESETS.filter(p => p.category !== "essentials");
  assert.equal(illustrated.length, 8);
  for (const preset of illustrated) {
    const background = BACKGROUNDS.find(item => item.id === preset.background);
    assert.ok(background?.artwork);
    assert.equal(background.style.backgroundImage, `url("${background.artwork}")`);
    assert.ok(existsSync(`public${background.artwork}`), preset.id);
    const svg = readFileSync(`public${background.artwork}`, "utf8");
    assert.match(svg, /viewBox="0 0 960 540"/);
    assert.doesNotMatch(svg, /<script|<foreignObject|<image|(?:href|src)=["']https?:/i);
  }
  assert.ok(isBackgroundId("graph-paper"), "Existing custom backgrounds remain supported");
  assert.equal(getActivePreset({ accent: "navy", background: "blueprint" }), "legacy");
});
test("rapid preset choices serialize and latest failure rolls back to last saved pair", async () => {
  const writes: unknown[] = []; const states: unknown[] = []; const errors: string[] = [];
  const queue = createAppearanceQueue({ initial: { accent: "blue", background: "glow" }, owner: "u1", getOwner: () => "u1",
    save: async patch => { writes.push(patch); return writes.length === 1 ? { data: { accent: "emerald", background: "mint" } } : { error: "offline" }; },
    onChange: a => states.push(a), onStatus: () => {}, onError: e => errors.push(e) });
  const first = queue.update({ accent: "emerald", background: "mint" });
  await queue.update({ accent: "violet", background: "lavender" }); await first;
  assert.deepEqual(states.at(-1), { accent: "emerald", background: "mint" });
  assert.deepEqual(errors, ["offline"]);
});
test("queued changes cannot save to another account, or after disposal", async () => {
  let owner = "u1"; let writes = 0;
  const queue = createAppearanceQueue({ initial: { accent: "blue", background: "glow" }, owner, getOwner: () => owner,
    save: async () => { writes++; return { error: "unused" }; }, onChange: () => {}, onStatus: () => {}, onError: () => {} });
  const pending = queue.update({ accent: "emerald", background: "mint" }); owner = "u2";
  await pending; assert.equal(writes, 0);
  queue.dispose(); await queue.update({ accent: "violet", background: "lavender" }); assert.equal(writes, 0);
});
test("preset patch never sends a stale page style", async () => {
  let sent: unknown;
  const queue = createAppearanceQueue({ initial: { accent: "blue", background: "glow" }, owner: "u1", getOwner: () => "u1",
    save: async patch => { sent = patch; return { data: { accent: "emerald", background: "mint" } }; }, onChange: () => {}, onStatus: () => {}, onError: () => {} });
  await queue.update({ accent: "emerald", background: "mint" });
  assert.deepEqual(sent, { accent: "emerald", background: "mint", expectedUserId: "u1" });
});
