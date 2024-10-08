import dts from "bun-plugin-dts";

// Forces `bun run --watch` to rebuild the package on changes
import "../src";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  minify: true,
  plugins: [dts()],
  external: [
    "bufferutil",
    "eventemitter3",
    "nanoid",
    "socket.io-client",
    "utf-8-validate",
  ],
});
