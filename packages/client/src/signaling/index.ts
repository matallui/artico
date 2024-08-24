import type EventEmitter from "eventemitter3";
import type { Signal } from "@rtco/peer";

interface SignalMessage {
  target: string;
  session: string;
  metadata?: string;
  signal: Signal;
}

interface SignalMessageWithSource extends SignalMessage {
  source: string;
}

export type OutSignalMessage = SignalMessage;
export type InSignalMessage = SignalMessageWithSource;

export type SignalingEvents = {
  connect: (id: string) => void;
  disconnect: () => void;

  error: (err: Error) => void;

  signal: (msg: InSignalMessage) => void;

  join: (roomId: string, peerId: string, metadata?: string) => void;
};

export type SignalingState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "ready";

export interface Signaling extends EventEmitter<SignalingEvents> {
  get id(): string;
  get state(): SignalingState;

  connect(): void;
  disconnect(): void;

  signal(msg: SignalMessage): void;

  join(roomId: string, metadata?: string): void;
}
