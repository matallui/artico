::: warning
This documentation is still a work-in-progress.
:::

# Voice / Video Example

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
        call.addStream(
          stream,
          JSON.stringify({
            type: "camera",
          })
        );
      })
      .catch(console.error);
  });
});

// ...
```
