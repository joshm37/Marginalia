import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
  rename,
  readdir,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { watch } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "extension");
const outputRoot = path.join(root, ".extension-build");
const production = process.argv.includes("--production");
const destination = path.join(
  outputRoot,
  production ? "production" : "marginalia",
);
const output = `${destination}-staging`;
if (process.argv.includes("--clean")) {
  await rm(outputRoot, { recursive: true, force: true });
  console.log("Removed generated .extension-build output only.");
  process.exit(0);
}
if (process.argv.includes("--watch")) {
  const rebuild = () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url)],
      { cwd: root, stdio: "inherit" },
    );
    if (result.status !== 0)
      console.error("Build failed; correct the error before reloading Chrome.");
  };
  rebuild();
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 200);
  };
  for (const directory of [
    source,
    path.join(root, "lib/local-documents"),
    path.join(root, "lib/metadata"),
  ])
    watch(directory, { recursive: true }, schedule);
  console.log(
    "Watching extension and shared PDF utilities. After each build, reload the extension AND the target webpage.",
  );
  await new Promise(() => {});
}
const apiArgument = process.argv.find((value) =>
  value.startsWith("--api-base="),
);
const apiBase = (
  apiArgument?.split("=").slice(1).join("=") ||
  process.env.EXTENSION_API_BASE ||
  ""
).replace(/\/$/, "");

let validProductionOrigin = false;
try {
  const url = new URL(apiBase);
  validProductionOrigin =
    url.protocol === "https:" &&
    url.origin === apiBase &&
    !url.username &&
    !url.password &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
} catch {}
if (production && !validProductionOrigin) {
  console.error(
    "Production builds require EXTENSION_API_BASE=https://your-domain.example (no path).",
  );
  process.exit(1);
}

const resolvedBase = production ? apiBase : "http://localhost:3000";
await mkdir(outputRoot, { recursive: true });
const lock = `${destination}.lock`;
try {
  await mkdir(lock);
} catch {
  throw new Error(
    `Another extension build is running. Stop it before rebuilding. If it crashed, remove only ${lock}.`,
  );
}
try {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, {
    recursive: true,
    filter: (file) =>
      !path.basename(file).startsWith(".") &&
      !/\.(map|log|zip|pem|crx)$/.test(file),
  });

  const manifestPath = path.join(output, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const commit =
    spawnSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).stdout?.trim() || "unknown";
  const builtAt = new Date().toISOString();
  const buildId = `${commit}/${builtAt}`;
  manifest.version_name = `${manifest.version} ${production ? "production" : "dev"} ${buildId}`;
  manifest.host_permissions = [`${resolvedBase}/*`, "file:///*"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    path.join(output, "config.js"),
    `export const EXTENSION_CONFIG = Object.freeze(${JSON.stringify(
      {
        environment: production ? "production" : "development",
        apiBase: resolvedBase,
        appBase: resolvedBase,
      },
      null,
      2,
    )});\n`,
  );

  const hashes = {};
  // Compile the website's actual local-document utilities; keep one implementation.
  for (const [input, target] of [
    ["lib/local-documents/hash.ts", "local-hash.js"],
    ["lib/local-documents/validation.ts", "local-validation.js"],
    ["lib/local-documents/pdf-metadata.ts", "local-metadata.js"],
    ["lib/metadata/provenance.ts", "local-provenance.js"],
  ]) {
    const original = await readFile(path.join(root, input), "utf8");
    const compiled = ts
      .transpileModule(original, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replaceAll(
        "@/lib/metadata/provenance",
        "./local-provenance.js",
      )
      .replaceAll("pdfjs-dist/legacy/build/pdf.mjs", "./pdf.mjs")
      .replaceAll(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        "./pdf.worker.min.mjs",
      )
      .replaceAll("process.env.NEXT_PUBLIC_MAX_LOCAL_PDF_MB", "undefined");
    await writeFile(path.join(output, target), compiled);
  }
  await writeFile(
    path.join(output, "local-document-utils.js"),
    'export * from "./local-hash.js";\nexport * from "./local-validation.js";\nexport * from "./local-metadata.js";\n',
  );
  for (const file of ["pdf.mjs", "pdf.worker.min.mjs"])
    await cp(
      path.join(root, "node_modules/pdfjs-dist/legacy/build", file),
      path.join(output, file),
    );
  await cp(
    path.join(root, "node_modules/pdfjs-dist/LICENSE"),
    path.join(output, "PDFJS-LICENSE"),
  );
  for (const [file, context] of [
    ["popup.js", "POPUP"],
    ["background.js", "SERVICE WORKER"],
    ["content.js", "CONTENT SCRIPT"],
  ]) {
    const contents = await readFile(path.join(source, file), "utf8");
    hashes[file] = createHash("sha256").update(contents).digest("hex");
    const marker = production
      ? `// Marginalia build ${buildId}\n`
      : `console.info(${JSON.stringify(`[MARGINALIA ${context}] build ${buildId} API ${resolvedBase}`)});\n`;
    const footer =
      file === "popup.js"
        ? `\n{ const info = document.createElement("small"); info.textContent = ${JSON.stringify(`Marginalia ${manifest.version} · ${production ? "Production" : "Dev"} ${buildId} · API ${resolvedBase}`)}; info.style.cssText = "display:block;padding:8px 16px;opacity:.7;overflow-wrap:anywhere"; document.body.append(info); }\n`
        : "";
    await writeFile(path.join(output, file), marker + contents + footer);
    const check = spawnSync(
      process.execPath,
      ["--check", path.join(output, file)],
      { encoding: "utf8" },
    );
    if (check.status !== 0)
      throw new Error(`${file} syntax check failed: ${check.stderr}`);
  }
  await writeFile(
    path.join(output, "build-info.json"),
    JSON.stringify(
      {
        buildId,
        builtAt,
        commit,
        environment: production ? "production" : "development",
        apiBase: resolvedBase,
        sourceHashes: hashes,
      },
      null,
      2,
    ),
  );
  for (const file of [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((item) => item.js),
  ])
    await readFile(path.join(output, file));
  for (const file of await readdir(output)) {
    if (!/\.m?js$/.test(file)) continue;
    const contents = await readFile(path.join(output, file), "utf8");
    for (const match of contents.matchAll(
      /(?:from\s*|import\s*\()\s*["'](\.\.?\/[^"']+)["']/g,
    ))
      await readFile(path.resolve(output, match[1]));
  }
  await rm(destination, { recursive: true, force: true });
  await rename(output, destination);
  console.log(
    `Load unpacked: ${destination}\nBuild: ${buildId}\nAPI: ${resolvedBase}`,
  );

  if (production) {
    const archive = path.join(
      outputRoot,
      `marginalia-extension-${manifest.version}.zip`,
    );
    await rm(archive, { force: true });
    const zipped = spawnSync("zip", ["-qr", archive, "."], {
      cwd: destination,
      stdio: "inherit",
    });
    if (zipped.status !== 0) {
      throw new Error(
        `Could not create ZIP. Unpacked build remains at ${destination}`,
      );
    }
    console.log(
      `Built ${production ? "production" : "development"} extension: ${archive}`,
    );
  }
} finally {
  await rm(lock, { recursive: true, force: true });
}
