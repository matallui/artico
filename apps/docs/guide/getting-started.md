::: warning
This documentation is still a work-in-progress.
:::

# Getting Started

## Try It Online

You can see Artico in action in these [online demos](https://demo.artico.dev).

## Installation

For the purposes of the guide, we will demonstrate how to use Artico's client library, which provides out of the box signaling and relies on a public signaling server hosted by the Artico team.
Please refer to the documentation to learn how to use Artico's libraries in a way that fits your application requirements.

::: code-group
```sh [npm]
$ npm install @rtco/client
```

```sh [yarn]
$ yarn add @rtco/client
```

```sh [pnpm]
$ pnpm install @rtco/client
```

```sh [bun]
$ bun add @rtco/client
```
:::


## Call Example

The following example shows how to connect two peers and share audio/video/data between them:

#### Peer 1

```ts
import { Artico } from "@rtco/client";

const rtco = new Artico();

rtco.on("open", (id: string) => {
  // We're now connected to the signaling server. `id` refers to the unique ID that
  // is currently assigned to this peer, so remote peers can connect to us.
  console.log("Connected to signaling server with peer ID:", id);
});

rtco.on("close", () => {
  console.log("Connection to signaling server is now closed.");
});

rtco.on("error", (err) => {
  console.log("Artico error:", err);
});

rtco.on("call", (call) => {
  // The calling peer can link any metadata string to a call.
  const meta = JSON.parse(call.metadata);
  const remotePeerName = meta.name;

  console.log(`Call from ${remotePeerName}...`);

  // Answer the call.
  call.answer();

  call.on("stream", (stream, metadata) => {
    // Stream was added by remote peer, so display it somehow.
    // `metadata` can be appended by the remote peer when adding the stream.
  });
});
```

#### Peer 2

```ts
import { Artico } from "@rtco/client";

const remotePeerId = "<ID of target remote peer>";

const rtco = new Artico();

rtco.on("open", (id) => {
  console.log("Connected to signaling server with peer ID:", id);

  const call = rtco.call(remotePeerId);

  call.on("open", () => {
    // Session is now established between you and your peer.
    // Let's send Peer 1 our audio/video...
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        // send stream to Peer 1 with metadata indicating type of stream
        call.addStream(stream, JSON.stringify({
          type: "camera",
        }));
      })
      .catch(console.error);
  })
});

// ...
```

## Room Example

Artico provides a way to connect to a "room" of peers, instead of calling just one.
All peers in the same room will be connected between them automatically by Artico.
Here's an example of a peer joining a room and sharing their audio/video with others in the same room.

```ts
import { Artico } from "@rtco/client";

const rtco = new Artico();

rtco.on("open", (id) => {
  // Connected to signaling server.
  const room = rtco.join("<target-room-id>");

  room.on("join", (peerId) => {
    console.log(`Peer ${peerId} has joined the room!`);
  });

  room.on("leave", (peerId) => {
    console.log(`Peer ${peerId} has left the room!`);
  });

  room.on("stream", (stream, peerId) => {
    console.log(`Peer ${peerId} has shared stream ${stream.id}!`);
  });

  // ...

  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: true,
    })
    .then((stream) => {
      // Send stream to everyone in the room, or...
      room.addStream(stream);

      // Send stream to specific peers in the room
      room.addStream(
        stream,
        ["<target-peer-id-1>", "<target-peer-id-2>"],
        "<optional-metadata>",
      );
    })
    .catch(console.error);
});
```
