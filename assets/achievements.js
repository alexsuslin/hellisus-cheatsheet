import { filterItems } from "./model.js";

export function getRelatedItems(achievement, items) {
  const itemIds = new Set(achievement.route.itemIds ?? []);
  const categories = new Set(achievement.route.categories ?? []);
  return items.filter(
    (item) =>
      itemIds.has(item.id) ||
      (item.categories ?? [item.category]).some((category) =>
        categories.has(category),
      ),
  );
}

export function filterAchievements(achievements, filters, completed) {
  const eligible = achievements.filter((achievement) => {
    if (achievement.platform === "ps5" && filters.platform !== "ps5")
      return false;
    if (
      filters.routeItemId &&
      !achievement.relatedItemIds.includes(filters.routeItemId)
    )
      return false;
    return true;
  });
  const searchable = eligible.map((achievement) => ({
    ...achievement,
    searchTerms: [
      ...(achievement.searchTerms ?? []),
      ...Object.values(achievement.hint ?? {}),
      ...Object.values(achievement.warning ?? {}),
    ],
  }));
  return filterItems(searchable, filters, completed);
}
