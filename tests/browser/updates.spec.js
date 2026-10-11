import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execute = promisify(execFile);
const buildScript = fileURLToPath(
  new URL("../../scripts/build.mjs", import.meta.url),
);

test("updating a cached release preserves route, achievement, language and theme", async ({
  page,
}) => {
  const cache = resolve(".cache");
  await mkdir(cache, { recursive: true });
  const fixture = await mkdtemp(resolve(cache, "release-test-"));
  const destination = resolve(fixture, "dist");
  expect(fixture.startsWith(`${cache}${sep}`)).toBe(true);
  for (const path of ["index.html", "assets", "data"])
    await cp(resolve(path), resolve(fixture, path), { recursive: true });
  await execute(process.execPath, [buildScript], { cwd: fixture });

  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const path = resolve(
      destination,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    try {
      if (!path.startsWith(`${destination}${sep}`))
        throw new Error("Outside published files");
      const body = await readFile(path);
      response.writeHead(200, {
        "Content-Type": types[extname(path)],
        "Cache-Control":
          extname(path) === ".html" ? "no-cache" : "public, max-age=31536000",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  const address = `http://127.0.0.1:${server.address().port}/`;

  try {
    await page.goto(address);
    await page.locator("#check-act-1-step-004").check();
    await page.getByRole("button", { name: "RU", exact: true }).click();
    const theme = await page.locator("html").getAttribute("data-theme");
    await page.locator("#theme-toggle").click();
    const selectedTheme = theme === "dark" ? "light" : "dark";
    await page.locator('[data-view="achievements"]').click();
    await page
      .locator("#achievement-so-it-begins")
      .getByRole("checkbox")
      .check();
    const firstModule = await page
      .locator('script[type="module"]')
      .getAttribute("src");
    const saved = await page.evaluate(() =>
      localStorage.getItem("hellisus-checklist-v1"),
    );

    // Publish a data-only edit on the same origin while the browser keeps its
    // long-lived code/data cache and its original localStorage intact.
    const guidePath = resolve(fixture, "data/guide.json");
    const guide = JSON.parse(await readFile(guidePath, "utf8"));
    guide.sections[0].items[0].title.ru = "Проверка новой версии";
    await writeFile(guidePath, JSON.stringify(guide));
    await execute(process.execPath, [buildScript], { cwd: fixture });
    await page.reload();
    await expect(page.locator("#achievement-count")).toHaveText("1 / 40");
    await expect(
      page.locator("#achievement-so-it-begins").getByRole("checkbox"),
    ).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      selectedTheme,
    );
    expect(
      await page.locator('script[type="module"]').getAttribute("src"),
    ).not.toBe(firstModule);
    await page.locator('[data-view="walkthrough"]').click();
    await expect(page.locator("#check-act-1-step-004")).toBeChecked();
    await expect(page.locator(".item-title").first()).toHaveText(
      "Проверка новой версии",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("hellisus-checklist-v1")),
    ).toBe(saved);
  } finally {
    await new Promise((done) => server.close(done));
    await rm(fixture, { recursive: true, force: true });
  }
});
