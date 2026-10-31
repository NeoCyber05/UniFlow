import assert from "node:assert/strict";
import { test } from "node:test";

import { formatWorkspaceTitle } from "@/lib/workspaces";

import { getDateFnsLocale, getIntlLocale, intlDateFormat, tr, useLocale } from "./index";
import { ja } from "./messages/ja";
import { vi, type MessageKey } from "./messages/vi";
import { viBoard } from "./messages/vi-board";
import { viCalendar } from "./messages/vi-calendar";
import { viCard } from "./messages/vi-card";
import { viCore } from "./messages/vi-core";
import { viExtra } from "./messages/vi-extra";

const extractPlaceholders = (text: string): string[] =>
  Array.from(text.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();

test("domain message catalogs have disjoint keys and ja covers 100% of vi keys with matching placeholders", () => {
  const catalogs = [
    ["viCore", viCore],
    ["viExtra", viExtra],
    ["viBoard", viBoard],
    ["viCalendar", viCalendar],
    ["viCard", viCard],
  ] as const;

  const seen = new Map<string, string>();
  for (const [name, catalog] of catalogs) {
    for (const key of Object.keys(catalog)) {
      const prev = seen.get(key);
      assert.equal(prev, undefined, `Duplicate i18n key "${key}" in ${prev} and ${name}`);
      seen.set(key, name);
    }
  }

  const viKeys = Object.keys(vi) as MessageKey[];
  const jaKeys = Object.keys(ja);
  assert.equal(jaKeys.length, viKeys.length);

  for (const key of viKeys) {
    assert.ok(key in ja, `Missing ja translation for "${key}"`);
    assert.ok(ja[key].length > 0, `Empty ja translation for "${key}"`);
    assert.deepEqual(
      extractPlaceholders(ja[key]),
      extractPlaceholders(vi[key]),
      `Placeholder mismatch for "${key}": vi="${vi[key]}" vs ja="${ja[key]}"`,
    );
  }
});

test("tr and locale formatters switch between vi and ja cleanly", () => {
  const original = useLocale.getState().locale;
  try {
    useLocale.getState().setLocale("vi");
    assert.equal(tr("settings.title"), "Cài đặt");
    assert.equal(getIntlLocale(), "vi-VN");
    assert.equal(getDateFnsLocale().code, "vi");
    assert.equal(formatWorkspaceTitle("Workspace của tôi"), "Workspace của tôi");
    assert.equal(formatWorkspaceTitle("Custom"), "Custom");

    useLocale.getState().setLocale("ja");
    assert.equal(tr("settings.title"), ja["settings.title"]);
    assert.notEqual(tr("settings.title"), "Cài đặt");
    assert.equal(getIntlLocale(), "ja-JP");
    assert.equal(getDateFnsLocale().code, "ja");
    assert.equal(formatWorkspaceTitle("Workspace của tôi"), "マイワークスペース");
    assert.equal(formatWorkspaceTitle("Custom"), "Custom");
    assert.match(
      intlDateFormat({ year: "numeric", month: "long", timeZone: "UTC" }).format(new Date("2026-10-15T00:00:00Z")),
      /2026/,
    );
  } finally {
    useLocale.getState().setLocale(original);
  }
});
