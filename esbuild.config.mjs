import { buildParserFile } from "@lezer/generator";
import builtins from "builtin-modules";
import * as chokidar from "chokidar";
import esbuild from "esbuild";
import { readFile, unlink, writeFile } from "fs/promises";
import glob from "glob";
import { parse, sep } from "path";
import process from "process";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

function log(kind, msgs) {
  if (msgs.length === 0) {
    return;
  }

  const formatted = esbuild.formatMessagesSync(
    msgs.map((text) => ({ text })),
    { kind, color: true }
  );

  console.log(formatted.join(""));
}

async function buildLezerGrammar(path) {
  console.clear();
  console.log();

  let input;

  try {
    input = await readFile(path, "utf8");
  } catch (e) {
    return;
  }

  const { dir, name } = parse(path);
  const parserPath = `${dir}${sep}${name}.parser.js`;
  const termsPath = `${dir}${sep}${name}.terms.js`;

  let parser, terms;
  let warnings = [];

  function printWarnings() {
    if (warnings.length > 0) {
      log("warning", warnings);
      warnings = [];
    }
  }

  try {
    const res = buildParserFile(input, {
      fileName: path,
      includeNames: !prod,
      warn: (str) => warnings.push(str)
    });

    parser = res.parser;
    terms = res.terms;
  } catch (e) {
    await Promise.allSettled([unlink(parserPath), unlink(termsPath)]);

    if (warnings.length > 0) {
      log("warning", warnings);
      warnings = [];
    }

    printWarnings();
    log("warning", [`Removed: ${parserPath}`, `Removed: ${termsPath}`]);
    log("error", [e.message]);

    return;
  }

  printWarnings();

  await Promise.allSettled([
    writeFile(parserPath, parser),
    writeFile(termsPath, terms)
  ]);
}

(async () => {
  const grammarPaths = "src/**/*.grammar";

  if (prod) {
    await Promise.allSettled(
      (await glob(grammarPaths)).map((path) => buildLezerGrammar(path))
    );
  } else {
    const watcher = chokidar.watch(grammarPaths);

    watcher.on("add", buildLezerGrammar);
    watcher.on("change", buildLezerGrammar);
  }

  const context = await esbuild
    .context({
      banner: { js: banner },
      entryPoints: ["src/main.ts"],
      bundle: true,
      external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins
      ],
      format: "cjs",
      target: "es2018",
      logLevel: !prod ? "warning" : "info",
      sourcemap: prod ? false : "inline",
      treeShaking: true,
      outfile: "main.js"
    })
    .catch(() => process.exit(1));

  if (prod) {
    await context.rebuild();
    return await context.dispose();
  }

  await context.watch();
  await context.rebuild();
})();
