# @rtco/peer

Artico peer library


## Installation

```bash
npm install @rtco/peer
```


## Usage

The following example show how to connect two peers and share audio/video or any data between them:

```js
import Peer from '@rtco/peer';

const p1 = new Peer({ initiator: true });
const p2 = new Peer();

p1.on('signal', data => {
  // signal p2 somehow
  p2.signal(data);
});

p2.on('signal', data => {
  // signal p1 somehow
  p1.signal(data);
});

p1.on('connect', () => {
  // data channel is connected and ready to be used
  p1.send('Hey Peer 2, this is Peer 1!')
});

p2.on('data', (data) => {
  console.log('Received a message from Peer 1:', data);
});

p2.on('stream', (stream, metadata) => {
  // when adding streams to a connection, we can provide any object as metadata
  console.log('Received new stream from Peer 1:', metadata);
})

// ...

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then((stream) => {
  // send stream to Peer 2 with metadata indicating type of stream
  p1.addStream(stream, {
    type: 'camera'
  });
}).catch(console.error);
```


## API

### Constructor

```js
const peer = new Peer([opts])
```

Create a new WebRTC peer connection (i.e., an `RTCPeerConnection`).

A data channel for text/binary communication is always established because it is cheap and often useful.
Audio/video can be added via `addStream` or `addTrack` methods.

Below you'll find a list of the available `opts` and their default values:
```js
{
  wrtc: {}, // RTCPeerConnection/RTCSessionDescription/RTCIceCandidate
  initiator: false,
  config: {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:global.stun.twilio.com:3478",
        ],
      },
    ],
  },
  channelName: '<random string>',
  channelConfig: {},
}
```

 - `wrtc` - custom WebRTC implementation, so you can use this library outside of the browser (e.g., Node.js or React Native). Contains an object with the properties:
   + [`RTCPeerConnection`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
   + [`RTCSessionDescription`](https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription)
   + [`RTCIceCandidate`](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate)
 - `initiator` - set to `true` if this is the initiating peer
 - `config` - custom WebRTC configuration (used by [`RTCPeerConnection`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection))
 - `channelName` - custom WebRTC data channel name
 - `channelConfig` - custom WebRTC data channel configuration (used by [`createDataChannel`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel))

### Methods

#### `peer.destroy()`

Destroy and clean up peer connection.

#### `peer.signal(data)`

Call this method to deliver signaling data to a peer.

As an example, imagine we have two peers (`p1` and `p2`). Whenever `p1` receives the `signal` event (see below), it should find a way to send it across the network to `p2` so we can then deliver it to `p2` via `p2.signal(data)`.

#### `peer.send(data)`

Send text/binary data to the remote peer. `data` can be any of several types: `string`, `Buffer`, `ArrayBufferView`, `ArrayBuffer` or `Blob`.

#### `peer.addStream(stream)`

Adds all tracks contained in `stream` to the connection via [`addTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack).

#### `peer.removeStream(stream)`

Removes all tracks contained in `stream` from the connection via [`removeTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack).

#### `peer.addTrack(track, stream)`

Adds a track to the connection via [`addTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack).

#### `peer.removeTrack(track, stream)`

Adds a track to the connection via [`removeTrack`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack).

### Events

#### `peer.on('signal', (data) => {})`

Fired when `peer` has signaling data pending to be delivered to its remote peer.

It is the responsibility of the application developer to get this data to the remote peer.
You can either implement your own signaling mechanism, or simply use [@rtco/client] and [@rtco/server].

#### `peer.on('connect', () => {})`

Fired when the peer connection and data channel are ready to use.

#### `peer.on('data', (data) => {})`

Fired when we receive data from the remote peer (via data channel).

#### `peer.on('stream', (stream) => {})`

Fired when the remote peer adds a stream to the connection.

#### `peer.on('removestream', (stream) => {})`

Fired when a media stream is removed from the connection.

#### `peer.on('track', (track, stream) => {})`

Fired when the remote peer adds a track to the connection.
`stream` refers to the media stream this track belongs to.

#### `peer.on('removetrack', (track, stream) => {})`

Fired when a track is removed from the connection.
`stream` refers to the media stream this track belonged to.

#### `peer.on('close', () => {})`

Fired when the connection to the remote peer gets closed.

#### `peer.on('error', (err) => {})`

Fired when any errors are detected.

