export function getBuildIds(stages) {
  return stages.flatMap((stage) => [
    `${stage.id}-obtained`,
    `${stage.id}-applied`,
    ...(stage.optional ? [`${stage.id}-skipped`] : []),
  ]);
}

export function getBuildStatus(stage, completed) {
  if (stage.optional && completed.has(`${stage.id}-skipped`)) return "skipped";
  const obtained = completed.has(`${stage.id}-obtained`);
  const applied = completed.has(`${stage.id}-applied`);
  if (obtained && applied) return "done";
  return obtained ? "ready" : "missing";
}

export function getNextBuildSteps(stages, completed) {
  const pending = stages.filter((stage) =>
    ["ready", "missing"].includes(getBuildStatus(stage, completed)),
  );
  // Inventory already checked: prioritize actually installing the upgrade.
  return [
    ...pending.filter((stage) => getBuildStatus(stage, completed) === "ready"),
    ...pending.filter(
      (stage) => getBuildStatus(stage, completed) === "missing",
    ),
  ].slice(0, 3);
}

export function createTerminology(entries) {
  const byName = new Map(entries.map((entry) => [entry.en, entry]));
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const escaped = names.map((name) =>
    name
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replaceAll("’", "[’']")
      .replaceAll("–", "[–—-]"),
  );
  const pattern = new RegExp(
    `(?<![A-Za-z])(${escaped.join("|")})(?:\\s*[–—-]\\s*(Enhanced|Elite))?(?![A-Za-z])`,
    "g",
  );

  return (text, language) => {
    if (language !== "ru") return text;
    return text.replace(pattern, (original, name, quality) => {
      const normalized = name.replaceAll("'", "’").replace(/ [—-] /g, " – ");
      const entry = byName.get(normalized);
      if (!entry) return original;
      const suffix = quality
        ? ` — ${quality === "Elite" ? "элитный" : "сильный"}`
        : "";
      const uncertain = entry.status === "unverified" ? " †" : "";
      return `${entry.ru}${suffix}${uncertain} (${original})`;
    });
  };
}
