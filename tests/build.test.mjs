import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { load } from "cheerio";

const execute = promisify(execFile);
const buildScript = fileURLToPath(
  new URL("../scripts/build.mjs", import.meta.url),
);

test("each release changes all resource URLs when code or data changes, including nested imports", async (context) => {
  const cache = resolve(".cache");
  await mkdir(cache, { recursive: true });
  const fixture = await mkdtemp(resolve(cache, "build-test-"));
  assert.ok(fixture.startsWith(`${cache}${sep}`));
  context.after(() => rm(fixture, { recursive: true, force: true }));
  await mkdir(resolve(fixture, "assets"));
  await mkdir(resolve(fixture, "data"));
  const files = {
    "index.html":
      '<link rel="stylesheet" href="./assets/styles.css"><link rel="icon" href="./assets/favicon.svg"><script type="module" src="./assets/app.js"></script>',
    "assets/styles.css": "body { color: green; }",
    "assets/favicon.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "assets/app.js":
      'import { value } from "./model.js"; fetch(new URL("../data/guide.json", import.meta.url));',
    "assets/model.js":
      'import { saved } from "./storage.js"; export const value = saved;',
    "assets/storage.js":
      'export const saved = localStorage.getItem("hellisus-checklist-v1");',
    "data/guide.json": '{"version":1}',
  };
  for (const [path, content] of Object.entries(files))
    await writeFile(resolve(fixture, path), content);

  async function buildAndCheck() {
    await execute(process.execPath, [buildScript], { cwd: fixture });
    const html = await readFile(resolve(fixture, "dist/index.html"), "utf8");
    const $ = load(html);
    const urls = $("[src],[href]")
      .map((_, node) => $(node).attr("src") ?? $(node).attr("href"))
      .get();
    const version = new URL(
      urls[0],
      "https://example.com/project/",
    ).searchParams.get("v");
    assert.match(version ?? "", /^[a-f0-9]{16}$/);
    for (const url of urls)
      assert.equal(
        new URL(url, "https://example.com/project/").searchParams.get("v"),
        version,
      );
    for (const file of ["assets/app.js", "assets/model.js"]) {
      const javascript = await readFile(resolve(fixture, "dist", file), "utf8");
      const references = [...javascript.matchAll(/["'](\.{1,2}\/[^"']+)["']/g)];
      assert.ok(references.length);
      for (const [, path] of references) {
        const url = new URL(path, `https://example.com/project/${file}`);
        assert.equal(
          url.searchParams.get("v"),
          version,
          `Stale nested resource: ${path}`,
        );
        await readFile(
          resolve(fixture, "dist", url.pathname.slice("/project/".length)),
        );
      }
    }
    return html;
  }

  const first = await buildAndCheck();
  assert.equal(
    await buildAndCheck(),
    first,
    "Identical input must produce identical resource URLs",
  );
  await writeFile(
    resolve(fixture, "assets/storage.js"),
    `${files["assets/storage.js"]}\nexport const release = 2;`,
  );
  const second = await buildAndCheck();
  assert.notEqual(
    second,
    first,
    "Nested module edits must invalidate entry assets",
  );
  await writeFile(resolve(fixture, "data/guide.json"), '{"version":2}');
  assert.notEqual(
    await buildAndCheck(),
    second,
    "Data-only changes must invalidate entry assets",
  );
  assert.equal(
    await readFile(resolve(fixture, "assets/model.js"), "utf8"),
    files["assets/model.js"],
    "Building must not rewrite source modules",
  );
  assert.equal(
    await readFile(resolve(fixture, "dist/assets/storage.js"), "utf8"),
    `${files["assets/storage.js"]}\nexport const release = 2;`,
  );
});
