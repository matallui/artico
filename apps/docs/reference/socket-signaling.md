# SocketSignaling

`SocketSignaling` is the default signaling implementation provided by the [@rtco/client](https://www.npmjs.com/package/@rtco/client) package. It uses Socket.io for WebRTC signaling and connects to Artico's public signaling server by default.

## Initialization

```ts
import { SocketSignaling } from "@rtco/client";

const signaling = new SocketSignaling(opts?: Partial<SocketSignalingOptions>);
```

## Options

```ts
type SocketSignalingOptions = {
  // The log level (0: none, 1: errors, 2: warnings, 3: info, 4: debug)
  debug?: LogLevel;

  // The signaling server URL
  url?: string;

  // Requested peer ID. If not provided, a random ID will be generated
  id?: string;
};

// Default values:
// debug: 1 (errors only)
// url: "https://0.artico.dev:443" (Artico's public server)
// id: undefined (automatically generate unique UUID)
```

## Usage

### With Default Server

```ts
import { Artico, SocketSignaling } from "@rtco/client";

const rtco = new Artico({
  signaling: new SocketSignaling({
    debug: 4, // Enable all logs for debugging
  }),
});
```

### With Custom Server

```ts
import { Artico, SocketSignaling } from "@rtco/client";

const rtco = new Artico({
  signaling: new SocketSignaling({
    url: "https://my-signaling-server.com",
    debug: 2, // Show errors and warnings
  }),
});
```

### Development Setup

For local development, you can connect to a local signaling server:

```ts
import { Artico, SocketSignaling } from "@rtco/client";

const rtco = new Artico({
  signaling: new SocketSignaling({
    url: "http://localhost:9000",
    debug: 4, // Full logging during development
  }),
});
```

## Events

`SocketSignaling` implements the `Signaling` interface and emits the following events:

```ts
type SignalingEvents = {
  // Emitted when connected to the signaling server and assigned an ID
  connect: (id: string) => void;

  // Emitted when disconnected from the signaling server
  disconnect: () => void;

  // Emitted when an error occurs
  error: (err: Error) => void;

  // Emitted when receiving a signal from another peer
  signal: (message: InSignalMessage) => void;

  // Emitted when another peer joins a room
  join: (roomId: string, peerId: string, metadata?: string) => void;
};
```

## States

The signaling connection goes through the following states:

```ts
type SignalingState =
  | "disconnected" // Not connected to the server
  | "connecting" // Attempting to connect
  | "connected" // Connected but no ID assigned yet
  | "ready"; // Connected and ready to make calls
```

## Error Handling

Common errors you might encounter:

```ts
rtco.on("error", (err) => {
  switch (err.message) {
    case "id-taken":
      console.error("The requested peer ID is already in use");
      break;
    case "invalid-id":
      console.error("The provided peer ID is invalid");
      break;
    default:
      console.error("Signaling error:", err.message);
  }
});
```

## Server Requirements

If you're running your own signaling server, it should implement the Artico signaling protocol. You can use the [@rtco/server](https://www.npmjs.com/package/@rtco/server) package to quickly set up a compatible server.
