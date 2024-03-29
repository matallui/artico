# @rtco/peer

Artico peer library. Please refer to the [documentation](https://artico.dev) for more information.

## Installation

```bash
npm install @rtco/peer
```

## Usage

The following example show how to connect two peers and share audio/video or any data between them:

```js
import Peer from "@rtco/peer";

const p1 = new Peer({ initiator: true });
const p2 = new Peer();

p1.on("signal", (data) => {
  // signal p2 somehow
  p2.signal(data);
});

p2.on("signal", (data) => {
  // signal p1 somehow
  p1.signal(data);
});

p1.on("connect", () => {
  // data channel is connected and ready to be used
  p1.send("Hey Peer 2, this is Peer 1!");
});

p2.on("data", (data) => {
  console.log("Received a message from Peer 1:", data);
});

p2.on("stream", (stream, metadata) => {
  // when adding streams to a connection, we can provide any object as metadata
  console.log("Received new stream from Peer 1:", metadata);
});

// ...

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    // send stream to Peer 2 with metadata indicating type of stream
    p1.addStream(stream, {
      type: "camera",
    });
  })
  .catch(console.error);
```
