try {
  const preferences = JSON.parse(localStorage.getItem("hellisus-checklist-v1"));
  if (preferences && ["light", "dark"].includes(preferences.theme)) {
    document.documentElement.dataset.theme = preferences.theme;
  }
} catch {
  // CSS follows the system preference when saved settings are inaccessible.
}
