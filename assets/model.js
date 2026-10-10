export function filterItems(items, filters, completed) {
  const query = (filters.query ?? "").trim().toLocaleLowerCase();

  return items.filter((item) => {
    const categories = item.categories ?? [item.category];
    if (
      filters.category &&
      filters.category !== "all" &&
      !categories.includes(filters.category)
    )
      return false;
    if (filters.missableOnly && !item.missable) return false;
    if (filters.hideCompleted && completed.has(item.id)) return false;
    if (!query) return true;

    const searchText = [
      ...Object.values(item.title),
      ...Object.values(item.description),
      ...(item.searchTerms ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return searchText.includes(query);
  });
}

export function getProgress(items, completed) {
  const count = items.filter((item) => completed.has(item.id)).length;
  return {
    completed: count,
    total: items.length,
    percent: items.length ? Math.round((count / items.length) * 100) : 0,
  };
}

export function parseBackup(text, knownIds) {
  const backup = JSON.parse(text);
  if (
    !backup ||
    backup.app !== "hellisus-cheatsheet" ||
    backup.version !== 1 ||
    !Array.isArray(backup.completed) ||
    !backup.completed.every((id) => typeof id === "string")
  ) {
    throw new Error("Invalid checklist backup");
  }
  if (backup.language !== undefined && !["ru", "en"].includes(backup.language))
    throw new Error("Invalid language");
  if (backup.theme !== undefined && !["light", "dark"].includes(backup.theme))
    throw new Error("Invalid theme");

  return {
    completed: [...new Set(backup.completed)].filter((id) => knownIds.has(id)),
    ...(backup.language ? { language: backup.language } : {}),
    ...(backup.theme ? { theme: backup.theme } : {}),
  };
}
