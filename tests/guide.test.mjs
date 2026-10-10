import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { load } from "cheerio";
import { translations } from "../assets/i18n.js";

test("every static UI message has complete Russian and English translations", async () => {
  const $ = load(
    await readFile(new URL("../index.html", import.meta.url), "utf8"),
  );
  const keys = $("[data-i18n]")
    .map((_, node) => $(node).attr("data-i18n"))
    .get();
  for (const key of keys) {
    for (const language of ["ru", "en"])
      assert.ok(translations[language][key], `${language}: ${key}`);
  }
  assert.deepEqual(
    Object.keys(translations.ru).sort(),
    Object.keys(translations.en).sort(),
  );
  assert.deepEqual(
    Object.keys(translations.ru.categories).sort(),
    Object.keys(translations.en.categories).sort(),
  );
});

test("the route covers all five walkthrough parts and has stable bilingual actions", async () => {
  const guide = JSON.parse(
    await readFile(new URL("../data/guide.json", import.meta.url), "utf8"),
  );
  assert.equal(guide.version, 1);
  assert.deepEqual(
    [...new Set(guide.sections.map((section) => section.part))],
    ["act-1", "act-2-part-1", "act-2-part-2", "act-2-part-3", "act-3-cleanup"],
  );
  assert.deepEqual(
    [...new Set(guide.sections.map((section) => section.act))],
    ["act1", "act2", "act3"],
  );
  const items = guide.sections.flatMap((section) => section.items);
  assert.ok(
    items.length >= 350,
    "The full route must not become a short sample",
  );
  assert.equal(
    new Set(items.map((item) => item.id)).size,
    items.length,
    "Duplicate IDs corrupt saved progress",
  );
  assert.equal(
    new Set(guide.sections.map((section) => section.id)).size,
    guide.sections.length,
  );
  for (const section of guide.sections) {
    assert.match(section.id, /^[a-z0-9-]+$/);
    assert.ok(section.items.length);
    for (const language of ["ru", "en"]) assert.ok(section.title[language]);
  }
  for (const item of items) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.equal(typeof item.missable, "boolean");
    assert.ok(
      translations.en.categories[item.category],
      `Unknown category ${item.category}`,
    );
    for (const category of item.categories)
      assert.ok(translations.en.categories[category]);
    assert.equal(new URL(item.source).hostname, "www.powerpyx.com");
    for (const language of ["ru", "en"]) {
      assert.ok(
        item.title[language]?.trim(),
        `${item.id} lacks ${language} title`,
      );
      assert.ok(
        item.description[language]?.trim(),
        `${item.id} lacks ${language} directions`,
      );
      if (item.warning) assert.ok(item.warning[language]?.trim());
    }
    assert.match(
      item.description.ru,
      /\p{Script=Cyrillic}/u,
      `${item.id} has untranslated Russian directions`,
    );
  }
  const categories = new Set(items.flatMap((item) => item.categories));
  for (const category of Object.keys(translations.en.categories))
    assert.ok(categories.has(category), `Missing ${category} content`);
  assert.ok(
    items.filter((item) => item.missable).length >= 10,
    "Missable interactions must be retained",
  );
});
