import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";
import { load } from "cheerio";

test("repository-subpath preview serves all entry assets and rejects private paths", async (context) => {
  const child = spawn(process.execPath, ["scripts/serve.mjs", "--subpath"], {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => child.kill());
  const output = createInterface({ input: child.stdout });
  context.after(() => output.close());
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Preview did not start")),
      5000,
    );
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Preview exited: ${code}`));
    });
    output.once("line", (line) => {
      clearTimeout(timeout);
      resolve(line.replace("Local: ", ""));
    });
  });
  const response = await fetch(address);
  assert.equal(response.status, 200);
  const $ = load(await response.text());
  const assets = $("script[src],link[href]")
    .map((_, node) => $(node).attr("src") ?? $(node).attr("href"))
    .get();
  for (const asset of assets) {
    assert.equal(
      (await fetch(new URL(asset, address))).status,
      200,
      `Asset unavailable under repository path: ${asset}`,
    );
  }
  for (const path of [
    ".git/config",
    "README.md",
    "assets/%2e%2e%2f.git/config",
  ]) {
    assert.equal(
      (await fetch(`${address}${path}`)).status,
      404,
      `Private path exposed: ${path}`,
    );
  }
});
