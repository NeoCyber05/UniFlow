import assert from "node:assert/strict";
import test from "node:test";
import { THEME_PRESETS, getActivePreset, createAppearanceQueue } from "./appearance-presets";

test("default preset and legacy pair need no preference rewrite", () => {
  assert.equal(getActivePreset({ accent: "blue", background: "glow" }), "classic");
  assert.equal(getActivePreset({ accent: "violet", background: "plain" }), "legacy");
  assert.deepEqual(THEME_PRESETS.map(p => [p.accent, p.background]), [["blue", "glow"], ["violet", "lavender"], ["emerald", "mint"]]);
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
