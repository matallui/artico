# @rtco/client

Artico client library. Please refer to the [documentation](https://artico.dev) for more information.

## Installation

```bash
npm install @rtco/client
```

## Usage

The following example shows how to connect two peers and share audio/video or any data between them:

#### Peer 1

```ts
import { Artico, type Call } from "@rtco/client";

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

rtco.on("call", (call: Call) => {
  // The calling peer can link any metadata object to a call.
  const { metadata } = call;
  const remotePeerName = metadata.name;

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
import { Artico, type Call } from "@rtco/client";

const remotePeerId = "<ID of target remote peer>";

const rtco = new Artico();

const call = rtco.call(remotePeerId);

call.on("error", (err) => {
  console.log("Call error:", err);
});

call.on("close", () => {
  console.log("Call closed");
});

// ...

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    // send stream to Peer 1 with metadata indicating type of stream
    call.addStream(stream, {
      type: "camera",
    });
  })
  .catch(console.error);
```
