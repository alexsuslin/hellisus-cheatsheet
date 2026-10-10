export const STORAGE_KEY = "hellisus-checklist-v1";

export function loadState(storage) {
  let saved;
  try {
    saved = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: {}, available: false };
  }

  try {
    const state = JSON.parse(saved);
    return {
      state:
        state && typeof state === "object" && !Array.isArray(state)
          ? state
          : {},
      available: true,
    };
  } catch {
    return { state: {}, available: true };
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function saveProgress(storage, state, change) {
  const latest = loadState(storage).state;
  const savedCompletion = Array.isArray(latest.completed)
    ? latest.completed.filter((id) => typeof id === "string")
    : state.completed;
  const edits = change?.edits ?? (change?.id ? [change] : []);
  const completed = rebaseCompletion(
    change?.replace ? state.completed : savedCompletion,
    edits,
  );

  // A checkbox edit merges with the latest save; import/reset intentionally replace it.
  const updated = { ...state, completed };
  const available = saveState(storage, updated);
  if (available) return { state: updated, available };

  // Failed writes leave the browser's older save behind. Keep all unsaved edits in memory.
  return {
    state: { ...state, completed: rebaseCompletion(state.completed, edits) },
    available: false,
  };
}

export function rebaseCompletion(savedIds, edits) {
  const completed = new Set(savedIds);
  for (const { id, checked } of edits) {
    if (checked) completed.add(id);
    else completed.delete(id);
  }
  return [...completed];
}
