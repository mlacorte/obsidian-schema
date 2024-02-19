await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  splitting: true,
  sourcemap: "external",
  minify: true,
});
