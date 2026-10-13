import {
  createTerminology,
  getBuildStatus,
  getNextBuildSteps,
} from "./build.js";

const byId = (id) => document.getElementById(id);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createBuildTracker({
  build,
  tips,
  terminology,
  items,
  state,
  t,
  onToggle,
  onRoute,
}) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const localize = createTerminology(terminology.entries);
  const filters = { act: "all", query: "", hideCompleted: false, loop: "all" };
  const text = (value) =>
    localize(
      typeof value === "string" ? value : value[state.language],
      state.language,
    );

  function checkbox(id, label, phase) {
    const wrapper = element("label", "build-check");
    const input = element("input");
    input.type = "checkbox";
    input.id = `track-${id}`;
    input.dataset.progressId = id;
    if (phase) input.dataset.progressPhase = phase;
    input.checked = state.completed.has(id);
    wrapper.append(input, element("span", "", label));
    return wrapper;
  }

  function sourceLink(source) {
    const link = element("a", "item-source", `${t("source")} ↗`);
    link.href = source.url;
    link.title = source.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function routeLinks(ids, source) {
    const footer = element("details", "build-links");
    footer.append(element("summary", "", t("buildRouteLinks")));
    for (const id of ids) {
      const item = itemById.get(id);
      if (!item) continue;
      const link = element(
        "button",
        "route-step-link",
        `${state.completed.has(id) ? "✓" : "○"} ${item.title[state.language]}`,
      );
      link.type = "button";
      link.dataset.routeItem = id;
      footer.append(link);
    }
    footer.append(sourceLink(source));
    return footer;
  }

  function stageCard(stage, index) {
    const status = getBuildStatus(stage, state.completed);
    const card = element("article", `build-stage status-${status}`);
    card.id = stage.id;
    const heading = element("div", "build-stage-heading");
    heading.append(
      element("span", "section-number", String(index + 1).padStart(2, "0")),
      element("h3", "", text(stage.title)),
    );
    const tags = element("div", "item-meta");
    tags.append(
      element("span", "category-tag", t(stage.act)),
      element("span", "category-tag", t(`buildStatus_${status}`)),
    );
    if (stage.optional)
      tags.append(element("span", "category-tag", t("buildOptional")));
    if (stage.routeIds.every((id) => state.completed.has(id)))
      tags.append(element("span", "route-step-status", t("buildRouteDone")));
    card.append(
      heading,
      tags,
      element("p", "build-instruction", text(stage.obtain)),
      checkbox(`${stage.id}-obtained`, t("buildObtained"), "obtained"),
      element("p", "build-instruction", text(stage.apply)),
      checkbox(`${stage.id}-applied`, t("buildApplied"), "applied"),
    );
    if (stage.optional)
      card.append(
        checkbox(`${stage.id}-skipped`, t("buildSkipped"), "skipped"),
      );
    card.append(routeLinks(stage.routeIds, build.sources[stage.source]));
    return card;
  }

  function renderBuild() {
    const finished = build.stages.filter((stage) =>
      ["done", "skipped"].includes(getBuildStatus(stage, state.completed)),
    ).length;
    byId("build-count").textContent = `${finished} / ${build.stages.length}`;
    byId("build-progress").value = (finished / build.stages.length) * 100;
    byId("build-progress").setAttribute("aria-label", t("buildProgress"));
    const next = getNextBuildSteps(build.stages, state.completed);
    byId("build-next").replaceChildren(
      ...next.map((stage) => {
        const link = element(
          "button",
          "build-next-link",
          `${t(getBuildStatus(stage, state.completed) === "ready" ? "buildInstallNext" : "buildFindNext")}: ${text(stage.title)}`,
        );
        link.type = "button";
        link.dataset.buildStage = stage.id;
        return link;
      }),
    );
    if (!next.length)
      byId("build-next").append(element("p", "", t("buildAllDone")));

    byId("build-loadouts").replaceChildren(
      ...build.loadouts.map((loadout) => {
        const card = element("article", "loadout-card");
        card.append(element("h3", "", text(loadout.title)));
        const list = element("ul");
        for (const item of loadout.items)
          list.append(element("li", "", text(item)));
        card.append(list, element("p", "muted", text(loadout.note)));
        return card;
      }),
    );

    const query = filters.query.trim().toLocaleLowerCase();
    const visible = build.stages.filter((stage) => {
      if (filters.act !== "all" && filters.act !== stage.act) return false;
      if (
        filters.hideCompleted &&
        ["done", "skipped"].includes(getBuildStatus(stage, state.completed))
      )
        return false;
      const searchable = [stage.title, stage.obtain, stage.apply]
        .flatMap((value) => [value.en, value.ru, localize(value.ru, "ru")])
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(query);
    });
    byId("build-list").replaceChildren(
      ...visible.map((stage) => stageCard(stage, build.stages.indexOf(stage))),
    );
    byId("build-empty").hidden = visible.length > 0;
    byId("build-search").placeholder = t("buildSearch");
    byId("build-search").setAttribute("aria-label", t("buildSearch"));
    byId("build-act").setAttribute("aria-label", t("allActs"));
  }

  function renderTips() {
    byId("tips-policy").textContent = tips.policy[state.language];
    byId("tips-list").replaceChildren(
      ...tips.reminders.map((tip) => {
        const card = element("article", "tip-card");
        card.id = tip.id;
        card.append(
          element(
            "span",
            "eyebrow",
            tip.act === "all" ? t("allActs") : t(tip.act),
          ),
          element("h3", "", text(tip.title)),
          element("p", "", text(tip.description)),
          checkbox(tip.id, t("tipChecked")),
          routeLinks(tip.routeIds, tips.sources[tip.source]),
        );
        return card;
      }),
    );
    const visibleLoops = tips.loops.filter(
      (loop) => filters.loop === "all" || loop.decision === filters.loop,
    );
    byId("loop-list").replaceChildren(
      ...visibleLoops.map((loop) => {
        const card = element("article", `loop-card decision-${loop.decision}`);
        card.id = loop.id;
        const meta = element("div", "item-meta");
        meta.append(
          element("span", "category-tag", t(`loop_${loop.decision}`)),
          element("span", "category-tag", `${t("loopPrism")}: ${loop.prism}`),
        );
        card.append(
          element("h3", "", text(loop.title)),
          meta,
          element("p", "", text(loop.note)),
          element(
            "p",
            "loop-rewards",
            `${t("loopRewards")}: ${text(loop.rewards)}`,
          ),
          checkbox(loop.routeIds[0], t("loopCompleted")),
          routeLinks(loop.routeIds, tips.sources[loop.source]),
        );
        return card;
      }),
    );
    const closed = tips.loops.filter((loop) =>
      state.completed.has(loop.routeIds[0]),
    ).length;
    byId("loop-count").textContent = `${closed} / ${tips.loops.length}`;
    byId("loop-filter").setAttribute("aria-label", t("loopFilter"));
  }

  function renderGlossary() {
    byId("glossary-note").textContent = terminology.note[state.language];
    byId("glossary-list").replaceChildren(
      ...terminology.entries.map((entry) => {
        const row = element("div", "glossary-row");
        row.append(
          element("strong", "", entry.ru),
          element("span", "", entry.en),
          element(
            "span",
            "muted",
            t(
              entry.status === "unverified"
                ? "nameUnverified"
                : "nameCommunity",
            ),
          ),
        );
        for (const source of entry.sources)
          row.append(sourceLink(terminology.sources[source]));
        return row;
      }),
    );
  }

  function render() {
    const focusedId = document.activeElement?.id;
    const focusOrder = [
      ...(document.activeElement
        ?.closest("section")
        ?.querySelectorAll("input[data-progress-id]") ?? []),
    ].map((input) => input.id);
    const focusIndex = focusOrder.indexOf(focusedId);
    const expanded = [
      ...document.querySelectorAll("#build details[open], #tips details[open]"),
    ].map((node) => node.id || node.parentElement.id);
    renderBuild();
    renderTips();
    renderGlossary();
    for (const id of expanded) {
      const node = byId(id);
      const details = node?.matches("details")
        ? node
        : node?.querySelector("details");
      if (details) details.open = true;
    }
    if (focusedId?.startsWith("track-")) {
      // Hide-completed can remove an entire milestone after its last check.
      const next = focusOrder.slice(focusIndex + 1).find((id) => byId(id));
      const previous = focusOrder
        .slice(0, focusIndex)
        .reverse()
        .find((id) => byId(id));
      (
        byId(focusedId) ??
        byId(next) ??
        byId(previous) ??
        byId("build-hide-completed")
      ).focus({ preventScroll: true });
    }
  }

  for (const panel of [byId("build"), byId("tips")]) {
    panel.addEventListener("change", (event) => {
      const input = event.target.closest("[data-progress-id]");
      if (input) onToggle(input.dataset.progressId, input.checked);
    });
    panel.addEventListener("click", (event) => {
      const route = event.target.closest("[data-route-item]");
      if (route) onRoute(route.dataset.routeItem);
      const next = event.target.closest("[data-build-stage]");
      if (!next) return;
      filters.act = "all";
      filters.query = "";
      filters.hideCompleted = false;
      byId("build-act").value = "all";
      byId("build-search").value = "";
      byId("build-hide-completed").checked = false;
      renderBuild();
      const card = byId(next.dataset.buildStage);
      card.scrollIntoView({ block: "center" });
      card.querySelector("input:not(:checked)")?.focus({ preventScroll: true });
    });
  }
  byId("build-search").addEventListener("input", (event) => {
    filters.query = event.target.value;
    renderBuild();
  });
  byId("build-act").addEventListener("change", (event) => {
    filters.act = event.target.value;
    renderBuild();
  });
  byId("build-hide-completed").addEventListener("change", (event) => {
    filters.hideCompleted = event.target.checked;
    renderBuild();
  });
  byId("loop-filter").addEventListener("change", (event) => {
    filters.loop = event.target.value;
    renderTips();
  });

  return { render };
}
