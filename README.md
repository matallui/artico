<p align="center">
  <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/matallui/artico/blob/99445e6aaba516abc69ac9c1c8bf32e80c067815/assets/artico-logo-circle.png">
  <img src="https://github.com/matallui/artico/blob/99445e6aaba516abc69ac9c1c8bf32e80c067815/assets/artico-logo-circle.png" width="130" alt="Logo for Artico">
</picture>
</p>

# Artico

Artico is a flexible set of libraries that help you create your own WebRTC-based solutions.
It uses a `RTCPeerConnection` abstraction similar to [simple-peer], in order to maintain each individual peer-to-peer connection, while providing integrated signaling (via [Socket.io]), all via simple APIs.

> **Warning**
> This is a work-in-progress. Feel free to leave feature suggestions, submit PRs or create issues you may find.

## Motivation

WebRTC as a technology has grown significantly in the past few years, making it more and more appealing.
However, WebRTC APIs are not always straightforward and easy to use. In addition, WebRTC specifications don't define a signaling protocol or a discovery mechanism.

Multiple projects, like [PeerJS] and [simple-peer], attempt to abstract some of the WebRTC complexities away from the user, facilitating the use of the technology.
Even though these are all great projects, they usually fall short on some needed features (i.e., [simple-peer] doesn't provide signaling, [PeerJS] provides signaling but misses renegotiation capabilities) or are no longer actively maintained.

Artico aims at being a flexible, yet powerful, set of abstraction tools that should accommodate most WebRTC project needs.

## About

Artico provides three core packages:

- [@rtco/peer] - `RTCPeerConnection` abstraction, heavily inspired by [simple-peer]
- [@rtco/client] - provides a [Socket.io] signaling solution on top of [@rtco/peer]
- [@rtco/server] - [Socket.io] signaling server implementation

You can also find the implementation of three of our apps:

- [artico-docs] - Artico documentation website
- [artico-server] - Artico's public [Socket.io] signaling server
- [artico-demo] - A few Artico demos available for experimentation

The demo apps are used to support the development of the Artico ecosystem, whilst demonstrating how to use the library packages.

### [@rtco/peer](packages/peer)

- provide WebRTC API abstraction
- facilitate individual peer to peer connections
- heavily inspired by [simple-peer]

### [@rtco/client](packages/client)

- integrated signaling out of the box
- dynamic number of streams in single connection (via [@rtco/peer])
- facilitate different peer network topologies (e.g., manual P2P, mesh, scalable broadcast tree) - **TBD**
- multi-platform support (i.e., browser, React Native, Node.js)

### [@rtco/server](packages/server)

- easy to use signaling server
- integration with existing Node.js servers
- provide all the needed support for [@rtco/client]

## Usage

Please refer to the each package directory for usage information.

## References

- [PeerJS] - This project was inspired by PeerJS and aims at being as simple as PeerJS, while covering more complex scenarios.
- [simple-peer] - [@rtco/peer] is heavily inspired by [simple-peer] and maintains similar goals.
- [Socket.io] - Used as the connection protocol between peers and the signaling server.
- [RTCMultiConnection] - Artico aims at providing advanced features found in this great project.

[simple-peer]: https://github.com/feross/simple-peer
[Socket.io]: https://socket.io
[PeerJS]: https://peerjs.com
[RTCMultiConnection]: https://github.com/muaz-khan/RTCMultiConnection
[@rtco/peer]: packages/peer
[@rtco/client]: packages/client
[@rtco/server]: packages/server
[artico-docs]: apps/docs
[artico-server]: apps/server
[artico-demo]: apps/demo
