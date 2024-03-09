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

## Setup

### Basic Setup

```js
import { Artico } from "@rtco/client";
const rtco = new Artico();
```

### Setup with Custom ID

You can request a specific peer ID. If you do, Artico will attempt to register such ID with the signaling server. If not available, Artico will emit an Error with the message "invalid-id".

:::Warning: It is recommended that you let Artico assign you a random ID, since IDs should be universally unique within Artico's signaling network.:::

```js
import { Artico } from "@rtco/client";

const rtco = new Artico({
  id: "my-custom-id"
});

rtco.on("error", (err: Error) => {
  if (err.message === 'id-taken') {
    console.log("ID is taken!");
  }
})
```

## Connection

Connections can be created with the `call()` function in the `Artico` object and the connections can be accepted using the `answer()` method. But before that, the `open` event should be listened to, to ensure that the signalling is ready.

### Request Connection

```js
rtco.on("open", (id) => {
  rtco.call("<Remote Peer ID>");
});
```

### Accept Connection

Incomming requests are emitted as `call` events and can be listened through the `Artico` object.

```js
rtco.on("call", (call) => {
  // accepting call
  call.answer();
});
```

## Basic Connection Example

#### Peer 1 (Calling Peer)

```js
import { Artico } from "@rtco/client";

const rtco = new Artico();
const remoteID = "<Remote Peer ID>"; // Ideally taken from an input field, or other source..

rtco.on("open", (id) => {
  console.log("Connected to signaling server with peer ID:", id);

  const call = rtco.call(remoteID, { username: "<someusername>" }); // The second attribute is the metadata that can be passed to the connection

  call.on("open", () => {
    // Triggered when connection is established
    console.log("Connection established to ", call.target); // Target is the remote ID
    call.send("Hello World!!"); // Used to send data to connected Peer

    call.on("close", () => {
      console.log("Connection Closed");
    });
  });
});
```

#### Peer 2 (Receiving Peer)

```js
import { Artico } from "@rtco/client";

const rtco = new Artico();

rtco.on("call", (call) => {
  const { metadata } = call;

  console.log("Incoming call from: ", metadata.username);
  call.answer();

  call.on("open", () => {
    // Triggered when connection is established
    console.log("Connection established to ", call.target); // Target is the remote ID
  });

  call.on("data", (data) => {
    console.log("Data Recieved : ", data);
  });

  call.on("close", () => {
    console.log("Connection Closed");
  });
});
```
