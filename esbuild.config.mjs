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

async function buildLezerGrammar(path) {
  let input;

  try {
    input = await readFile(path, "utf8");
  } catch (e) {
    return;
  }

  const { dir, name } = parse(path);
  const parserPath = `${dir}${sep}${name}.parser.ts`;
  const termsPath = `${dir}${sep}${name}.terms.ts`;

  let parser, terms;

  try {
    const res = buildParserFile(input, {
      fileName: path,
      includeNames: true
    });

    parser = res.parser;
    terms = res.terms;
  } catch (e) {
    await Promise.allSettled([unlink(parserPath), unlink(termsPath)]);

    console.log(`Removed: "${parserPath}"`);
    console.log(`Removed: "${termsPath}"`);
    console.log(`\n${e.message}\n`);
    return;
  }

  await Promise.allSettled([
    writeFile(parserPath, parser),
    writeFile(termsPath, terms)
  ]);

  console.log(`Generated: "${parserPath}"`);
  console.log(`Generated: "${termsPath}"`);
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

  esbuild
    .build({
      banner: {
        js: banner
      },
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
      logLevel: "info",
      sourcemap: prod ? false : "inline",
      treeShaking: true,
      outfile: "main.js"
    })
    .catch(() => process.exit(1));
})();
