import dts from "bun-plugin-dts";

// Forces `bun run --watch` to rebuild the package on changes
import "../src";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  minify: true,
  plugins: [dts()],
  external: ["socket.io"],
});
