import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { filterAchievements, getRelatedItems } from "../assets/achievements.js";
import { getProgress, parseBackup } from "../assets/model.js";

test("related route steps merge explicit links and categories without duplicates", () => {
  const items = [
    { id: "first", categories: ["glyph", "relic"] },
    { id: "second", categories: ["story"] },
    { id: "third", categories: ["relic"] },
  ];
  assert.deepEqual(
    getRelatedItems(
      { route: { categories: ["relic"], itemIds: ["first", "second"] } },
      items,
    ).map((item) => item.id),
    ["first", "second", "third"],
  );
});

test("achievement filters distinguish PS5 platinum and search both languages", () => {
  const achievements = [
    {
      id: "achievement-story",
      category: "story",
      title: { en: "So It Begins", ru: "Начало" },
      description: { en: "Finish act one", ru: "Закончите первый акт" },
      relatedItemIds: ["route-end"],
      missable: false,
    },
    {
      id: "achievement-relic",
      category: "collection",
      title: { en: "Antiquarian", ru: "Антиквар" },
      description: { en: "Collect relics", ru: "Соберите реликвии" },
      hint: {
        en: "Claim rewards from Gildas",
        ru: "Получите награды у Гилдаса",
      },
      warning: { en: "Residents may disappear", ru: "Жители могут исчезнуть" },
      relatedItemIds: ["route-relic"],
      missable: true,
    },
    {
      id: "achievement-platinum",
      platform: "ps5",
      category: "collection",
      title: { en: "Hero", ru: "Герой" },
      description: { en: "Every trophy", ru: "Все трофеи" },
      relatedItemIds: [],
      missable: false,
    },
  ];
  const completed = new Set(["achievement-story", "route-end"]);
  assert.deepEqual(
    filterAchievements(achievements, { query: "гИЛдас" }, completed).map(
      (item) => item.id,
    ),
    ["achievement-relic"],
  );
  assert.deepEqual(
    filterAchievements(achievements, { query: "disappear" }, completed).map(
      (item) => item.id,
    ),
    ["achievement-relic"],
  );
  assert.deepEqual(
    filterAchievements(
      achievements,
      { platform: "common", query: "РЕЛИКВИИ", missableOnly: true },
      completed,
    ).map((item) => item.id),
    ["achievement-relic"],
  );
  assert.equal(
    filterAchievements(achievements, { platform: "common" }, completed).length,
    2,
  );
  assert.equal(
    filterAchievements(achievements, { platform: "ps5" }, completed).length,
    3,
  );
  assert.deepEqual(
    filterAchievements(
      achievements,
      { routeItemId: "route-end" },
      completed,
    ).map((item) => item.id),
    ["achievement-story"],
  );
  assert.deepEqual(
    filterAchievements(
      achievements,
      { hideCompleted: true, category: "story" },
      completed,
    ),
    [],
  );
  assert.deepEqual(getProgress(achievements, completed), {
    completed: 1,
    total: 3,
    percent: 33,
  });
});

test("research trophies link their own objects rather than unrelated research", async () => {
  const catalogue = JSON.parse(
    await readFile(
      new URL("../data/achievements.json", import.meta.url),
      "utf8",
    ),
  );
  const guide = JSON.parse(
    await readFile(new URL("../data/guide.json", import.meta.url), "utf8"),
  );
  const items = guide.sections.flatMap((section) => section.items);
  const historian = getRelatedItems(
    catalogue.achievements.find((item) => item.id === "achievement-historian"),
    items,
  ).map((item) => item.id);
  assert.ok(historian.includes("act-1-step-031"));
  assert.ok(!historian.includes("act-1-step-004"));
  const conspiracy = getRelatedItems(
    catalogue.achievements.find(
      (item) => item.id === "achievement-conspiracy-theorist",
    ),
    items,
  ).map((item) => item.id);
  assert.ok(conspiracy.includes("act-2-part-2-step-031"));
  assert.ok(!conspiracy.includes("act-2-part-3-step-019"));
});

test("the complete achievement catalogue has valid bilingual directions and working route links", async () => {
  const catalogue = JSON.parse(
    await readFile(
      new URL("../data/achievements.json", import.meta.url),
      "utf8",
    ),
  );
  const guide = JSON.parse(
    await readFile(new URL("../data/guide.json", import.meta.url), "utf8"),
  );
  const items = guide.sections.flatMap((section) => section.items);
  const routeIds = new Set(items.map((item) => item.id));
  assert.equal(catalogue.achievements.length, 41);
  assert.equal(
    catalogue.achievements.filter((item) => item.platform === "ps5").length,
    1,
  );
  assert.equal(
    catalogue.achievements.filter((item) => item.missable).length,
    7,
  );
  const achievementIds = catalogue.achievements.map((item) => item.id);
  assert.equal(new Set(achievementIds).size, 41);
  for (const achievement of catalogue.achievements) {
    assert.match(achievement.id, /^achievement-[a-z0-9-]+$/);
    assert.ok(!routeIds.has(achievement.id));
    for (const language of ["ru", "en"]) {
      assert.ok(achievement.title[language]?.trim());
      assert.ok(achievement.description[language]?.trim());
      assert.ok(achievement.hint[language]?.trim());
      if (achievement.missable)
        assert.ok(achievement.warning[language]?.trim());
    }
    for (const id of achievement.route.itemIds ?? [])
      assert.ok(routeIds.has(id), `Broken route link: ${id}`);
    if (achievement.platform !== "ps5")
      assert.ok(
        getRelatedItems(achievement, items).length,
        `${achievement.id} has no route links`,
      );
    assert.equal(new URL(achievement.source).protocol, "https:");
  }
  const knownIds = new Set([...routeIds, ...achievementIds]);
  assert.deepEqual(
    parseBackup(
      JSON.stringify({
        app: "hellisus-cheatsheet",
        version: 1,
        completed: ["act-1-step-005", "achievement-so-it-begins"],
      }),
      knownIds,
    ).completed,
    ["act-1-step-005", "achievement-so-it-begins"],
  );
});
