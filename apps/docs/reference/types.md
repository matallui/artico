# Types & Interfaces

This document describes the common types and interfaces used throughout the Artico ecosystem.

## Core Types

### SignalingState

The state of the signaling connection:

```ts
type SignalingState =
  | "disconnected" // Not connected to the server
  | "connecting" // Attempting to connect
  | "connected" // Connected but no ID assigned yet
  | "ready"; // Connected and ready to make calls
```

### LogLevel

The logging level for debugging:

```ts
enum LogLevel {
  None = 0, // No logs
  Errors = 1, // Error logs only
  Warnings = 2, // Errors and warnings
  Info = 3, // Errors, warnings, and info
  Debug = 4, // All logs including debug
}
```

## Signal Messages

### InSignalMessage

Messages received from other peers through the signaling server:

```ts
type InSignalMessage = {
  source: string; // ID of the peer sending the signal
  target: string; // ID of the target peer (should be your ID)
  session: string; // Session ID for the call/room
  signal: Signal; // The WebRTC signal data
  metadata?: string; // Optional metadata attached to the signal
};
```

### OutSignalMessage

Messages sent to other peers through the signaling server:

```ts
type OutSignalMessage = {
  target: string; // ID of the peer to send the signal to
  session: string; // Session ID for the call/room
  signal: Signal; // The WebRTC signal data
  metadata?: string; // Optional metadata to attach
};
```

### Signal

WebRTC signaling data:

```ts
type Signal =
  | {
      type: "candidate";
      data: RTCIceCandidate;
    }
  | {
      type: "sdp";
      data: RTCSessionDescription;
    };
```

## Interfaces

### Signaling Interface

The interface that all signaling implementations must follow:

```ts
interface Signaling extends EventEmitter<SignalingEvents> {
  get id(): string;
  get state(): SignalingState;

  connect(): void;
  disconnect(): void;
  signal(message: OutSignalMessage): void;
  join(roomId: string, metadata?: string): Promise<void>;
}

type SignalingEvents = {
  connect: (id: string) => void;
  disconnect: () => void;
  error: (err: Error) => void;
  signal: (message: InSignalMessage) => void;
  join: (roomId: string, peerId: string, metadata?: string) => void;
};
```

## Peer Data Types

### PeerData

Data that can be sent through a peer connection:

```ts
type PeerData = string | ArrayBuffer | Blob | ArrayBufferView;
```

## Default Configurations

### Default RTCConfiguration

Artico uses the following default RTCConfiguration:

```ts
const defaultRTCConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};
```

### Default SocketSignaling URL

The default signaling server URL:

```ts
const defaultSignalingURL = "https://0.artico.dev:443";
```

## Error Types

### Common Error Messages

Artico uses specific error messages for common scenarios:

- `"id-taken"` - The requested peer ID is already in use
- `"invalid-id"` - The provided peer ID is invalid
- `"Cannot call peers until signaling is ready."` - Attempted to make a call before signaling is ready
- `"Cannot join room until signaling is ready."` - Attempted to join a room before signaling is ready
- `"Only non-initiators can answer calls"` - Attempted to answer a call as the initiator
