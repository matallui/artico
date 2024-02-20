import { defineConfig, type Options } from "tsup";

export default defineConfig((opts) => {
  const config = {
    clean: !opts.watch,
    dts: true,
    format: ["esm", "cjs"],
    minify: true,
    outDir: "build",
    entry: ["src/index.ts"],
    noExternal: ["@rtco/logger"],
  } satisfies Options;

  return config;
});
