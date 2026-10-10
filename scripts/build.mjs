import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const destination = resolve("dist");
await mkdir(destination, { recursive: true });
for (const file of ["index.html", "assets", "data"]) {
  await cp(resolve(file), resolve(destination, file), { recursive: true });
}
console.log("Static site built in dist/ (all assets use relative URLs).");
