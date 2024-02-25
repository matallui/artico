# Connection

`Connection` represents a connection between two peers and is automatically created by Artico.

## Initialization

A `Connection` is either created when you call a peer, or when you receive a call from a peer.
Please refer to [Artico](/reference/artico) to learn how to initialize `rtco`.

```ts
const rtco = new Artico();
// ...

// Call a peer
const conn = rtco.call('<target-peer-id>', '<optional-metadata>');

// Receive call from peer
rtco.on("call", (conn, metadata) => {
  conn.answer();
})
```

## Events

`Connection` emits the following events:

```ts
type ConnectionEvents = {
  // Emitted when the connection is established. More specifically,
  // when the WebRTC data channel is open between both peers.
  open: () => void;

  // Emitted when the connection is closed.
  close: () => void;

  // Emitted when a connection error occurs.
  error: (err: Error) => void;

  // Emitted when the peer sends you data.
  data: (data: string) => void;

  // Emitted when the peer adds/removes a stream.
  stream: (stream: MediaStream, metadata?: string) => void;
  removestream: (stream: MediaStream, metadata?: string) => void;

  // Emitted when the peer adds/removes a track.
  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: string,
  ) => void;
  removetrack: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: string,
  ) => void;
};
```

## Methods

`Connection` provides the following methods:

```ts
interface IConnection {
  // Connection ID, usually in the form of `conn_<some_random_id>`
  get id(): string;

  // Connection metadata, provided at the time the connection was created.
  get metadata(): string;

  // If true, it means I was the connection initiator.
  get initiator(): boolean;

  // If true, the connection is open and ready to be used.
  get open(): boolean;

  // Answer an incoming call.
  answer(): void;

  // Send data to peer.
  send(data: string): void;

  // Add/Remove stream from connection.
  addStream(stream: MediaStream, metadata?: string): void;
  removeStream(stream: MediaStream): void;

  // Add/Remove track from connection.
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  removeTrack(track: MediaStreamTrack): void;

  // Close connection. Peer will be notified with a `close` event.
  close(): void;
}
```

