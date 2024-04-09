# Artico

`Artico` is the highest level API in the Artico stack and is provided by the [@rtco/client](https://www.npmjs.com/package/@rtco/client) package.
It is in charge of establishing a connection to the signaling server and provides high-level methods to connect you to your peers.

Multiple [Call](/reference/call) can be created and multiple [Room](/reference/room) can be joined with a single `Artico` instance.



## Initialization

```ts
const rtco = new Artico([opts]);
```

## Options

```ts
type ArticoOptions = {
  // `debug` is a number between 0-4 where:
  // 0 - no logs
  // 1 - error logs
  // 2 - plus warning logs
  // 3 - plus info logs
  // 4 - plus debug logs
  debug: LogLevel;

  // `id` lets you attempt to register with a specific peer ID
  // with the signaling server
  id: string;

  // You can provide your custom `Signaling` implementation
  signaling: Signaling;

  // Configuration to be passed to `RTCPeerConnection`.
  rtcConfig: RTCConfiguration;
};

const defaultOptions: ArticoOptions = {
  debug: 1, // errors only
  id: undefined, // automatically generate unique UUID
  signaling: undefined, // use Artico's default `SocketSignaling`
}
```


## Events

Artico emits the following events:

```ts
type ArticoEvents = {
  // Emitted when Artico successfully connects to the signaling
  // server and is assigned a unique peer ID
  open: (id: string) => void;

  // Emitted when another peer is attempting to call us
  call: (call: Call) => void;

  // Emitted when the connection to the signaling server is closed
  close: () => void;

  // Emitted when an error occurs
  error: (err: ArticoError) => void;
};

```

## Methods

Artico provides the following methods:

```ts
interface IArtico {
  // My peer ID
  get id(): string;

  // SignalingState can be one of:
  // - "disconnected": diconnected from the server
  // - "connecting": connecting to the signaling server
  // - "connected": connected to the signaling server
  // - "ready": connected and assigned an ID
  get state(): SignalingState;

  // Close Artico (do this when you're done with Artico)
  close: () => void;

  // Call a target peer ID, and optionally provide metadata.
  // A `Call` object is returned, which can be used to
  // handle the connection between the two peers.
  call: (target: string, metadata?: string) => Call;

  // Join a room with provided `roomId`, an optionally provide
  // metadata. A `Room` object is returned, which can be used
  // to handle the interactions with the peers in the room.
  join: (roomId: string, metadata?: string) => Room;
}
```


