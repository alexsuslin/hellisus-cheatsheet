import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getBuildIds } from "../assets/build.js";
import { createTransferUrl, parseTransferHash } from "../assets/transfer.js";
import { transferIds } from "../assets/transfer-catalog.js";

const readData = async (name) =>
  JSON.parse(
    await readFile(new URL(`../data/${name}.json`, import.meta.url), "utf8"),
  );
const [guide, achievements, build, tips] = await Promise.all(
  ["guide", "achievements", "build", "tips"].map(readData),
);
const knownIds = new Set([
  ...guide.sections.flatMap((section) => section.items.map((item) => item.id)),
  ...achievements.achievements.map((item) => item.id),
  ...getBuildIds(build.stages),
  ...tips.reminders.map((item) => item.id),
]);

test("a transfer preserves route, trophy, build, tips and current step under the repository path", () => {
  const completed = [
    guide.sections[0].items[0].id,
    achievements.achievements[0].id,
    "build-jeljin-obtained",
    tips.reminders[0].id,
  ];
  const state = {
    completed: new Set(completed),
    currentItemId: guide.sections[0].items[1].id,
    language: "ru",
    theme: "dark",
  };
  const url = new URL(
    createTransferUrl(
      "https://example.github.io/hellisus-cheatsheet/?old=1#current",
      state,
    ),
  );
  assert.equal(url.pathname, "/hellisus-cheatsheet/");
  assert.equal(url.search, "");
  const restored = parseTransferHash(url.hash, knownIds);
  assert.deepEqual(new Set(restored.completed), new Set(completed));
  assert.equal(restored.currentItemId, state.currentItemId);
  assert.equal(restored.language, "ru");
  assert.equal(restored.theme, "dark");
});

test("a previously issued version-1 link keeps its original meaning", () => {
  const hash =
    "#progress=1.AgArAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.f7aeead9";
  assert.deepEqual(parseTransferHash(hash, knownIds), {
    completed: ["act-1-starting-worn-cap"],
    currentItemId: "act-1-step-003",
    language: "ru",
    theme: "dark",
  });
});

test("full and empty saves fit a short QR link and round trip without adding checks", () => {
  for (const completed of [[], [...knownIds]]) {
    const url = new URL(
      createTransferUrl("https://alexsuslin.github.io/hellisus-cheatsheet/", {
        completed,
        language: "en",
        theme: "light",
      }),
    );
    assert.ok(
      url.href.length < 250,
      `QR link is ${url.href.length} characters`,
    );
    const result = parseTransferHash(url.hash, knownIds);
    assert.deepEqual(new Set(result.completed), new Set(completed));
    assert.equal(result.currentItemId, undefined);
    assert.equal(result.language, "en");
    assert.equal(result.theme, "light");
  }
});

test("corrupted, truncated, oversized and future links cannot replace a save", () => {
  const hash = new URL(
    createTransferUrl("https://example.com/", {
      completed: [],
      language: "ru",
      theme: "dark",
    }),
  ).hash;
  for (const invalid of [
    "#progress=",
    hash.slice(0, -1),
    hash.replace("progress=1.", "progress=2."),
    `${hash}A`,
    `#progress=${"a".repeat(10000)}`,
    hash.replace(/.$/, hash.endsWith("0") ? "1" : "0"),
  ]) {
    assert.throws(() => parseTransferHash(invalid, knownIds));
  }
  assert.equal(parseTransferHash("#current", knownIds), null);
});

test("removed IDs are ignored, but unmapped outgoing progress is never silently lost", () => {
  const id = guide.sections[0].items[0].id;
  const hash = new URL(
    createTransferUrl("https://example.com/", {
      completed: [id],
      currentItemId: id,
      language: "ru",
      theme: "dark",
    }),
  ).hash;
  assert.deepEqual(parseTransferHash(hash, new Set()), {
    completed: [],
    language: "ru",
    theme: "dark",
  });
  assert.throws(() =>
    createTransferUrl("https://example.com/", {
      completed: ["future-unmapped-id"],
      language: "ru",
      theme: "dark",
    }),
  );
});

test("the transfer catalogue covers all current progress and has no duplicate slots", () => {
  assert.equal(new Set(transferIds).size, transferIds.length);
  for (const id of knownIds)
    assert.ok(
      transferIds.includes(id),
      `Append ${id} to the transfer catalogue`,
    );
  // Existing positions are a wire contract: append new IDs, never reorder old ones.
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(transferIds.slice(0, 551)))
      .digest("hex"),
    "bd1e0c09bef395b226791e6e1016b3d420382d40efd3cca5900843b3a363a46c",
  );
});
