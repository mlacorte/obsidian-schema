import { buildParserFile } from "@lezer/generator";
import { yellow } from "colorette";
import { type Stats } from "fs";
import { readFile, unlink, writeFile } from "fs/promises";
import { globbyStream } from "globby";
import { build, defineConfig, type Options } from "tsup";

async function buildLezerGrammar(pathRoot: string): Promise<void> {
  const grammarPath = pathRoot + ".grammar";
  const parserPath = pathRoot + ".parser.js";
  const termsPath = pathRoot + ".terms.js";

  console.log(yellow("LZR"), "Building entry:", grammarPath);

  try {
    const input = await readFile(grammarPath, "utf8");

    const { parser, terms } = buildParserFile(input, {
      fileName: pathRoot,
      includeNames: true,
      warn: console.warn
    });

    await Promise.allSettled([
      writeFile(parserPath, parser),
      writeFile(termsPath, terms)
    ]);
  } catch (e: unknown) {
    await Promise.allSettled([unlink(parserPath), unlink(termsPath)]).catch(
      () => undefined
    );
    throw e instanceof Error ? e : new Error(String(e));
  }
}

const modifiedCache = new Map<string, number>();

export default defineConfig((options: Options) => ({
  entryPoints: ["src/index.ts"],
  clean: true,
  format: ["cjs"],
  plugins: [
    {
      name: "lezer",
      buildStart: async () => {
        const results: Array<Promise<void>> = [];

        for await (const obj of globbyStream("src/**/*.grammar", {
          onlyFiles: true,
          stats: true
        }) as any) {
          const path: string = obj.path;
          const stats: Stats = obj.stats;
          const old = modifiedCache.get(path) ?? -1;

          if (old !== stats.mtimeMs) {
            modifiedCache.set(path, stats.mtimeMs);
            results.push(buildLezerGrammar(path.replace(/\.grammar$/, "")));
          }
        }

        await Promise.allSettled(results);

        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (options.dts ?? true) {
          await build({ dts: { entry: ["src/index.ts"], only: true } });
        }
      }
    }
  ],
  ...options,
  dts: false
}));
