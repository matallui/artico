import EventEmitter from "eventemitter3";
import type { Signal } from "@rtco/peer";
import { randomId } from "~/util";

export type SignalMessage = {
  type: "call" | "signal";
  source?: string;
  target: string;
  conn: string;
  room?: string;
  metadata: string;
  signal: Signal;
};

export type SignalingEvents = {
  connect: () => void;
  disconnect: () => void;

  open: (id: string) => void;

  error: (err: SignalingError) => void;

  signal: (msg: SignalMessage) => void;
  join: (roomId: string, peerId: string, metadata?: string) => void;
  leave: (roomId: string, peerId: string) => void;
};

export type SignalingState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "ready";

export interface SignalingOptions {
  id: string;
}

export interface Signaling extends EventEmitter<SignalingEvents> {
  // new (options?: Partial<SignalingOptions>): Signaling;

  get id(): string;
  get state(): SignalingState;

  connect(): void;
  disconnect(): void;

  signal(msg: SignalMessage): void;

  join(roomId: string, metadata?: string): void;
  leave(roomId: string): void;
}

export class SignalingBase extends EventEmitter<SignalingEvents> {
  #id: string;

  constructor(options?: Partial<SignalingOptions>) {
    super();
    this.#id = options?.id ?? randomId();
  }

  get id() {
    return this.#id;
  }

  get state() {
    return "disconnected";
  }
}

export type SignalingErrorType = "network" | "signal" | "disconnected";

export class SignalingError extends Error {
  type: SignalingErrorType;

  constructor(type: SignalingErrorType, err: Error | string) {
    if (typeof err === "string") {
      super(err);
    } else {
      super();
      Object.assign(this, err);
    }
    this.type = type;
  }
}
