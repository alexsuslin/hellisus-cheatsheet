import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAcquisitionEdits } from "../assets/build.js";
import { parseBackup } from "../assets/model.js";
import { STORAGE_KEY, saveProgress } from "../assets/storage.js";

const build = JSON.parse(
  await readFile(new URL("../data/build.json", import.meta.url), "utf8"),
);
const guide = JSON.parse(
  await readFile(new URL("../data/guide.json", import.meta.url), "utf8"),
);

test("acquisition uses merged progress when another tab has just checked a prerequisite", () => {
  const first = "act-2-part-3-step-022";
  const second = "act-2-part-3-step-024";
  let stored = JSON.stringify({ completed: [first] });
  const storage = {
    getItem: () => stored,
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      stored = value;
    },
  };
  const result = saveProgress(
    storage,
    { completed: [second] },
    { id: second, checked: true },
    (completed) => getAcquisitionEdits(build.stages, completed, second),
  );
  assert.deepEqual(
    new Set(result.state.completed),
    new Set([first, second, "build-jeljin-obtained"]),
  );
  assert.deepEqual(JSON.parse(stored).completed, result.state.completed);
});

test("only explicitly audited complete pickup sets confirm acquisition", () => {
  const stage = build.stages.find((entry) => entry.id === "build-jeljin");
  const [first, second] = stage.obtainRouteIds;
  assert.deepEqual(
    getAcquisitionEdits(build.stages, new Set([first]), first),
    [],
  );
  assert.deepEqual(
    getAcquisitionEdits(build.stages, new Set([first, second]), second),
    [{ id: "build-jeljin-obtained", checked: true }],
  );
  assert.deepEqual(
    getAcquisitionEdits(build.stages, new Set([first]), second),
    [],
  );
  assert.deepEqual(
    getAcquisitionEdits(
      build.stages,
      new Set([first, second]),
      "build-jeljin-applied",
    ),
    [],
  );
  const validIds = new Set(
    guide.sections.flatMap((section) => section.items.map((item) => item.id)),
  );
  for (const entry of build.stages)
    for (const id of entry.obtainRouteIds ?? [])
      assert.ok(validIds.has(id), id);
});

test("backups retain Current position, accept old saves and discard stale positions", () => {
  const old = {
    app: "hellisus-cheatsheet",
    version: 1,
    completed: ["route-a"],
  };
  const known = new Set(["route-a"]);
  assert.equal(
    parseBackup(JSON.stringify(old), known).currentItemId,
    undefined,
  );
  assert.equal(
    parseBackup(JSON.stringify({ ...old, currentItemId: "route-a" }), known)
      .currentItemId,
    "route-a",
  );
  assert.equal(
    parseBackup(JSON.stringify({ ...old, currentItemId: "unknown" }), known)
      .currentItemId,
    undefined,
  );
});
