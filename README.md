# Artico

Artico is a flexible set of libraries that help create your own WebRTC-based solutions.
It uses a `RTCPeerConnection` abstraction similar to [simple-peer], in order to maintain each individual peer-to-peer connection, while providing integrated signaling (via [Socket.io]), all via simple to use APIs.

> **Warning**
> This is a work-in-progress and not the finished product.
>
> Feel free to leave feature suggestions but please don't open issues for bugs or support requests just yet.


## Motivation

WebRTC has a technology has grown significantly in the past few years, making it more and more appealing.
However, WebRTC APIs are not always straightforward and easy to use. In addition, WebRTC specifications don't define a signaling protocol or a discovery mechanism.

Multiple projects, like [PeerJS] and [simple-peer], attempt to abstract some of the WebRTC complexities away from the user, facilitating the use of the technology.
Even though these are all great projects, they usually fall short of some needed features (i.e., [simple-peer] doesn't provide signaling, [PeerJS] provides signaling but is missing renegotiation capabilities).

Artico aims at being a flexible, yet powerful, set of abstraction tools that should accomodate most WebRTC project needs.


## About

Artico provides two core packages:
 - [@rtco/peer] - `RTCPeerConnection` abstraction, heavily inspired by [simple-peer]
 - [@rtco/client] - client library, which includes [@rtco/peer] + signalling, providing an all-in-one client solution
 - [@rtco/server] - signaling server library

A couple of apps are also provided as examples:
 - [artico-example-client] - Next.js application using [@rtco/client]
 - [artico-example-server] - Node.js server that uses [@rtco/server]

The example apps are used to support the development of the Artico ecosystem, whilst demonstrating how to use the library packages.

### [@rtco/peer](packages/peer)

 - provide WebRTC API abstraction
 - facilitate individual peer to peer connections
 - heavily inspired by [simple-peer]

### [@rtco/client](packages/client)

 - integrated signaling out of the box
 - dynamic number of streams in single connection (via [@rtco/peer])
 - facilitate different peer network topologies (e.g., manual P2P, mesh, scalable broadcast tree) - TBD
 - multi-platform support (i.e., browser, React Native, Node.js)

### [@rtco/server](packages/server)

 - easy to use signaling server
 - integration with existing Node.js servers
 - provide all the needed support for [@rtco/client]

## Usage

Please refer to the each package/app directory for usage information.

## References

 - [PeerJS] - This project was inspired by PeerJS and aims at being as simple as PeerJS, while covering more complex scenarios.
 - [Socket.io] - Used as the connection protocol between peers and the signaling server.
 - [simple-peer] - [@rtco/peer] is heavily inspired by [simple-peer] and maintains similar goals.
 - [RTCMultiConnection] - Artico aims at providing advanced features found in this great project.


[simple-peer]: https://github.com/feross/simple-peer
[Socket.io]: https://socket.io
[PeerJS]: https://peerjs.com
[RTCMultiConnection]: https://github.com/muaz-khan/RTCMultiConnection
[@rtco/peer]: packages/peer
[@rtco/client]: packages/client
[@rtco/server]: packages/server
[artico-example-client]: apps/example-client
[artico-example-server]: apps/example-server

