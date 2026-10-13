import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createTerminology,
  getBuildIds,
  getBuildStatus,
  getNextBuildSteps,
} from "../assets/build.js";
import { parseBackup } from "../assets/model.js";

const read = async (name) =>
  JSON.parse(
    await readFile(new URL(`../data/${name}.json`, import.meta.url), "utf8"),
  );
const [build, tips, terminology, guide] = await Promise.all(
  ["build", "tips", "terminology", "guide"].map(read),
);

test("inventory, application, skips and route completion are separate decisions", () => {
  const [first, second] = build.stages;
  const completed = new Set(first.routeIds);
  assert.equal(getBuildStatus(first, completed), "missing");
  completed.add(`${second.id}-obtained`);
  assert.equal(getNextBuildSteps(build.stages, completed)[0], second);
  assert.equal(getBuildStatus(second, completed), "ready");
  completed.add(`${second.id}-applied`);
  assert.equal(getBuildStatus(second, completed), "done");
  assert.equal(getNextBuildSteps(build.stages, completed)[0], first);
  const optional = build.stages.find((stage) => stage.optional);
  completed.add(`${optional.id}-skipped`);
  assert.equal(getBuildStatus(optional, completed), "skipped");
  assert.ok(!getNextBuildSteps([optional], completed).length);
  assert.equal(
    getBuildStatus(first, new Set([`${first.id}-skipped`])),
    "missing",
  );
});

test("backup keeps new checks without changing the existing format or route IDs", () => {
  const ids = getBuildIds(build.stages);
  assert.equal(new Set(ids).size, ids.length);
  const known = new Set([
    ...ids,
    ...tips.reminders.map((item) => item.id),
    "act-1-step-026",
  ]);
  const old = {
    app: "hellisus-cheatsheet",
    version: 1,
    completed: ["act-1-step-026"],
  };
  assert.deepEqual(
    parseBackup(JSON.stringify(old), known).completed,
    old.completed,
  );
  const updated = { ...old, completed: [...old.completed, ids[0], "tip-farm"] };
  assert.deepEqual(
    parseBackup(JSON.stringify(updated), known).completed,
    updated.completed,
  );
});

test("every build milestone, tip and loop links to real route actions and evidence", () => {
  const routeIds = new Set(
    guide.sections.flatMap((section) => section.items.map((item) => item.id)),
  );
  assert.equal(build.stages.length, 22);
  assert.equal(tips.loops.length, 14);
  assert.equal(new Set(tips.loops.map((loop) => loop.routeIds[0])).size, 14);
  for (const [catalogue, entries] of [
    [build, build.stages],
    [tips, [...tips.reminders, ...tips.loops]],
  ]) {
    for (const entry of entries) {
      for (const id of entry.routeIds)
        assert.ok(routeIds.has(id), `${entry.id}: unknown route ${id}`);
      assert.ok(
        catalogue.sources[entry.source]?.url.startsWith("https://"),
        entry.id,
      );
      for (const language of ["ru", "en"]) assert.ok(entry.title[language]);
    }
  }
  for (const entry of terminology.entries) {
    assert.ok(entry.ru && entry.en);
    assert.ok(["community", "unverified"].includes(entry.status));
    if (entry.status === "community") assert.ok(entry.sources.length);
    for (const source of entry.sources) assert.ok(terminology.sources[source]);
  }
});

test("terminology preserves originals and explicitly labels uncertain translations", () => {
  const translate = createTerminology(terminology.entries);
  assert.equal(
    translate("Mark of the Betrayed", "ru"),
    "Метка обманутого (Mark of the Betrayed)",
  );
  assert.equal(
    translate("Animosity — Enhanced", "ru"),
    "Неприязнь — сильный (Animosity — Enhanced)",
  );
  assert.match(translate("Polearm of Grief", "ru"), /†/);
  assert.equal(translate("Animosity – Elite", "en"), "Animosity – Elite");
  assert.equal(translate("Chromatic Shielding", "ru"), "Chromatic Shielding");
  assert.match(
    translate("Aster's Band of Domination", "ru"),
    /^Кольцо верховенства Астера/,
  );
});
