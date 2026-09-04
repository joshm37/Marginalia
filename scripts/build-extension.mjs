import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "extension");
const outputRoot = path.join(root, ".extension-build");
const output = path.join(outputRoot, "marginalia");
const apiArgument = process.argv.find((value) => value.startsWith("--api-base="));
const apiBase = (apiArgument?.split("=").slice(1).join("=") || process.env.EXTENSION_API_BASE || "").replace(/\/$/, "");
const production = process.argv.includes("--production");

if (production && !/^https:\/\/[^/]+$/i.test(apiBase)) {
  console.error("Production builds require EXTENSION_API_BASE=https://your-domain.example (no path).");
  process.exit(1);
}

const resolvedBase = production ? apiBase : "http://localhost:3000";
await rm(outputRoot, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

const manifestPath = path.join(output, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.host_permissions = [`${resolvedBase}/*`];
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  path.join(output, "config.js"),
  `export const EXTENSION_CONFIG = Object.freeze(${JSON.stringify({
    environment: production ? "production" : "development",
    apiBase: resolvedBase,
    appBase: resolvedBase,
  }, null, 2)});\n`,
);

const archive = path.join(outputRoot, `marginalia-extension-${manifest.version}.zip`);
const zipped = spawnSync("zip", ["-qr", archive, "marginalia"], {
  cwd: outputRoot,
  stdio: "inherit",
});
if (zipped.status !== 0) {
  console.error("Could not create the ZIP. The unpacked build remains at", output);
  process.exit(zipped.status || 1);
}
console.log(`Built ${production ? "production" : "development"} extension: ${archive}`);
