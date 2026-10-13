import { expect, test } from "@playwright/test";
import { createTransferUrl } from "../../assets/transfer.js";

test("saved progress can be transferred while route data is still loading", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "hellisus-checklist-v1",
      JSON.stringify({
        completed: ["act-1-starting-worn-cap"],
        currentItemId: "act-1-step-003",
        language: "ru",
        theme: "dark",
      }),
    ),
  );
  let releaseData;
  const dataGate = new Promise((resolve) => {
    releaseData = resolve;
  });
  await page.route(/\/data\/.*\.json(?:\?.*)?$/, async (route) => {
    await dataGate;
    await route.continue();
  });
  try {
    await page.goto("./", { waitUntil: "domcontentloaded" });
    await page.locator("#transfer-progress").click();
    await expect(page.locator("#transfer-dialog")).toBeVisible();
    const link = await page.locator("#transfer-link").inputValue();
    expect(link).toBe(
      createTransferUrl(page.url(), {
        completed: ["act-1-starting-worn-cap"],
        currentItemId: "act-1-step-003",
        language: "ru",
        theme: "dark",
      }),
    );
  } finally {
    releaseData();
    await page.unrouteAll({ behavior: "wait" });
  }
});

import { transferIds } from "../../assets/transfer-catalog.js";

test("transfer link previews before replacement, survives reload and can be cancelled", async ({
  page,
  browser,
}) => {
  await page.goto("./");
  const first = page
    .locator(".route-section[open] input[data-item-id]")
    .first();
  await first.check();
  const firstId = await first.getAttribute("id");
  await page.locator('[data-view="current"]').click();
  await page.locator("#current-step").selectOption("act-1-step-003");
  await page.locator("#transfer-progress").click();
  await expect(page.locator("#transfer-dialog")).toBeVisible();
  await expect(page.locator("#transfer-qr svg")).toBeVisible();
  const link = await page.locator("#transfer-link").inputValue();
  expect(link).toContain("/hellisus-cheatsheet/#progress=1.");

  const receiverContext = await browser.newContext();
  const receiver = await receiverContext.newPage();
  await receiver.goto(new URL(".", link).href);
  const oldCheck = receiver
    .locator(".route-section[open] input[data-item-id]")
    .nth(1);
  const oldId = await oldCheck.getAttribute("id");
  await oldCheck.check();
  await receiver.goto(link);
  await expect(receiver.locator("#confirm-dialog")).toBeVisible();
  await expect(receiver.locator(`#${firstId}`)).not.toBeChecked();
  await expect(receiver.locator(`#${oldId}`)).toBeChecked();
  await receiver.locator('#confirm-dialog button[value="cancel"]').click();
  await receiver.reload();
  await expect(receiver.locator("#confirm-dialog")).toBeHidden();
  await expect(receiver.locator(`#${firstId}`)).not.toBeChecked();

  await receiver.goto(link);
  await receiver.locator("#confirm-action").click();
  await expect(receiver.locator(`#${firstId}`)).toBeChecked();
  await expect(receiver.locator(`#${oldId}`)).not.toBeChecked();
  await expect(receiver.locator("#current-step")).toHaveValue("act-1-step-003");
  await receiver.reload();
  await expect(receiver.locator(`#${firstId}`)).toBeChecked();
  await expect(receiver.locator("#confirm-dialog")).toBeHidden();
  await receiverContext.close();
});

test("a full mobile save produces a QR that an independent decoder reads back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    (completed) =>
      localStorage.setItem(
        "hellisus-checklist-v1",
        JSON.stringify({
          completed,
          language: "ru",
          theme: "dark",
          currentItemId: "act-1-step-003",
        }),
      ),
    transferIds,
  );
  await page.goto("./");
  await page.locator("#transfer-progress").click();
  const link = await page.locator("#transfer-link").inputValue();
  await page.addScriptTag({ path: "node_modules/jsqr/dist/jsQR.js" });
  const decoded = await page
    .locator("#transfer-qr svg")
    .evaluate(async (svg) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      await image.decode();
      const size = Math.round(svg.getBoundingClientRect().width);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      const pixels = context.getImageData(0, 0, size, size);
      return window.jsQR(pixels.data, size, size)?.data;
    });
  expect(decoded).toBe(link);
  expect(link.length).toBeLessThan(250);
});

test("a transfer arriving during confirmation is handled after the first one", async ({
  page,
}) => {
  await page.goto("./");
  const first = createTransferUrl(page.url(), {
    completed: ["act-1-starting-worn-cap"],
    currentItemId: "act-1-step-003",
    language: "ru",
    theme: "dark",
  });
  const second = createTransferUrl(page.url(), {
    completed: [],
    currentItemId: "act-1-step-004",
    language: "en",
    theme: "light",
  });
  await page.goto(first);
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.goto(second);
  await page.locator("#confirm-action").click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator("#confirm-action").click();
  await expect(page.locator("#current-step")).toHaveValue("act-1-step-004");
  await expect(page.locator("#current-route-check")).not.toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("an incoming transfer cannot cancel an already confirmed reset", async ({
  page,
}) => {
  await page.goto("./");
  const first = page
    .locator(".route-section[open] input[data-item-id]")
    .first();
  await first.check();
  await page.locator("#reset-progress").click();
  const link = createTransferUrl(page.url(), {
    completed: ["act-1-step-003"],
    language: "en",
    theme: "light",
  });
  await page.goto(link);
  await page.locator("#confirm-action").click();
  await expect(first).not.toBeChecked();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator('#confirm-dialog button[value="cancel"]').click();
  await expect(page.locator("#progress-count")).toContainText("0 ");
});

test("malformed transfers leave saved progress intact and ordinary anchors still work", async ({
  page,
}) => {
  await page.goto("./");
  const first = page
    .locator(".route-section[open] input[data-item-id]")
    .first();
  await first.check();
  await page.goto("./#progress=1.broken.12345678");
  await expect(page.locator("#toast")).toBeVisible();
  await expect(page.locator("#confirm-dialog")).toBeHidden();
  await expect(first).toBeChecked();
  await page.goto("./#current");
  await expect(page.locator("#current")).toBeVisible();
});

test("mobile transfer offers a selectable link when clipboard access is denied", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    }),
  );
  await page.goto("./");
  await page.locator("#transfer-progress").click();
  await page.locator("#transfer-copy").click();
  await expect(page.locator("#transfer-status")).not.toBeEmpty();
  expect(
    await page
      .locator("#transfer-link")
      .evaluate((input) => input.selectionEnd - input.selectionStart),
  ).toBeGreaterThan(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#transfer-dialog")).toBeHidden();
});
