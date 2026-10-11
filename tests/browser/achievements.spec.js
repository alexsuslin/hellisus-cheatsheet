import { expect, test } from "@playwright/test";

test("achievement completion is independent from route progress and survives reload", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.locator('[data-view="achievements"]').click();
  await expect(page.locator(".achievement-card")).toHaveCount(40);
  const card = page.locator("#achievement-its-mine-now");
  await expect(card.getByRole("checkbox")).toHaveAccessibleName(
    "Unlocked in game: It's Mine Now",
  );
  await card.getByRole("checkbox").check();
  await expect(page.locator("#achievement-count")).toHaveText("1 / 40");
  await expect(page.locator("#progress-count")).toContainText("0 of");
  await card.getByRole("button", { name: /Related route steps/ }).click();
  await card.locator('[data-route-item="act-1-step-026"]').click();
  await expect(page.locator("#check-act-1-step-026")).toBeVisible();
  await expect(page.locator("#check-act-1-step-026")).toBeFocused();
  await page.locator("#check-act-1-step-026").check();
  await expect(page.locator("#progress-count")).toContainText("1 of");
  await page.locator('[data-view="achievements"]').click();
  await expect(card.getByRole("checkbox")).toBeChecked();
  await expect(card.locator(".achievement-route-progress")).toHaveText(
    "Related route steps: 1 / 2",
  );
  await page.locator("#achievement-hide-completed").check();
  await expect(page.locator("#achievement-its-mine-now")).toHaveCount(0);
  await expect(page.locator("#achievement-count")).toHaveText("1 / 40");
  await page.locator("#achievement-hide-completed").uncheck();
  await page.reload();
  await expect(page.locator("#achievements")).toBeVisible();
  await expect(
    page.locator("#achievement-its-mine-now").getByRole("checkbox"),
  ).toBeChecked();
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await expect(
    page.locator("#achievement-its-mine-now .achievement-title"),
  ).toHaveText("Теперь моё");
});

test("platform, missable and bilingual search filters work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("./#achievements");
  await expect(page.locator(".achievement-card")).toHaveCount(40);
  await page.locator("#achievement-platform").selectOption("ps5");
  await expect(page.locator(".achievement-card")).toHaveCount(41);
  await page.locator("#achievement-missable").check();
  await expect(page.locator(".achievement-card")).toHaveCount(7);
  await page.locator("#achievement-search").fill("реликвии");
  await expect(page.locator(".achievement-card")).toHaveCount(1);
  await expect(page.locator("#achievement-antiquarian")).toBeVisible();
  await page.locator("#achievement-clear").click();
  await page.locator("#achievement-search").fill("NO-MATCH-123");
  await expect(page.locator("#achievement-empty")).toBeVisible();
  await page.locator("#achievement-empty-clear").click();
  await expect(page.locator(".achievement-card")).toHaveCount(41);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("one backup includes both trackers and route links clear obstructing filters", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .locator(".route-section[open] input[data-item-id]")
    .first()
    .check();
  await page.locator("#search").fill("no-route-match");
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.locator('[data-view="achievements"]').click();
  await page.locator("#achievement-so-it-begins").getByRole("checkbox").check();
  const downloading = page.waitForEvent("download");
  await page.locator("#export-progress").click();
  const backup = await (await downloading).path();
  await page.locator("#reset-progress").click();
  await page.locator("#confirm-action").click();
  await expect(page.locator("#achievement-count")).toHaveText("0 / 40");
  await page.locator("#import-file").setInputFiles(backup);
  await page.locator("#confirm-action").click();
  await expect(
    page.locator("#achievement-so-it-begins").getByRole("checkbox"),
  ).toBeChecked();
  await expect(page.locator("#progress-count")).toContainText("1 ");
  const card = page.locator("#achievement-so-it-begins");
  await card.locator("[data-route-toggle]").click();
  await card.locator('[data-route-item="act-1-step-151"]').click();
  await expect(page.locator("#search")).toHaveValue("");
  await expect(page.locator("#check-act-1-step-151")).toBeVisible();
  await page.locator('[data-related-achievements="act-1-step-151"]').click();
  await expect(page.locator(".achievement-card")).toHaveCount(1);
  await expect(page.locator("#achievement-so-it-begins")).toBeVisible();
});

test("a missable shortcut returns to the route and the achievement header can reopen the tracker", async ({
  page,
}) => {
  await page.goto("./#achievements");
  await page.locator("#show-missables").click();
  await expect(page.locator("#walkthrough-panel")).toBeVisible();
  await page.locator('.header-links a[href="#achievements"]').click();
  await expect(page.locator("#achievements")).toBeVisible();
});

test("achievement checkbox edits merge between two tabs", async ({
  page,
  context,
}) => {
  await page.goto("./#achievements");
  const other = await context.newPage();
  await other.goto("./#achievements");
  await page.locator("#achievement-so-it-begins").getByRole("checkbox").check();
  await expect(
    other.locator("#achievement-so-it-begins").getByRole("checkbox"),
  ).toBeChecked();
  await other
    .locator("#achievement-emotional-baggage")
    .getByRole("checkbox")
    .check();
  await expect(
    page.locator("#achievement-emotional-baggage").getByRole("checkbox"),
  ).toBeChecked();
  await expect(page.locator("#achievement-count")).toHaveText("2 / 40");
});
