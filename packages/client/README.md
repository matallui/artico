# @rtco/client

Artico client library

## Installation

```bash
npm install @rtco/client
```

## Usage

The following example shows how to connect two peers and share audio/video or any data between them:

#### Peer 1

```ts
import { Artico, type Connection } from "@rtco/client";

const rtco = new Artico();

rtco.on("open", (id: string) => {
  // We're now connected to the signaling server.
  // `id` refers to the unique ID that is currently assigned to this peer, so remote peers can connect to us.
  console.log("Connected to signaling server with peer ID:", id);
});

rtco.on("close", () => {
  console.log("Connection to signaling server is now closed.");
});

rtco.on("error", (err) => {
  console.log("Artico error:", err);
});

rtco.on("call", (conn: Connection) => {
  // The calling peer can link any metadata object to a connection.
  const { metadata } = conn;
  const remotePeerName = metadata.name;

  console.log(`Call from ${remotePeerName}...`);

  // Answer the call.
  conn.answer();

  conn.on("stream", (stream, metadata) => {
    // Stream was added by remote peer, so display it somehow.
    // `metadata` can be appended by the remote peer when adding the stream.
  });
});
```

#### Peer 2

```ts
import { Artico, type Connection } from "@rtco/client";

const remotePeerId = "<ID of target remote peer>";

const rtco = new Artico();

const conn = rtco.call(remotePeerId);

conn.on("error", (err) => {
  console.log("Connection error:", err);
});

conn.on("close", () => {
  console.log("Connection closed");
});

// ...

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    // send stream to Peer 1 with metadata indicating type of stream
    conn.addStream(stream, {
      type: "camera",
    });
  })
  .catch(console.error);
```

## API

### Artico

```js
const rtco = new Artico([opts]);
```

Create a new Artico instance, which will create a connection to the [@rtco/server](/packages/server) signaling server.

Below you'll find a list of the available `opts` and their default values:

```js
{
  wrtc: {}, // RTCPeerConnection/RTCSessionDescription/RTCIceCandidate
  debug: 0,
  host: 'https://0.artico.dev',
  port: 443,
}
```

- `wrtc` - custom WebRTC implementation, so you can use this library outside of the browser (e.g., Node.js or React Native). Contains an object with the properties:
  - [`RTCPeerConnection`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
  - [`RTCSessionDescription`](https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription)
  - [`RTCIceCandidate`](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate)
- `debug` - logging level, where `0` means no logs and `4` means all log levels (i.e., error, warning, info and debug)
- `host` - signaling server host
- `post` - singaling server port

### Methods

#### `rtco.id` (read-only)

Returns the unique peer ID assigned to this Artico instance.

#### `rtco.close()`

Close and clean up Artico instance. This will close all active connections.

#### `rtco.disconnect()`

Disconnect from the Artico signaling server. Active WebRTC connections will still be active and functional.

#### `rtco.reconnect()`

Reconnect to the Artico signaling server.

#### `const conn = rtco.call(target, [metadata])`

Call the `target` remote peer. `metadata` can be used to pass any information to the callee.
For instance, you could pass the caller's name so the callee knows who's calling.

Returns a `Connection` object.

#### `conn.close()`

Close the peer connection. The remote peer will be notified by receiving the `close` event on their end of the `Connection`.

#### `conn.answer()`

Answer incoming call. The `conn` object will be received via `rtco.on('call', (conn) => {})`.

#### `conn.send(data)`

Send text/binary data to the remote peer. `data` can be any of several types: `string`, `Buffer`, `ArrayBufferView`, `ArrayBuffer` or `Blob`.

#### `conn.addStream(stream, [metadata])`

Adds all tracks contained in `stream` to the connection via [`addTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack).
A `metadata` object can be passed as an additional parameter in order to attach metadata to the `stream`.

**Note:** Metadata is always linked to a media `stream`, and never a `track`. This is due to the fact that media streams share the same ID on both ends of the connection. The same does not apply to media tracks.

#### `conn.removeStream(stream)`

Removes all tracks contained in `stream` from the connection via [`removeTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack).

#### `conn.addTrack(track, stream, [metadata])`

Adds a track to the connection via [`addTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack).
A `metadata` object can be passed as an additional parameter in order to attach metadata to the `stream`.

#### `conn.removeTrack(track, stream)`

Adds a track to the connection via [`removeTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack).

### Events

#### `rtco.on('open', (id: string) => {})`

Fired when we establish a connection to the Artico signaling server.
`id` refers to the unique ID that was assigned to this peer.

#### `rtco.on('call', (conn: Connection) => {})`

Fired when we receive a call from a remote peer. A `Connection` object is provided as an argument, so we can `answer` the call, `send` data or exchange media tracks with the remote peer.

#### `rtco.on('close', () => {})`

Fired when the `Artico` instance is destroyed.

#### `rtco.on('error', (err) => {})`

Fired when `Artico` encounters any errors.

#### `conn.on('close', () => {})`

Fired when the `Connection` is closed.

#### `conn.on('error', (err) => {})`

Fired upon `Connection` errors.

#### `conn.on('data', (data) => {})`

Fired when we receive data sent by the remote peer.

#### `conn.on('stream', (stream, metadata) => {})`

Fired when the remote peer adds a new stream to the connection.
`metadata`, if provided by the remote peer, will be passed to this event handler.

#### `conn.on('removestream', (stream, metadata) => {})`

Fired when the remote peer removes a media stream from the connection.

#### `conn.on('track', (track, stream, metadata) => {})`

Fired when the remote peer adds a new track to the connection.
`metadata`, if provided by the remote peer, will be passed to this event handler.

#### `conn.on('removetrack', (track, stream, metadata) => {})`

Fired when the remote peer removes a media track from the connection.
