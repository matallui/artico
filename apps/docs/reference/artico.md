# Artico

`Artico` is the highest level API in the Artico stack and is provided by the [@rtco/client](https://www.npmjs.com/package/@rtco/client) package.
It is in charge of establishing a connection to the signaling server and provides high-level methods to connect you to your peers.

Multiple [Connection](/reference/connection) can be created and multiple [Room](/reference/room) can be joined with a single `Artico` instance.


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

  // You can provide a custom WebRTC API. This is mostly useful when
  // running in environments other that web browsers
  wrtc: WRTC;
};

const defaultOptions: ArticoOptions = {
  debug: 1, // errors only
  id: undefined, // automatically generate unique UUID
  signaling: undefined, // use Artico's default `SocketSignaling`
  wrtc: undefined, // attempt to use browser's RTCPeerConnection/RTCSessionDescription/RTCIceCandidate
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
  call: (conn: Connection) => void;

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
  // My assigned peer ID
  get id(): string;

  // Signaling state can be one of:
  // - "disconnected": diconnected from the server
  // - "connecting": connecting to the signaling server
  // - "connected": connected to the signaling server
  // - "ready": connected and assigned an ID
  get state(): SignalingState;

  // Call a target peer ID, and optionally provide metadata.
  // A `Connection` object is returned, which can be used to
  // handle the connection between the two peers.
  call: (target: string, metadata?: string) => Connection;

  // Join a room with provided `roomId`. A `Room` object is
  // returned, which can be used to handle the interactions
  // with the peers in the room.
  join: (roomId: string) => Room;

  // Attempt to reconnect to signaling server.
  reconnect: () => void;

  // Disconnect from signaling server.
  disconnect: () => void;

  // Close Artico (do this when you're done with Artico)
  close: () => void;
}
```


