import { expect, test } from "@playwright/test";

const firstCheckbox = (page) =>
  page.locator(".route-section[open] input[data-item-id]").first();

test("language, theme and reload preserve completion and open sections", async ({
  page,
}) => {
  await page.goto("./");
  await expect(firstCheckbox(page)).toBeVisible();
  expect(await page.locator(".checklist-item").count()).toBeGreaterThan(350);
  const first = firstCheckbox(page);
  const id = await first.getAttribute("id");
  await first.check();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(`#${id}`)).toBeChecked();
  await expect(page.locator("#progress-count")).toContainText("1 of");
  await page.locator("#theme-toggle").click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator(`#${id}`)).toBeChecked();
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await expect(page.locator("#progress-count")).toContainText("1 из");
});

test("search, multi-category filters and hide completed preserve overall progress", async ({
  page,
}) => {
  await page.goto("./");
  await firstCheckbox(page).check();
  await page.locator("#search").fill("водопад");
  await expect(
    page.locator(".item-title").filter({ hasText: "Gold Medallion" }),
  ).toBeVisible();
  await page.locator("#search").fill("Gold Medallion");
  await expect(page.locator(".checklist-item")).toHaveCount(1);
  await page.locator("#hide-completed").check();
  await expect(page.locator("#progress-count")).toContainText("1 ");
  await page.locator("#clear-filters").click();
  await page.locator("#missable-only").check();
  const rows = await page.locator(".checklist-item").count();
  expect(rows).toBeGreaterThan(10);
  await expect(page.locator(".checklist-item .missable-tag")).toHaveCount(rows);
  await page.locator("#category-filter").selectOption("good-deed");
  expect(await page.locator(".checklist-item").count()).toBeGreaterThan(0);
  await expect(page.locator("#progress-count")).toContainText("1 ");
  await page.locator("#search").fill("no-such-item-123");
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.locator("#empty-clear").click();
  await expect(page.locator("#empty-state")).toBeHidden();
});

test("backup restores progress, reset asks for confirmation, invalid import is harmless", async ({
  page,
}) => {
  await page.goto("./");
  await firstCheckbox(page).check();
  const downloading = page.waitForEvent("download");
  await page.locator("#export-progress").click();
  const download = await downloading;
  const backup = await download.path();
  await page.locator("#reset-progress").click();
  await page.locator('#confirm-dialog button[value="cancel"]').click();
  await expect(firstCheckbox(page)).toBeChecked();
  await page.locator("#reset-progress").click();
  await page.locator("#confirm-action").click();
  await expect(firstCheckbox(page)).not.toBeChecked();
  await page.locator("#import-file").setInputFiles(backup);
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator("#confirm-action").click();
  await expect(firstCheckbox(page)).toBeChecked();
  await page.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("null"),
  });
  await expect(page.locator("#toast")).toBeVisible();
  await expect(firstCheckbox(page)).toBeChecked();
});

test("mobile layout has no overflow and navigation opens the selected section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.locator(".checklist-item").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#mobile-nav-toggle").click();
  await expect(page.locator("#location-nav")).toBeVisible();
  const target = page.locator(".location-link").nth(1);
  const href = await target.getAttribute("href");
  await target.click();
  await expect(page.locator(href)).toHaveAttribute("open", "");
  await expect(page.locator("#location-nav")).toBeHidden();
  await page.setViewportSize({ width: 320, height: 700 });
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

test("two tabs merge completion and preserve unsaved edits through storage recovery", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      if (window.denyChecklistWrites)
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.goto("./");
  const other = await context.newPage();
  await other.goto("./");
  const firstId = await firstCheckbox(page).getAttribute("id");
  await page.evaluate(() => {
    window.denyChecklistWrites = true;
  });
  await firstCheckbox(page).check();
  await expect(page.locator("#storage-warning")).toBeVisible();
  const second = other
    .locator(".route-section[open] input[data-item-id]")
    .nth(1);
  const secondId = await second.getAttribute("id");
  await second.check();
  await other.locator("#theme-toggle").click();
  await expect(page.locator(`#${firstId}`)).toBeChecked();
  await expect(page.locator(`#${secondId}`)).toBeChecked();
  await expect(page.locator("#storage-warning")).toBeVisible();
  await page.evaluate(() => {
    window.denyChecklistWrites = false;
  });
  await page.locator("#theme-toggle").click();
  await expect(page.locator("#storage-warning")).toBeHidden();
  await expect(other.locator(`#${firstId}`)).toBeChecked();
  await expect(other.locator(`#${secondId}`)).toBeChecked();
});

test("language and theme still work when the guide cannot be loaded", async ({
  page,
}) => {
  await page.route("**/data/guide.json", (route) => route.abort());
  await page.goto("./");
  await expect(page.locator("#load-error")).toBeVisible();
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await expect(page.locator("#load-error")).toContainText("Не удалось");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("#load-error")).toContainText("Could not");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    /light|dark/,
  );
});
