import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv.includes("--dist") ? "dist" : ".");
const port = Number(process.env.PORT || 4173);
const prefix = process.argv.includes("--subpath") ? "/hellisus-cheatsheet" : "";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (prefix && !pathname.startsWith(`${prefix}/`)) {
      response.writeHead(302, { Location: `${prefix}/` });
      response.end();
      return;
    }

    const relative =
      pathname.slice(prefix.length).replace(/^\/+/, "") || "index.html";
    const file = resolve(root, relative);
    // Local preview exposes only the assets that will be published, never .git.
    const allowed =
      file === resolve(root, "index.html") ||
      file.startsWith(`${resolve(root, "assets")}${sep}`) ||
      file.startsWith(`${resolve(root, "data")}${sep}`);
    if (
      !allowed ||
      !file.startsWith(`${root}${sep}`) ||
      !(await stat(file)).isFile()
    ) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${server.address().port}${prefix}/`),
);
