import EventEmitter from "eventemitter3";
import type { SignalData } from "./peer";
import { randomId } from "./util";

export type SignalingEvents = {
  connect: () => void;
  disconnect: () => void;
  error: (err: Error) => void;
  message: (msg: SignalingMessage) => void;
};

export type SignalingState = "disconnected" | "connecting" | "connected";

export interface Signaling extends EventEmitter<SignalingEvents> {
  connect(): void;
  disconnect(): void;
  send(msg: SignalingMessage): void;
  get id(): string;
  get state(): SignalingState;
}

export interface SignalingOptions {
  id: string;
}

export class SignalingBase
  extends EventEmitter<SignalingEvents>
  implements Signaling
{
  #id: string;
  #state: SignalingState = "disconnected";

  constructor(options?: Partial<SignalingOptions>) {
    super();
    this.#id = options?.id ?? randomId();
  }

  connect() {
    throw new Error("Method not implemented.");
  }

  disconnect() {
    throw new Error("Method not implemented.");
  }

  send(_msg: SignalingMessage) {
    throw new Error("Method not implemented.");
  }

  get id() {
    return this.#id;
  }

  get state() {
    return this.#state;
  }
}

export type SignalingMessage =
  | {
      type: "open";
      peerId: string;
    }
  | {
      type: "error";
      msg: string;
    }
  | {
      type: "offer" | "signal";
      source?: string;
      target: string;
      session: string;
      metadata: object;
      signal: SignalData;
    };

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
