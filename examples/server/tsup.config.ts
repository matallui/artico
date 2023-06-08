import { defineConfig, type Options } from "tsup";

export default defineConfig((opts) => {
  const config = {
    clean: !opts.watch,
    dts: true,
    format: ["esm"],
    minify: true,
    outDir: "build",
    entry: ["src/index.ts"],
  } satisfies Options;

  return config;
});
