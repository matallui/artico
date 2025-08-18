# What is Artico?

Artico is a flexible set of libraries that help you create your own WebRTC-based solutions:

- [@rtco/peer](https://www.npmjs.com/package/@rtco/peer) - Simple WebRTC abstraction layer. You can use this if you want to implement a fully custom solution, from signaling to connection topology.

- [@rtco/client](https://www.npmjs.com/package/@rtco/client) - Provides a plug-n-play client library which implements Artico's signaling interface. It can get you up and running within minutes.

- [@rtco/server](https://www.npmjs.com/package/@rtco/server) - Artico's signaling server implementation, based on [Socket.io](https://socket.io).

## Motivation

WebRTC as a technology has grown significantly in the past few years, making it a de-facto standard for low-latency audio, video and data communications.
However, WebRTC APIs are not always straightforwards and easy to use. In addition, WebRTC specifications don't define a signaling protocol or a discovery mechanism.

Multiple projects, like [PeerJS](https://peerjs.com) and [simple-peer](https://github.com/feross/simple-peer), attempt to abstract some of these complexities away from the user, thus facilitating the use of the technology.
Even though these are all great projects, they usually fall short on some needed features (e.g., not providing signaling or missing renegotiation capabilities) or are no longer actively maintained.

Artico aims at being a flexible, yet powerful, set of abstraction tools that should accomodate most WebRTC project needs.
