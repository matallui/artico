import dts from "bun-plugin-dts";

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
