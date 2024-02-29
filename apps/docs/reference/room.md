# Room

`Room` represents a mesh-like connection between a group of peers and is automatically created by Artico.

## Initialization

A `Room` is automatically created when you `join` a room
Please refer to [Artico](/reference/artico) to learn how to initialize `rtco`.

```ts
const rtco = new Artico();
// ...

// Join a room
const conn = rtco.join('<room-id>', '<optional-metadata>');
```

## Events

`Room` emits the following events:

```ts
export type RoomEvents = {
  // Emitted when you leave the room.
  close: () => void;

  // Emitted when another peer joins/leaves the room.
  join: (peerId: string, metadata?: string) => void;
  leave: (peerId: string) => void;

  // Emitted when another peer shares/unshares a stream with you.
  stream: (stream: MediaStream, peerId: string, metadata?: string) => void;
  removestream: (
    stream: MediaStream,
    peerId: string,
    metadata?: string,
  ) => void;

  // Emitted when another peer shares/unshares a track with you.
  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    peerId: string,
    metadata?: string,
  ) => void;
  removetrack: (
    track: MediaStreamTrack,
    stream: MediaStream,
    peerId: string,
    metadata?: string,
  ) => void;

  // Emitted when another peer messages you.
  message: (data: string, peerId: string) => void;
};
```

## Methods

`Room` provides the following methods:

```ts
interface IRoom {
  // Room ID
  get id(): string;

  // List or peer IDs present in the room.
  get peers(): string[];

  // Leave the room.
  leave(): void;

  // Send message to one, severall or all peers in the room.
  send(msg: string, target?: string | string[]): void;

  // Send/Unsend a stream to peer(s) in the room.
  addStream(
    stream: MediaStream,
    target?: string | string[],
    metadata?: string,
  ): void;
  removeStream(stream: MediaStream, target?: string | string[]): void;

  // Send/Unsend a track to peer(s) in the room.
  addTrack(
    track: MediaStreamTrack,
    stream: MediaStream,
    target?: string | string[],
  ): void;
  removeTrack(track: MediaStreamTrack, target?: string | string[]): void;
}
```

