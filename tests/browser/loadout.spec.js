import { expect, test } from "@playwright/test";

test("closing a loop in Tips updates the route and its hide-completed filter", async ({
  page,
}) => {
  await page.goto("./#act-1-step-104");
  await page.locator("#hide-completed").check();
  await page.locator('[data-view="tips"]').click();
  await page.locator('#loop-vyssa input[type="checkbox"]').check();
  await page.locator('[data-view="walkthrough"]').click();
  await expect(page.locator("#check-act-1-step-104")).toHaveCount(0);
  await page.locator("#hide-completed").uncheck();
  await expect(page.locator("#check-act-1-step-104")).toBeChecked();
});

test("build filters preserve keyboard focus and mobile tabs do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("./#build");
  await page.locator("#build-hide-completed").check();
  const stage = page.locator("#build-base");
  await stage.locator('[data-progress-phase="obtained"]').check();
  const applied = stage.locator('[data-progress-phase="applied"]');
  await applied.focus();
  await page.keyboard.press("Space");
  await expect(stage).toHaveCount(0);
  await expect(
    page.locator('#build-spike [data-progress-phase="obtained"]'),
  ).toBeFocused();
  for (const language of ["EN", "RU"]) {
    await page.getByRole("button", { name: language, exact: true }).click();
    for (const view of ["build", "tips"]) {
      await page.locator(`[data-view="${view}"]`).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("build acquisition and application stay independent from the route and persist", async ({
  page,
}) => {
  await page.goto("./#build");
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await expect(page.locator("#build")).toBeVisible();
  const stage = page.locator("#build-copse");
  await stage.locator('[data-progress-phase="obtained"]').check();
  await expect(
    stage.locator('[data-progress-phase="applied"]'),
  ).not.toBeChecked();
  await expect(page.locator("#progress-count")).toContainText("0 из");
  await expect(page.locator("#build-next")).toContainText("Зал Поросли");
  await stage.locator('[data-progress-phase="applied"]').check();
  await page.reload();
  await expect(stage.locator('[data-progress-phase="obtained"]')).toBeChecked();
  await expect(stage.locator('[data-progress-phase="applied"]')).toBeChecked();
  await stage.locator("summary").click();
  await stage.locator('[data-route-item="act-3-cleanup-step-019"]').click();
  await expect(page.locator("#check-act-3-cleanup-step-019")).toBeFocused();
  await expect(page.locator("#check-act-3-cleanup-step-019")).not.toBeChecked();
  await page.locator('[data-view="tips"]').click();
  await expect(page.locator(".loop-card")).toHaveCount(14);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("#tips")).toContainText("Keep for farming");
});

test("build and tips participate in backup, reset, and old-save migration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("hellisus-checklist-v1"))
      localStorage.setItem(
        "hellisus-checklist-v1",
        JSON.stringify({
          language: "en",
          completed: ["act-1-step-026", "achievement-its-mine-now"],
        }),
      );
  });
  await page.goto("./#build");
  await page.locator('#build-copse [data-progress-phase="obtained"]').check();
  await page.locator('[data-view="tips"]').click();
  await page.locator('#tip-farm input[type="checkbox"]').check();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-progress").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk;
  const backup = JSON.parse(text);
  expect(backup.completed).toEqual(
    expect.arrayContaining([
      "act-1-step-026",
      "achievement-its-mine-now",
      "build-copse-obtained",
      "tip-farm",
    ]),
  );
  await page.locator("#reset-progress").click();
  await page.locator("#confirm-action").click();
  await expect(page.locator("#tip-farm input")).not.toBeChecked();
  await page.locator("#import-file").setInputFiles({
    name: "progress.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await page.locator("#confirm-action").click();
  await expect(page.locator("#tip-farm input")).toBeChecked();
  await page.locator('[data-view="build"]').click();
  await expect(
    page.locator('#build-copse [data-progress-phase="obtained"]'),
  ).toBeChecked();
  await expect(page.locator("#progress-count")).toContainText("1 of");
});
