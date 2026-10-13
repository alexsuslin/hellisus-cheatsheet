import { createTerminology, getBuildStatus } from "./build.js";
import { getProgress } from "./model.js";

const byId = (id) => document.getElementById(id);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Current edits existing progress IDs; shared completion rules live in the app.
export function createCurrentTracker({
  guide,
  build,
  tips,
  terminology,
  achievements,
  state,
  t,
  onToggle,
  onSelect,
  onRoute,
}) {
  const items = guide.sections.flatMap((section) => section.items);
  const localize = createTerminology(terminology.entries);
  const text = (value) =>
    localize(
      typeof value === "string" ? value : value[state.language],
      state.language,
    );
  const firstIncomplete = (candidates) =>
    candidates.find((item) => !state.completed.has(item.id)) ?? candidates[0];

  function checkbox(id, label, domId = `current-check-${id}`) {
    const wrapper = element("label", "build-check");
    const input = element("input");
    input.type = "checkbox";
    input.id = domId;
    input.dataset.progressId = id;
    input.checked = state.completed.has(id);
    wrapper.append(input, element("span", "", label));
    return wrapper;
  }

  function source(url) {
    const link = element("a", "item-source", `${t("source")} ↗`);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function card(id, category, title) {
    const node = element("article", "tip-card current-card");
    node.id = `current-${id}`;
    node.append(element("span", "eyebrow", category), element("h3", "", title));
    return node;
  }

  function renderBuild(stage) {
    const node = card(stage.id, t("myBuild"), text(stage.title));
    node.append(
      element("p", "", text(stage.obtain)),
      checkbox(`${stage.id}-obtained`, t("buildObtained")),
      element("p", "", text(stage.apply)),
      checkbox(`${stage.id}-applied`, t("buildApplied")),
    );
    if (stage.optional)
      node.append(checkbox(`${stage.id}-skipped`, t("buildSkipped")));
    node.append(source(build.sources[stage.source].url));
    return node;
  }

  function renderTip(tip) {
    const node = card(tip.id, t("tips"), text(tip.title));
    node.append(
      element("p", "", text(tip.description)),
      checkbox(tip.id, t("tipChecked")),
      source(tips.sources[tip.source].url),
    );
    return node;
  }

  function renderLoop(loop) {
    const node = card(loop.id, t(`loop_${loop.decision}`), text(loop.title));
    node.append(
      element("p", "", text(loop.note)),
      element("p", "muted", `${t("loopRewards")}: ${text(loop.rewards)}`),
      element("p", "muted", t("currentLoopNote")),
      source(tips.sources[loop.source].url),
    );
    return node;
  }

  function renderAchievement(achievement) {
    const node = card(
      achievement.id,
      `${t("achievements")}${achievement.platform ? " · PS5" : ""}`,
      achievement.title[state.language],
    );
    const progress = getProgress(
      achievement.relatedItemIds.map((id) => ({ id })),
      state.completed,
    );
    node.append(
      element("p", "", achievement.description[state.language]),
      element("p", "muted", achievement.hint[state.language]),
    );
    if (achievement.warning)
      node.append(
        element("p", "item-warning", achievement.warning[state.language]),
      );
    node.append(
      element(
        "p",
        "muted",
        t("currentLinkedProgress", {
          done: progress.completed,
          total: progress.total,
        }),
      ),
      element("p", "muted", t("currentTrophyNote")),
      checkbox(achievement.id, t("achievementUnlocked")),
    );
    return node;
  }

  function renderOptions(select, entries, selectedId, label) {
    select.replaceChildren(
      ...entries.map((entry) => {
        const option = element("option", "", label(entry));
        option.value = entry.id;
        return option;
      }),
    );
    select.value = selectedId;
  }

  function render() {
    const focusedId = document.activeElement?.closest("#current")
      ? document.activeElement.id
      : null;
    const selected =
      items.find((item) => item.id === state.currentItemId) ??
      firstIncomplete(items);
    const section = guide.sections.find((entry) =>
      entry.items.includes(selected),
    );
    const index = items.indexOf(selected);
    renderOptions(
      byId("current-location"),
      guide.sections,
      section.id,
      (entry) => `${t(entry.act)} · ${entry.title[state.language]}`,
    );
    renderOptions(
      byId("current-step"),
      section.items,
      selected.id,
      (item) =>
        `${state.completed.has(item.id) ? "✓ " : ""}${item.title[state.language]}`,
    );
    byId("current-position").textContent = t("currentPosition", {
      index: index + 1,
      total: items.length,
    });
    byId("current-previous").disabled = index === 0;
    byId("current-next").disabled = index === items.length - 1;
    byId("current-all-done").hidden = items.some(
      (item) => !state.completed.has(item.id),
    );

    const route = card(
      "route-action",
      t("walkthrough"),
      selected.title[state.language],
    );
    route.append(element("p", "", selected.description[state.language]));
    if (selected.missable)
      route.append(element("p", "item-warning", `! ${t("missable")}`));
    if (selected.warning)
      route.append(
        element("p", "item-warning", selected.warning[state.language]),
      );
    route.append(
      checkbox(selected.id, t("currentDone"), "current-route-check"),
      source(selected.source),
    );
    byId("current-route").replaceChildren(route);

    // Also retain obtained upgrades awaiting installation, even after leaving their route step.
    const stages = build.stages.filter(
      (stage) =>
        stage.routeIds.includes(selected.id) ||
        stage.obtainRouteIds?.includes(selected.id) ||
        getBuildStatus(stage, state.completed) === "ready",
    );
    const related = [
      ...tips.loops
        .filter((loop) => loop.routeIds[0] === selected.id)
        .map(renderLoop),
      ...tips.reminders
        .filter((tip) => tip.routeIds.includes(selected.id))
        .map(renderTip),
      ...stages.map(renderBuild),
      ...achievements
        .filter((achievement) =>
          achievement.relatedItemIds.includes(selected.id),
        )
        .map(renderAchievement),
    ];
    byId("current-related").replaceChildren(...related);
    byId("current-empty").hidden = related.length > 0;
    byId("current-global-list").replaceChildren(
      ...tips.reminders.filter((tip) => !tip.routeIds.length).map(renderTip),
    );
    if (focusedId)
      (byId(focusedId) ?? byId("current-route-check")).focus({
        preventScroll: true,
      });
  }

  function select(id) {
    if (!items.some((item) => item.id === id)) return;
    onSelect(id);
  }

  byId("current-location").addEventListener("change", (event) => {
    const section = guide.sections.find(
      (entry) => entry.id === event.target.value,
    );
    select(firstIncomplete(section.items).id);
  });
  byId("current-step").addEventListener("change", (event) =>
    select(event.target.value),
  );
  for (const [id, offset] of [
    ["current-previous", -1],
    ["current-next", 1],
  ]) {
    byId(id).addEventListener("click", () => {
      const index = items.findIndex(
        (item) => item.id === byId("current-step").value,
      );
      if (items[index + offset]) select(items[index + offset].id);
    });
  }
  byId("current-resume").addEventListener("click", () =>
    select(firstIncomplete(items).id),
  );
  byId("current-open-route").addEventListener("click", () =>
    onRoute(byId("current-step").value),
  );
  byId("current").addEventListener("change", (event) => {
    const input = event.target.closest("input[data-progress-id]");
    if (!input) return;
    // Pin the step before completing it: checking a box must not move the page.
    state.currentItemId = byId("current-step").value;
    onToggle(input.dataset.progressId, input.checked);
  });
  return { render };
}
