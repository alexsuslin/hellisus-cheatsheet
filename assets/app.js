import { createAchievementTracker } from "./achievement-view.js";
import { getRelatedItems } from "./achievements.js";
import { translate, translations } from "./i18n.js";
import { filterItems, getProgress, parseBackup } from "./model.js";
import {
  loadState,
  rebaseCompletion,
  STORAGE_KEY,
  saveProgress,
} from "./storage.js";

const byId = (id) => document.getElementById(id);
let browserStorage;
try {
  browserStorage = window.localStorage;
} catch {
  // Some privacy modes deny access to the localStorage property itself.
}

const saved = loadState(browserStorage);
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
const state = {
  language: ["ru", "en"].includes(saved.state.language)
    ? saved.state.language
    : navigator.language.toLowerCase().startsWith("ru")
      ? "ru"
      : "en",
  theme: ["dark", "light"].includes(saved.state.theme)
    ? saved.state.theme
    : systemTheme,
  completed: new Set(
    Array.isArray(saved.state.completed)
      ? saved.state.completed.filter((id) => typeof id === "string")
      : [],
  ),
  storageAvailable: saved.available,
  filters: {
    act: "all",
    category: "all",
    query: "",
    missableOnly: false,
    hideCompleted: saved.state.hideCompleted === true,
  },
};

let guide;
let achievementTracker;
const achievementsByItem = new Map();
let activeView = "walkthrough";
const allItems = [];
let knownIds = new Set();
const openSections = new Set();
const pendingEdits = new Map();
let pendingReplacement = false;
let toastTimer;
let searchTimer;

function t(key, values) {
  return translate(state.language, key, values);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function applyPreferences() {
  document.documentElement.lang = state.language;
  document.documentElement.dataset.theme = state.theme;
  document.title =
    state.language === "ru"
      ? "Hell is Us — Чек-лист прохождения"
      : "Hell is Us — Walkthrough Checklist";
  for (const node of document.querySelectorAll("[data-i18n]"))
    node.textContent = t(node.dataset.i18n);
  for (const button of document.querySelectorAll("[data-language]"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.language === state.language),
    );

  const nextTheme = state.theme === "dark" ? "light" : "dark";
  byId("theme-toggle").setAttribute(
    "aria-label",
    t("switchTheme", { theme: t(nextTheme) }),
  );
  byId("theme-toggle").title = t("switchTheme", { theme: t(nextTheme) });
  byId("theme-toggle").setAttribute(
    "aria-pressed",
    String(state.theme === "dark"),
  );
  byId("search").placeholder = t("search");
  byId("search").setAttribute("aria-label", t("searchLabel"));
  byId("category-filter").setAttribute("aria-label", t("categoryLabel"));
  byId("overall-progress").setAttribute("aria-label", t("progressLabel"));
  byId("location-nav").setAttribute(
    "aria-label",
    t("locations").replace(" ↓", ""),
  );
  byId("route-sidebar").setAttribute("aria-label", t("route"));
  byId("act-tabs").setAttribute("aria-label", t("allActs"));
  byId("view-switch").setAttribute("aria-label", t("trackers"));
  document
    .querySelector(".header-links")
    .setAttribute("aria-label", t("walkthrough"));

  const options = [element("option", "", t("allCategories"))];
  options[0].value = "all";
  for (const [category, name] of Object.entries(
    translations[state.language].categories,
  )) {
    const option = element("option", "", name);
    option.value = category;
    options.push(option);
  }
  byId("category-filter").replaceChildren(...options);
  syncFilterControls();
  updateStorageNotice();
  if (!byId("load-error").hidden)
    byId("load-error").textContent = t("loadError");
}

function syncFilterControls() {
  byId("hide-completed").checked = state.filters.hideCompleted;
  byId("missable-only").checked = state.filters.missableOnly;
  byId("category-filter").value = state.filters.category;
  byId("search").value = state.filters.query;
  for (const button of document.querySelectorAll("[data-act]"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.act === state.filters.act),
    );
}

function updateStorageNotice() {
  byId("storage-warning").hidden = state.storageAvailable;
  byId("storage-warning").textContent = t("storageWarning");
  byId("save-label").textContent = t(
    state.storageAvailable ? "savedLocally" : "notSaved",
  );
}

function persist(change) {
  if (change?.replace) {
    pendingReplacement = true;
    pendingEdits.clear();
  }
  if (change?.id) pendingEdits.set(change.id, change.checked);
  const result = saveProgress(
    browserStorage,
    {
      language: state.language,
      theme: state.theme,
      completed: [...state.completed],
      hideCompleted: state.filters.hideCompleted,
    },
    {
      replace: pendingReplacement,
      edits: [...pendingEdits].map(([id, checked]) => ({ id, checked })),
    },
  );
  state.storageAvailable = result.available;
  if (result.available) {
    pendingEdits.clear();
    pendingReplacement = false;
  }
  state.completed = new Set(
    result.state.completed.filter((id) => !guide || knownIds.has(id)),
  );
  updateStorageNotice();
  if (guide) updateCounters();
}

function updateCounters() {
  const overall = getProgress(allItems, state.completed);
  byId("progress-percent").textContent = overall.percent;
  byId("overall-progress").value = overall.percent;
  byId("progress-count").textContent = t("progressCount", {
    done: overall.completed,
    total: overall.total,
  });

  for (const section of guide.sections) {
    const progress = getProgress(section.items, state.completed);
    const count = t("sectionProgress", {
      done: progress.completed,
      total: progress.total,
    });
    const sectionCounter = byId(`count-${section.id}`);
    const navCounter = byId(`nav-count-${section.id}`);
    if (sectionCounter) sectionCounter.textContent = count;
    if (navCounter) navCounter.textContent = count;
  }
  for (const checkbox of document.querySelectorAll("input[data-item-id]")) {
    checkbox.checked = state.completed.has(checkbox.dataset.itemId);
    checkbox
      .closest(".checklist-item")
      .classList.toggle("completed", checkbox.checked);
  }
  achievementTracker?.render();
}

function renderItem(item) {
  const row = element(
    "div",
    `checklist-item${state.completed.has(item.id) ? " completed" : ""}`,
  );
  row.dataset.itemId = item.id;
  row.id = item.id;
  const label = element("label", "item-label");
  const checkbox = element("input");
  checkbox.type = "checkbox";
  checkbox.id = `check-${item.id}`;
  checkbox.dataset.itemId = item.id;
  checkbox.checked = state.completed.has(item.id);
  label.htmlFor = checkbox.id;

  const body = element("span", "item-body");
  body.append(element("span", "item-title", item.title[state.language]));
  if (item.description[state.language])
    body.append(
      element("span", "item-description", item.description[state.language]),
    );

  const meta = element("span", "item-meta");
  for (const category of item.categories ?? [item.category])
    meta.append(
      element(
        "span",
        "category-tag",
        translations[state.language].categories[category],
      ),
    );
  if (item.missable)
    meta.append(element("span", "missable-tag", `! ${t("missable")}`));
  body.append(meta);
  if (item.warning)
    body.append(element("span", "item-warning", item.warning[state.language]));
  label.append(checkbox, body);

  const source = element("a", "item-source", "↗");
  source.href = item.source;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.title = `${t("source")}: PowerPyx`;
  source.setAttribute(
    "aria-label",
    `${t("source")}: ${item.title[state.language]}`,
  );
  row.append(label, source);
  const related = achievementsByItem.get(item.id);
  if (related?.length) {
    const link = element(
      "button",
      "text-button item-achievement-link",
      t("relatedAchievements", { count: related.length }),
    );
    link.type = "button";
    link.dataset.relatedAchievements = item.id;
    row.append(link);
  }
  return row;
}

function selectView(view) {
  activeView = view;
  byId("walkthrough-panel").hidden = view !== "walkthrough";
  byId("achievements").hidden = view !== "achievements";
  for (const button of document.querySelectorAll("[data-view]"))
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
}

function navigateToRouteItem(id) {
  const section = guide.sections.find((entry) =>
    entry.items.some((item) => item.id === id),
  );
  if (!section) return;
  selectView("walkthrough");
  openSections.add(section.id);
  clearFilters();
  history.replaceState(null, "", `#${id}`);
  byId(id).scrollIntoView({ block: "center" });
  byId(`check-${id}`).focus({ preventScroll: true });
}

function renderSection(section, items, index) {
  const details = element("details", "route-section");
  details.id = section.id;
  details.open = Boolean(
    state.filters.query ||
      state.filters.missableOnly ||
      state.filters.category !== "all" ||
      openSections.has(section.id),
  );
  details.addEventListener("toggle", () => {
    if (details.open) openSections.add(section.id);
    else openSections.delete(section.id);
  });

  const summary = element("summary", "section-summary");
  const title = element("span", "section-title");
  const partNumber = section.part.match(/part-(\d)/)?.[1];
  const partSuffix = partNumber
    ? state.language === "ru"
      ? ` · Часть ${partNumber}`
      : ` · Part ${partNumber}`
    : "";
  title.append(
    element("span", "eyebrow", `${t(section.act)}${partSuffix}`),
    element("h3", "", section.title[state.language]),
  );
  const count = element("span", "section-count");
  count.id = `count-${section.id}`;
  const chevron = element("span", "section-chevron", "⌄");
  chevron.setAttribute("aria-hidden", "true");
  summary.append(
    element("span", "section-number", String(index + 1).padStart(2, "0")),
    title,
    count,
    chevron,
  );

  const list = element("div", "section-items");
  list.append(...items.map(renderItem));
  details.append(summary, list);
  return details;
}

function renderNavigation(visibleSections) {
  const nav = byId("location-nav");
  const groups = [];
  for (const act of ["act1", "act2", "act3"]) {
    const sections = visibleSections.filter((section) => section.act === act);
    if (!sections.length) continue;
    const group = element("div", "nav-act");
    group.append(element("p", "", t(act)));
    for (const section of sections) {
      const link = element("a", "location-link");
      link.href = `#${section.id}`;
      link.dataset.section = section.id;
      const count = element("span", "nav-count");
      count.id = `nav-count-${section.id}`;
      link.append(element("span", "", section.title[state.language]), count);
      group.append(link);
    }
    groups.push(group);
  }
  nav.replaceChildren(...groups);
}

function renderChecklist() {
  if (!guide) return;
  const focusedId = document.activeElement?.id;
  const nodes = [];
  const visibleSections = [];
  let visibleCount = 0;

  guide.sections.forEach((section, index) => {
    if (state.filters.act !== "all" && state.filters.act !== section.act)
      return;
    const items = filterItems(section.items, state.filters, state.completed);
    if (!items.length) return;
    visibleSections.push(section);
    nodes.push(renderSection(section, items, index));
    visibleCount += items.length;
  });

  byId("checklist-sections").replaceChildren(...nodes);
  byId("empty-state").hidden = visibleCount > 0;
  byId("result-count").textContent = t("results", { count: visibleCount });
  renderNavigation(visibleSections);
  updateCounters();
  if (focusedId?.startsWith("check-"))
    byId(focusedId)?.focus({ preventScroll: true });
}

function clearFilters() {
  clearTimeout(searchTimer);
  state.filters = {
    act: "all",
    category: "all",
    query: "",
    missableOnly: false,
    hideCompleted: false,
  };
  syncFilterControls();
  persist();
  renderChecklist();
}

function toast(message) {
  clearTimeout(toastTimer);
  byId("toast").textContent = message;
  byId("toast").hidden = false;
  toastTimer = setTimeout(() => {
    byId("toast").hidden = true;
  }, 5500);
}

function confirmAction(title, description, action) {
  const dialog = byId("confirm-dialog");
  byId("confirm-title").textContent = title;
  byId("confirm-description").textContent = description;
  byId("confirm-action").textContent = action;
  dialog.returnValue = "cancel";
  dialog.setAttribute("aria-labelledby", "confirm-title");
  dialog.setAttribute("aria-describedby", "confirm-description");
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    );
    dialog.showModal();
  });
}

function exportProgress() {
  const backup = {
    app: "hellisus-cheatsheet",
    version: 1,
    exportedAt: new Date().toISOString(),
    language: state.language,
    theme: state.theme,
    completed: [...state.completed],
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const link = element("a");
  link.href = url;
  link.download = `hellisus-progress-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t("exported"));
}

async function importProgress(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  let backup;
  try {
    if (file.size > 1_000_000) throw new Error("Backup too large");
    backup = parseBackup(await file.text(), knownIds);
  } catch {
    toast(t("invalidBackup"));
    return;
  }

  const confirmed = await confirmAction(
    t("importTitle"),
    t("importDescription", { count: backup.completed.length }),
    t("importAction"),
  );
  if (!confirmed) return;
  state.completed = new Set(backup.completed);
  if (backup.language) state.language = backup.language;
  if (backup.theme) state.theme = backup.theme;
  persist({ replace: true });
  applyPreferences();
  renderChecklist();
  toast(t("imported"));
}

function bindPreferenceEvents() {
  for (const button of document.querySelectorAll("[data-language]")) {
    button.addEventListener("click", () => {
      state.language = button.dataset.language;
      persist();
      applyPreferences();
      renderChecklist();
    });
  }
  byId("theme-toggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    persist();
    applyPreferences();
  });
}

function bindEvents() {
  for (const button of document.querySelectorAll("[data-view]")) {
    button.addEventListener("click", () => {
      selectView(button.dataset.view);
      history.replaceState(
        null,
        "",
        activeView === "achievements" ? "#achievements" : "#checklist",
      );
    });
  }
  byId("checklist-sections").addEventListener("click", (event) => {
    const link = event.target.closest("[data-related-achievements]");
    if (!link) return;
    achievementTracker.showForItem(link.dataset.relatedAchievements);
    selectView("achievements");
    history.replaceState(null, "", "#achievements");
    byId("view-switch").scrollIntoView();
    byId("achievement-search").focus({ preventScroll: true });
  });
  for (const button of document.querySelectorAll("[data-act]")) {
    button.addEventListener("click", () => {
      state.filters.act = button.dataset.act;
      syncFilterControls();
      renderChecklist();
    });
  }
  byId("search").addEventListener("input", (event) => {
    state.filters.query = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderChecklist, 140);
  });
  byId("category-filter").addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderChecklist();
  });
  byId("hide-completed").addEventListener("change", (event) => {
    state.filters.hideCompleted = event.target.checked;
    persist();
    renderChecklist();
  });
  byId("missable-only").addEventListener("change", (event) => {
    state.filters.missableOnly = event.target.checked;
    renderChecklist();
  });
  byId("show-missables").addEventListener("click", () => {
    selectView("walkthrough");
    history.replaceState(null, "", "#checklist");
    clearFilters();
    state.filters.missableOnly = true;
    syncFilterControls();
    renderChecklist();
    byId("checklist").scrollIntoView();
  });
  byId("clear-filters").addEventListener("click", clearFilters);
  byId("empty-clear").addEventListener("click", clearFilters);

  byId("checklist-sections").addEventListener("change", (event) => {
    const checkbox = event.target;
    if (!checkbox.matches("input[data-item-id]")) return;
    const id = checkbox.dataset.itemId;
    if (checkbox.checked) state.completed.add(id);
    else state.completed.delete(id);
    checkbox
      .closest(".checklist-item")
      .classList.toggle("completed", checkbox.checked);
    persist({ id, checked: checkbox.checked });
    updateCounters();
    if (state.filters.hideCompleted) {
      const visibleInputs = [
        ...document.querySelectorAll(
          ".route-section[open] input[data-item-id]",
        ),
      ];
      const index = visibleInputs.indexOf(checkbox);
      const nextId =
        visibleInputs[index + 1]?.id ?? visibleInputs[index - 1]?.id;
      renderChecklist();
      if (nextId && byId(nextId)) byId(nextId).focus({ preventScroll: true });
      else byId("hide-completed").focus({ preventScroll: true });
    }
  });

  byId("location-nav").addEventListener("click", (event) => {
    const link = event.target.closest("a[data-section]");
    if (!link) return;
    selectView("walkthrough");
    const details = byId(link.dataset.section);
    details.open = true;
    openSections.add(details.id);
    for (const other of document.querySelectorAll(".location-link"))
      other.classList.toggle("active", other === link);
    byId("route-sidebar").classList.remove("nav-open");
    byId("mobile-nav-toggle").setAttribute("aria-expanded", "false");
  });
  byId("mobile-nav-toggle").addEventListener("click", () => {
    const expanded = byId("route-sidebar").classList.toggle("nav-open");
    byId("mobile-nav-toggle").setAttribute("aria-expanded", String(expanded));
  });
  byId("export-progress").addEventListener("click", exportProgress);
  byId("import-progress").addEventListener("click", () =>
    byId("import-file").click(),
  );
  byId("import-file").addEventListener("change", importProgress);
  byId("reset-progress").addEventListener("click", async () => {
    if (
      !(await confirmAction(
        t("resetTitle"),
        t("resetDescription"),
        t("resetAction"),
      ))
    )
      return;
    state.completed.clear();
    persist({ replace: true });
    renderChecklist();
    toast(t("resetDone"));
  });
}

applyPreferences();
bindPreferenceEvents();

window.addEventListener("storage", (event) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  const latest = loadState(browserStorage);
  state.storageAvailable = state.storageAvailable && latest.available;
  const latestIds = (
    Array.isArray(latest.state.completed) ? latest.state.completed : []
  ).filter((id) => !guide || knownIds.has(id));
  if (!pendingReplacement)
    state.completed = new Set(
      rebaseCompletion(
        latestIds,
        [...pendingEdits].map(([id, checked]) => ({ id, checked })),
      ),
    );
  if (["ru", "en"].includes(latest.state.language))
    state.language = latest.state.language;
  if (["dark", "light"].includes(latest.state.theme))
    state.theme = latest.state.theme;
  state.filters.hideCompleted = latest.state.hideCompleted === true;
  applyPreferences();
  renderChecklist();
});

try {
  const [guideResponse, achievementsResponse] = await Promise.all([
    fetch(new URL("../data/guide.json", import.meta.url)),
    fetch(new URL("../data/achievements.json", import.meta.url)),
  ]);
  if (!guideResponse.ok || !achievementsResponse.ok)
    throw new Error("Checklist data request failed");
  const [guideData, catalogue] = await Promise.all([
    guideResponse.json(),
    achievementsResponse.json(),
  ]);
  guide = guideData;
  for (const section of guide.sections) {
    for (const item of section.items) {
      item.searchTerms = [
        ...(item.searchTerms ?? []),
        ...Object.values(section.title),
      ];
      allItems.push(item);
    }
  }
  for (const achievement of catalogue.achievements) {
    achievement.relatedItemIds = getRelatedItems(achievement, allItems).map(
      (item) => item.id,
    );
    for (const id of achievement.relatedItemIds) {
      if (!achievementsByItem.has(id)) achievementsByItem.set(id, []);
      achievementsByItem.get(id).push(achievement.id);
    }
  }
  knownIds = new Set(
    [...allItems, ...catalogue.achievements].map((item) => item.id),
  );
  state.completed = new Set(
    [...state.completed].filter((id) => knownIds.has(id)),
  );
  const initialSection =
    guide.sections.find((section) => section.id === location.hash.slice(1)) ??
    guide.sections[0];
  openSections.add(initialSection.id);
  achievementTracker = createAchievementTracker({
    achievements: catalogue.achievements,
    items: allItems,
    state,
    t,
    onToggle(id, checked) {
      if (checked) state.completed.add(id);
      else state.completed.delete(id);
      persist({ id, checked });
    },
    onRoute: navigateToRouteItem,
  });
  bindEvents();
  renderChecklist();
  function followHash() {
    const id = location.hash.slice(1);
    if (id === "achievements" || id.startsWith("achievement-")) {
      selectView("achievements");
      if (id.startsWith("achievement-")) {
        const platform = byId("achievement-platform");
        platform.value = "ps5";
        platform.dispatchEvent(new Event("change"));
        byId("achievement-clear").click();
      }
      byId(id)?.scrollIntoView();
    } else if (allItems.some((item) => item.id === id)) {
      navigateToRouteItem(id);
    } else if (
      id === "checklist" ||
      guide.sections.some((section) => section.id === id)
    ) {
      selectView("walkthrough");
      const section = byId(id);
      if (section?.matches("details")) section.open = true;
    }
  }
  window.addEventListener("hashchange", followHash);
  followHash();
  if (location.hash && byId(location.hash.slice(1)))
    byId(location.hash.slice(1)).scrollIntoView();
} catch (error) {
  console.error("Unable to load checklist:", error);
  byId("checklist-sections").replaceChildren();
  byId("load-error").textContent = t("loadError");
  byId("load-error").hidden = false;
  byId("progress-count").textContent = "—";
}
