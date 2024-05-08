# Artico Server

`ArticoServer` is a signaling server implementation provided by the [@rtco/server](https://www.npmjs.com/package/@rtco/server) package.
This is the default signaling server used in Artico and it is available at `0.artico.dev`.

This package can be used if you want to host your own signaling server, but use the default Artico's signaling implementation.

## Initialization

```ts
const server = new ArticoServer([opts]);
```

## Options

```ts
type ArticoServerOptions = {
  // `debug` is a number between 0-4 where:
  // 0 - no logs
  // 1 - error logs (default)
  // 2 - plus warning logs
  // 3 - plus info logs
  // 4 - plus debug logs
  debug?: LogLevel;

  // Optional Socket.io ServerOptions.
  ioOptions?: ServerOptions;

  // Optional HTTP server to attach ArticoServer to.
  httpServer?:
};

const defaultOptions: ArticoServerOptions = {
  debug: 1,
  ioOptions: undefined,
  httpServer: undefined,
}
```

## Methods

`ArticoServer` provides the following methods:

```ts
interface IArticoServer {
  // Returns the underlying Socket.io `Server` instance.
  get server(): Server;

  // Start server and listen on provided port.
  listen(port: number): void;
}
```
