import { expect, test } from "@playwright/test";

for (const language of ["ru", "en"]) {
  test(`a saved loop step loads its rewards and keeps transfer usable in ${language}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (language) =>
        localStorage.setItem(
          "hellisus-checklist-v1",
          JSON.stringify({
            language,
            completed: ["act-1-starting-worn-cap"],
            currentItemId: "act-1-step-104",
          }),
        ),
      language,
    );
    await page.goto("./#current");
    await expect(page.locator("#current-loop-vyssa")).toContainText(
      "The Blood Queen’s Phalange",
    );
    await expect(page.locator("#current-loop-vyssa")).not.toContainText(
      "undefined",
    );
    await expect(page.locator("#load-error")).toBeHidden();
    await expect(page.locator("#current-step")).toHaveValue("act-1-step-104");
    await page.locator("#transfer-progress").click();
    await expect(page.locator("#transfer-dialog")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Current shares route, loop and build checks without conflating actions", async ({
  page,
}) => {
  await page.goto("./#current");
  await expect(page.locator("#current")).toBeVisible();
  await page.locator("#current-location").selectOption("act-1-3");
  await page.locator("#current-step").selectOption("act-1-step-104");
  await page.locator("#current-route-check").check();
  await page.locator('[data-view="tips"]').click();
  await expect(
    page.locator('#loop-vyssa input[type="checkbox"]'),
  ).toBeChecked();
  await page.locator('#loop-vyssa input[type="checkbox"]').uncheck();
  await page.locator('[data-view="current"]').click();
  await expect(page.locator("#current-route-check")).not.toBeChecked();

  await page.locator("#current-step").selectOption("act-1-step-093");
  await page
    .locator('#current-related [data-progress-id="build-mark-obtained"]')
    .check();
  await expect(page.locator("#current-route-check")).not.toBeChecked();
  await page.locator('[data-view="build"]').click();
  await expect(page.locator("#track-build-mark-obtained")).toBeChecked();
  await expect(page.locator("#track-build-mark-applied")).not.toBeChecked();
  await page.locator("#track-build-mark-applied").check();
  await page.locator('[data-view="current"]').click();
  await expect(
    page.locator('#current-related [data-progress-id="build-mark-applied"]'),
  ).toBeChecked();
  await page.reload();
  await expect(page.locator("#current-step")).toHaveValue("act-1-step-093");
});

test("Current resumes incomplete progress and navigation never checks steps", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "hellisus-checklist-v1",
      JSON.stringify({ completed: ["act-1-starting-worn-cap"] }),
    ),
  );
  await page.goto("./#current");
  await expect(page.locator("#current-step")).toHaveValue("act-1-step-003");
  await page.locator("#current-next").click();
  await expect(page.locator("#current-step")).toHaveValue("act-1-step-004");
  await expect(page.locator("#progress-count")).toContainText("1");
  await page.locator("#current-resume").click();
  await expect(page.locator("#current-step")).toHaveValue("act-1-step-003");
  await page.locator("#current-route-check").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#current-route-check")).toBeFocused();
  await expect(page.locator("#current-step")).toHaveValue("act-1-step-003");
});

test("Current keeps reminders and achievements editable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("./#current");
  await page.locator("#current-location").selectOption("act-1-2");
  await page.locator("#current-step").selectOption("act-1-step-030");
  await page.locator('#current-related [data-progress-id="tip-act1"]').check();
  const achievement = page
    .locator('#current-related [data-progress-id^="achievement-"]')
    .first();
  const achievementId = await achievement.getAttribute("data-progress-id");
  await achievement.check();
  await page.locator('[data-view="achievements"]').click();
  await expect(page.locator(`#unlock-${achievementId}`)).toBeChecked();
  await page.locator('[data-view="tips"]').click();
  await expect(page.locator("#track-tip-act1")).toBeChecked();
  await page.locator('[data-view="current"]').click();
  for (const language of ["RU", "EN"]) {
    await page.getByRole("button", { name: language, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("a completed collection step confirms obtained gear without equipping it or completing extra pickups", async ({
  page,
}) => {
  await page.goto("./#current");
  await page.locator("#current-location").selectOption("act-1-3");
  await page.locator("#current-step").selectOption("act-1-step-093");
  await page.locator("#current-route-check").check();
  await expect(
    page.locator("#current-check-build-mark-obtained"),
  ).toBeChecked();
  await expect(
    page.locator("#current-check-build-mark-applied"),
  ).not.toBeChecked();
  await page.locator('[data-view="build"]').click();
  await expect(page.locator("#track-build-mark-obtained")).toBeChecked();
  await page.locator('[data-view="current"]').click();
  // Undoing a route step does not mean the player lost a collected item.
  await page.locator("#current-route-check").uncheck();
  await expect(
    page.locator("#current-check-build-mark-obtained"),
  ).toBeChecked();
});

test("Current position and shared checks survive backup, reset and restore", async ({
  page,
}) => {
  await page.goto("./#current");
  await page.locator("#current-location").selectOption("act-1-3");
  await page.locator("#current-step").selectOption("act-1-step-093");
  await page.locator("#current-route-check").check();
  const downloading = page.waitForEvent("download");
  await page.locator("#export-progress").click();
  const download = await downloading;
  const stream = await download.createReadStream();
  let contents = "";
  for await (const chunk of stream) contents += chunk;
  expect(JSON.parse(contents).currentItemId).toBe("act-1-step-093");
  await page.locator("#reset-progress").click();
  await page.locator("#confirm-action").click();
  await expect(page.locator("#current-step")).toHaveValue(
    "act-1-starting-worn-cap",
  );
  await page.locator("#import-file").setInputFiles({
    name: "progress.json",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
  await page.locator("#confirm-action").click();
  await expect(page.locator("#current-step")).toHaveValue("act-1-step-093");
  await expect(page.locator("#current-route-check")).toBeChecked();
  await expect(
    page.locator("#current-check-build-mark-obtained"),
  ).toBeChecked();
});

test("derived acquisition survives denied storage and later recovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      if (window.denyWrites)
        throw new DOMException("Quota", "QuotaExceededError");
      return setItem.apply(this, args);
    };
  });
  await page.goto("./#current");
  await page.locator("#current-location").selectOption("act-1-3");
  await page.locator("#current-step").selectOption("act-1-step-093");
  await page.evaluate(() => {
    window.denyWrites = true;
  });
  await page.locator("#current-route-check").check();
  await expect(page.locator("#storage-warning")).toBeVisible();
  await expect(
    page.locator("#current-check-build-mark-obtained"),
  ).toBeChecked();
  await page.evaluate(() => {
    window.denyWrites = false;
  });
  await page.locator("#theme-toggle").click();
  await page.reload();
  await expect(page.locator("#current-route-check")).toBeChecked();
  await expect(
    page.locator("#current-check-build-mark-obtained"),
  ).toBeChecked();
});
