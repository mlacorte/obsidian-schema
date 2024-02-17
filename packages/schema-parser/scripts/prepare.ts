import { buildParserFile } from "@lezer/generator";
import { parse, sep } from "path";
import { readFile, unlink, writeFile } from "fs/promises";
import { glob } from "glob";

async function buildLezerGrammar(path: string) {
  const input = await readFile(path, "utf8");

  const { dir, name } = parse(path);
  const parserPath = `${dir}${sep}${name}.parser.js`;
  const termsPath = `${dir}${sep}${name}.terms.js`;

  let parser, terms;

  try {
    const res = buildParserFile(input, {
      fileName: path,
      includeNames: true,
      warn: console.warn,
    });

    parser = res.parser;
    terms = res.terms;
  } catch (e) {
    return Promise.allSettled([unlink(parserPath), unlink(termsPath)]);
  }

  await Promise.allSettled([
    writeFile(parserPath, parser),
    writeFile(termsPath, terms)
  ]);
}

await Promise.allSettled(
  (await glob("src/**/*.grammar")).map(buildLezerGrammar)
);

const res = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  splitting: true,
  sourcemap: 'external',
  minify: true,
});

console.log(res)
