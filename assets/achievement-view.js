import { filterAchievements } from "./achievements.js";
import { translations } from "./i18n.js";
import { getProgress } from "./model.js";

const byId = (id) => document.getElementById(id);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createAchievementTracker({
  achievements,
  items,
  state,
  t,
  onToggle,
  onRoute,
}) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const expanded = new Set();
  const filters = {
    platform: "common",
    category: "all",
    query: "",
    missableOnly: false,
    hideCompleted: false,
    routeItemId: "",
  };

  function renderCard(achievement) {
    const completed = state.completed.has(achievement.id);
    const card = element(
      "article",
      `achievement-card${completed ? " completed" : ""}`,
    );
    card.id = achievement.id;
    const heading = element("div", "achievement-heading");
    const medal = element("span", `achievement-medal ${achievement.tier}`, "✦");
    medal.setAttribute("aria-hidden", "true");
    const names = element("div", "achievement-names");
    names.append(
      element("h3", "achievement-title", achievement.title[state.language]),
    );
    if (state.language === "ru")
      names.append(
        element("span", "achievement-original", achievement.title.en),
      );
    const tier = element(
      "span",
      `trophy-tier ${achievement.tier}`,
      t(achievement.tier),
    );
    heading.append(medal, names, tier);

    const meta = element("div", "item-meta");
    meta.append(
      element(
        "span",
        "category-tag",
        translations[state.language].achievementCategories[
          achievement.category
        ],
      ),
    );
    if (achievement.missable)
      meta.append(element("span", "missable-tag", `! ${t("missable")}`));
    if (achievement.platform)
      meta.append(element("span", "category-tag", "PS5"));
    card.append(
      heading,
      meta,
      element(
        "p",
        "achievement-requirement",
        achievement.description[state.language],
      ),
      element("p", "achievement-hint", achievement.hint[state.language]),
    );
    if (achievement.warning)
      card.append(
        element("p", "item-warning", achievement.warning[state.language]),
      );

    const unlock = element("label", "achievement-unlock");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.id = `unlock-${achievement.id}`;
    checkbox.dataset.achievementId = achievement.id;
    checkbox.checked = completed;
    checkbox.setAttribute(
      "aria-label",
      `${t("achievementUnlocked")}: ${achievement.title[state.language]}`,
    );
    unlock.htmlFor = checkbox.id;
    unlock.append(checkbox, element("span", "", t("achievementUnlocked")));
    card.append(unlock);

    const footer = element("div", "achievement-footer");
    const related = achievement.relatedItemIds.map((id) => itemById.get(id));
    if (related.length) {
      const progress = getProgress(related, state.completed);
      const toggle = element(
        "button",
        "text-button achievement-route-progress",
        t("relatedRouteProgress", {
          done: progress.completed,
          total: progress.total,
        }),
      );
      toggle.type = "button";
      toggle.dataset.routeToggle = achievement.id;
      toggle.setAttribute(
        "aria-expanded",
        String(expanded.has(achievement.id)),
      );
      toggle.setAttribute("aria-controls", `related-${achievement.id}`);
      footer.append(toggle);
    }
    const source = element("a", "item-source", `${t("source")} ↗`);
    source.href = achievement.source;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.setAttribute(
      "aria-label",
      `${t("source")}: ${achievement.title[state.language]}`,
    );
    footer.append(source);
    card.append(footer);

    if (related.length) {
      const list = element("ul", "achievement-route-list");
      list.id = `related-${achievement.id}`;
      list.hidden = !expanded.has(achievement.id);
      for (const item of related) {
        const li = element("li");
        const button = element("button", "route-step-link");
        button.type = "button";
        button.dataset.routeItem = item.id;
        const status = element(
          "span",
          "route-step-status",
          state.completed.has(item.id) ? "✓" : "○",
        );
        status.setAttribute("aria-hidden", "true");
        button.append(status, element("span", "", item.title[state.language]));
        li.append(button);
        list.append(li);
      }
      card.append(list);
    }
    return card;
  }

  function render() {
    const focusedId = document.activeElement?.id;
    const platformItems = achievements.filter(
      (item) => !item.platform || filters.platform === "ps5",
    );
    const progress = getProgress(platformItems, state.completed);
    byId("achievement-count").textContent =
      `${progress.completed} / ${progress.total}`;
    byId("achievement-progress").value = progress.percent;
    byId("achievement-progress").setAttribute(
      "aria-label",
      t("achievementProgress"),
    );
    byId("achievement-percent").textContent = `${progress.percent}%`;
    const allProgress = getProgress(
      achievements.filter((item) => !item.platform),
      state.completed,
    );
    byId("hero-achievement-count").textContent =
      `${allProgress.completed} / ${allProgress.total}`;

    const options = [element("option", "", t("allCategories"))];
    options[0].value = "all";
    for (const [category, name] of Object.entries(
      translations[state.language].achievementCategories,
    )) {
      const option = element("option", "", name);
      option.value = category;
      options.push(option);
    }
    byId("achievement-category").replaceChildren(...options);
    byId("achievement-category").value = filters.category;
    byId("achievement-platform").value = filters.platform;
    byId("achievement-search").value = filters.query;
    byId("achievement-search").placeholder = t("achievementSearch");
    byId("achievement-search").setAttribute(
      "aria-label",
      t("achievementSearch"),
    );
    byId("achievement-category").setAttribute("aria-label", t("categoryLabel"));
    byId("achievement-platform").setAttribute("aria-label", t("platformLabel"));
    byId("achievement-hide-completed").checked = filters.hideCompleted;
    byId("achievement-missable").checked = filters.missableOnly;
    const routeItem = itemById.get(filters.routeItemId);
    byId("achievement-route-context").hidden = !routeItem;
    byId("achievement-route-context-label").textContent = routeItem
      ? t("achievementsForStep", { title: routeItem.title[state.language] })
      : "";

    const visible = filterAchievements(achievements, filters, state.completed);
    byId("achievement-list").replaceChildren(...visible.map(renderCard));
    byId("achievement-results").textContent = t("results", {
      count: visible.length,
    });
    byId("achievement-empty").hidden = visible.length > 0;
    if (focusedId?.startsWith("unlock-"))
      byId(focusedId)?.focus({ preventScroll: true });
  }

  function clearFilters() {
    Object.assign(filters, {
      category: "all",
      query: "",
      missableOnly: false,
      hideCompleted: false,
      routeItemId: "",
    });
    render();
  }

  byId("achievement-search").addEventListener("input", (event) => {
    filters.query = event.target.value;
    render();
  });
  for (const [id, key] of [
    ["achievement-category", "category"],
    ["achievement-platform", "platform"],
    ["achievement-hide-completed", "hideCompleted"],
    ["achievement-missable", "missableOnly"],
  ]) {
    byId(id).addEventListener("change", (event) => {
      filters[key] =
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      render();
    });
  }
  for (const id of [
    "achievement-clear",
    "achievement-empty-clear",
    "achievement-context-clear",
  ])
    byId(id).addEventListener("click", clearFilters);

  byId("achievement-list").addEventListener("change", (event) => {
    const checkbox = event.target;
    if (!checkbox.matches("input[data-achievement-id]")) return;
    const visibleInputs = [
      ...byId("achievement-list").querySelectorAll(
        "input[data-achievement-id]",
      ),
    ];
    const index = visibleInputs.indexOf(checkbox);
    const nextId = visibleInputs[index + 1]?.id ?? visibleInputs[index - 1]?.id;
    onToggle(checkbox.dataset.achievementId, checkbox.checked);
    if (filters.hideCompleted)
      (byId(nextId) ?? byId("achievement-hide-completed")).focus({
        preventScroll: true,
      });
  });
  byId("achievement-list").addEventListener("click", (event) => {
    const route = event.target.closest("[data-route-item]");
    if (route) onRoute(route.dataset.routeItem);
    const toggle = event.target.closest("[data-route-toggle]");
    if (!toggle) return;
    const id = toggle.dataset.routeToggle;
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    toggle.setAttribute("aria-expanded", String(expanded.has(id)));
    byId(`related-${id}`).hidden = !expanded.has(id);
  });

  return {
    render,
    showForItem(id) {
      clearFilters();
      filters.routeItemId = id;
      render();
    },
  };
}
