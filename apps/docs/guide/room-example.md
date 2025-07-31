# Room Example

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
