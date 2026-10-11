import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, posix, resolve } from "node:path";

const paths = ["index.html"];
for (const directory of ["assets", "data"]) {
  for (const entry of await readdir(directory, { recursive: true })) {
    const path = `${directory}/${entry.replaceAll("\\", "/")}`;
    if ((await stat(path)).isFile()) paths.push(path);
  }
}

const files = new Map();
const hash = createHash("sha256");
for (const path of paths.sort()) {
  const content = await readFile(path);
  files.set(path, content);
  hash.update(path).update("\0").update(content).update("\0");
}
const version = hash.digest("hex").slice(0, 16);

// Imports do not inherit the entry module's query string. Version every local
// dependency and JSON request so a release cannot mix cached and fresh files.
function versionReferences(content, path) {
  return content.replace(
    /(["'])(\.{1,2}\/[^"'\s?#]+\.(?:js|css|svg|json))\1/g,
    (_match, quote, url) => {
      const target = posix.normalize(posix.join(posix.dirname(path), url));
      if (!files.has(target))
        throw new Error(`Unpublished resource in ${path}: ${url}`);
      return `${quote}${url}?v=${version}${quote}`;
    },
  );
}

const destination = resolve("dist");
for (const [path, content] of files) {
  const output = resolve(destination, path);
  await mkdir(dirname(output), { recursive: true });
  const textFile = [".html", ".js"].includes(extname(path));
  await writeFile(
    output,
    textFile ? versionReferences(content.toString("utf8"), path) : content,
  );
}
console.log(
  `Static site built in dist/ (release ${version}, relative versioned URLs).`,
);
