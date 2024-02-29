# Peer

`Peer` is the lowest level API in the Artico stack and is provided by the [@rtco/peer](https://www.npmjs.com/package/@rtco/peer) package.
It provides an abstraction over the [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) WebRTC APIs, while letting you focus on higher level implementation.

This package can be used if you plan on implementing your own WebRTC solution from scratch. However, if you want a plug-n-play WebRTC solution,
please refer to [Artico](/reference/artico).

## Initialization

```ts
const peer = new Peer([opts]);
```

## Options

```ts
type PeerOptions = {
  // `debug` is a number between 0-4 where:
  // 0 - no logs
  // 1 - error logs
  // 2 - plus warning logs
  // 3 - plus info logs
  // 4 - plus debug logs
  debug: LogLevel;

  // If `initiator` is set to true, this peer will immediately
  // initiate the WebRTC connection establishment process.
  initiator?: boolean;

  // Configuration to be passed to `RTCPeerConnection`.
  config?: RTCConfiguration;

  // RTCDataChannel name.
  channelName?: string;

  // RTCDataChallen configuration.
  channelConfig?: RTCDataChannelInit;
};

const defaultOptions: PeerOptions = {
  debug: 1,
  initiator: false,
  config: undefined,
  channelName: undefined, // a random name will be generated
  channelConfig: {},
}
```


## Events

`Peer` emits the following events:

```ts
type PeerEvents = {
  // This peer instance has been destroyed or the data channel has been closed.
  close: () => void;

  // An error has occurred.
  error: (err: Error) => void;

  // Connected to remote peer, i.e., data channel is now open.
  connect: () => void;

  // Remote peer sent us data.
  data: (data: PeerData) => void;

  // Remote peer added/removed stream from connection.
  stream: (stream: MediaStream) => void;
  removestream: (stream: MediaStream) => void;

  // Remote peer added/removed track from connection.
  track: (track: MediaStreamTrack, stream: MediaStream) => void;
  removetrack: (track: MediaStreamTrack, stream: MediaStream) => void;

  // A WebRTC signal needs to be delivered to remote peer.
  signal: (data: SignalData) => void;
};

```

## Methods

`Peer` provides the following methods:

```ts
interface IPeer {
  // Destroy `Peer` instance.
  destroy(): void;

  // Deliver signal.
  signal(data: SignalData): Promise<void>;

  // Send data to remote peer.
  send(data: string): void;
  send(data: Blob): void;
  send(data: ArrayBuffer): void;
  send(data: ArrayBufferView): void;

  // Add/Remove stream to/from connection.
  addStream(stream: MediaStream): void;
  removeStream(stream: MediaStream): void;

  // Add/Remove track to/from connection.
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  removeTrack(track: MediaStreamTrack): void;
}
```
