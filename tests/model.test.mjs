import assert from "node:assert/strict";
import test from "node:test";
import { filterItems, getProgress, parseBackup } from "../assets/model.js";
import {
  loadState,
  rebaseCompletion,
  saveProgress,
  saveState,
} from "../assets/storage.js";

const items = [
  {
    id: "a",
    category: "npc",
    missable: true,
    title: { en: "Talk to Victor", ru: "Поговорите с Виктором" },
    description: { en: "At the farm", ru: "На ферме" },
  },
  {
    id: "b",
    category: "relic",
    categories: ["relic", "glyph"],
    missable: false,
    title: { en: "A relic", ru: "Реликвия" },
    description: { en: "In the cave", ru: "В пещере" },
  },
];

test("search uses both languages and combines filters without changing progress", () => {
  const completed = new Set(["a"]);
  assert.deepEqual(
    filterItems(
      items,
      {
        query: "виктор",
        category: "npc",
        missableOnly: true,
        hideCompleted: false,
      },
      completed,
    ).map((item) => item.id),
    ["a"],
  );
  assert.deepEqual(
    filterItems(items, { query: "VICTOR", hideCompleted: true }, completed),
    [],
  );
  assert.deepEqual(
    filterItems(items, { query: "пещере" }, completed).map((item) => item.id),
    ["b"],
  );
  assert.deepEqual(getProgress(items, new Set(["a", "obsolete"])), {
    completed: 1,
    total: 2,
    percent: 50,
  });
  assert.equal(completed.size, 1);
});

test("empty progress is finite", () => {
  assert.deepEqual(getProgress([], new Set()), {
    completed: 0,
    total: 0,
    percent: 0,
  });
});

test("a step granting multiple kinds of rewards appears in each relevant category", () => {
  assert.deepEqual(
    filterItems(items, { category: "glyph" }, new Set()).map((item) => item.id),
    ["b"],
  );
});

test("valid backups round trip and ignore IDs removed from the guide", () => {
  const backup = JSON.stringify({
    app: "hellisus-cheatsheet",
    version: 1,
    completed: ["a", "a", "old"],
    language: "ru",
    theme: "light",
  });
  assert.deepEqual(parseBackup(backup, new Set(["a", "b"])), {
    completed: ["a"],
    language: "ru",
    theme: "light",
  });
});

test("malformed or unrelated backups are rejected before replacing progress", () => {
  for (const value of [
    "null",
    "{}",
    "{",
    JSON.stringify({ app: "other", version: 1, completed: [] }),
    JSON.stringify({ app: "hellisus-cheatsheet", version: 1, completed: [42] }),
  ]) {
    assert.throws(() => parseBackup(value, new Set(["a"])));
  }
});

test("corrupt storage and denied storage never prevent using the checklist", () => {
  assert.deepEqual(loadState({ getItem: () => "{" }), {
    state: {},
    available: true,
  });
  assert.deepEqual(
    loadState({
      getItem: () => {
        throw new Error("Denied");
      },
    }),
    { state: {}, available: false },
  );
  assert.equal(
    saveState(
      {
        setItem: () => {
          throw new Error("Quota");
        },
      },
      { completed: ["a"] },
    ),
    false,
  );
});

test("storage preserves valid completion independently of display preferences", () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  assert.equal(
    saveState(storage, { completed: ["a"], language: "en", theme: "dark" }),
    true,
  );
  assert.deepEqual(loadState(storage).state, {
    completed: ["a"],
    language: "en",
    theme: "dark",
  });
});

test("a stale tab changing its theme cannot erase newer completion in storage", () => {
  let value = JSON.stringify({
    completed: ["a"],
    language: "ru",
    theme: "light",
  });
  const storage = {
    getItem: () => value,
    setItem: (_, next) => {
      value = next;
    },
  };
  const result = saveProgress(storage, {
    completed: [],
    language: "en",
    theme: "dark",
  });
  assert.deepEqual(result.state.completed, ["a"]);
  assert.equal(JSON.parse(value).theme, "dark");
});

test("independent checkbox edits merge, while import and reset explicitly replace", () => {
  let value = JSON.stringify({ completed: ["a"] });
  const storage = {
    getItem: () => value,
    setItem: (_, next) => {
      value = next;
    },
  };
  assert.deepEqual(
    saveProgress(storage, { completed: ["b"] }, { id: "b", checked: true })
      .state.completed,
    ["a", "b"],
  );
  assert.deepEqual(
    saveProgress(
      storage,
      { completed: ["a", "b"] },
      { id: "a", checked: false },
    ).state.completed,
    ["b"],
  );
  assert.deepEqual(
    saveProgress(storage, { completed: [] }, { replace: true }).state.completed,
    [],
  );
});

test("when writes are denied, multiple checkbox edits still survive in the current tab", () => {
  const storage = {
    getItem: () => JSON.stringify({ completed: ["a"] }),
    setItem: () => {
      throw new Error("Quota");
    },
  };
  const first = saveProgress(
    storage,
    { completed: ["a", "b"] },
    { id: "b", checked: true },
  );
  assert.equal(first.available, false);
  const second = saveProgress(
    storage,
    { completed: [...first.state.completed, "c"] },
    { id: "c", checked: true },
  );
  assert.deepEqual(second.state.completed, ["a", "b", "c"]);
});

test("unsaved checkbox edits survive another tab writing preferences and can be recovered", () => {
  const pending = [
    { id: "b", checked: true },
    { id: "a", checked: false },
  ];
  assert.deepEqual(rebaseCompletion(["a", "c"], pending), ["c", "b"]);
  let value = JSON.stringify({ completed: ["a", "c"], theme: "dark" });
  const storage = {
    getItem: () => value,
    setItem: (_, next) => {
      value = next;
    },
  };
  const recovered = saveProgress(
    storage,
    { completed: ["b"] },
    { edits: pending },
  );
  assert.equal(recovered.available, true);
  assert.deepEqual(JSON.parse(value).completed, ["c", "b"]);
});
