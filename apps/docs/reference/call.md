# Call

`Call` represents a session between two peers and is automatically created by Artico.

## Initialization

A `Call` is either created when you call a peer, or when you receive a call from a peer.
Please refer to [Artico](/reference/artico) to learn how to initialize `rtco`.

```ts
const rtco = new Artico();
// ...

// Call a peer
const call = rtco.call('<target-peer-id>', '<optional-metadata>');

// Receive call from peer
rtco.on("call", (call, metadata) => {
  call.answer();
})
```

## Events

`Call` emits the following events:

```ts
type CallEvents = {
  // Emitted when the session is established. More specifically,
  // when the WebRTC data channel is open between both peers.
  open: () => void;

  // Emitted when the session is closed.
  close: () => void;

  // Emitted when a session error occurs.
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

`Call` provides the following methods:

```ts
interface ICall {
  // Session ID, usually in the form of `call:<some_random_id>`
  get session(): string;

  // Session metadata, provided at the time the session was created.
  get metadata(): string;

  // If true, it means I was the caller, otherwise the callee.
  get initiator(): boolean;

  // If true, the session is open and ready to be used.
  get open(): boolean;

  // Answer an incoming call.
  answer(): void;

  // Send data to peer.
  send(data: string): void;

  // Add/Remove stream from session.
  addStream(stream: MediaStream, metadata?: string): void;
  removeStream(stream: MediaStream): void;

  // Add/Remove track from session.
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  removeTrack(track: MediaStreamTrack): void;

  // Close the session.
  hangup(): void;
}
```
