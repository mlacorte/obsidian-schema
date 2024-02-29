import { buildParserFile } from "@lezer/generator";
import * as esbuild from "esbuild";
import { readFile, unlink, writeFile } from "fs/promises";
import { glob } from "glob";
import { parse, sep } from "path";

async function buildLezerGrammar(path: string): Promise<void> {
  const input = await readFile(path, "utf8");

  const { dir, name } = parse(path);
  const parserPath = `${dir}${sep}${name}.parser.js`;
  const termsPath = `${dir}${sep}${name}.terms.js`;

  try {
    const res = buildParserFile(input, {
      fileName: path,
      includeNames: true,
      warn: console.warn
    });

    await Promise.allSettled([
      writeFile(parserPath, res.parser),
      writeFile(termsPath, res.terms)
    ]);
  } catch (e) {
    await Promise.allSettled([unlink(parserPath), unlink(termsPath)]);
  }
}

await Promise.allSettled(
  (await glob("src/**/*.grammar")).map(buildLezerGrammar)
);

await esbuild.build({
  entryPoints: ["./src/index.ts"],
  outdir: "./dist",
  bundle: true,
  sourcemap: true,
  minify: true
});
