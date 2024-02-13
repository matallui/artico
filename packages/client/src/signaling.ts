import logger from "@rtco/logger";
import { SignalData } from "@rtco/peer";
import { EventEmitter } from "eventemitter3";
import { io, type Socket } from "socket.io-client";

import { randomId } from "./util";

type SignalingState = "disconnected" | "connecting" | "connected";

export interface Signaling extends EventEmitter<SignalingEvents> {
  connect(): void;
  disconnect(): void;
  send(msg: SignalingMessage): void;
  get state(): SignalingState;
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

class SignalingError extends Error {
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
export type { SignalingError };

export type SignalingEvents = {
  connect: () => void;
  disconnect: () => void;
  error: (err: Error) => void;
  message: (msg: SignalingMessage) => void;
};

export type SocketSignalingOptions = {
  id: string;
  host: string;
  port: number;
};

export class SocketSignaling
  extends EventEmitter<SignalingEvents>
  implements Signaling
{
  #id: string;
  #socket: Socket | undefined;
  #host: string;
  #port: number;
  #state: SignalingState = "disconnected";

  constructor(options: Partial<SocketSignalingOptions>) {
    super();
    this.#id = options.id ?? randomId();
    this.#host = options.host ?? "0.artico.dev";
    this.#port = options.port ?? 443;

    if (process.env.NODE_ENV === "development") {
      this.#host = "localhost";
      this.#port = 9000;
    }
  }

  get state() {
    return this.#state;
  }

  connect() {
    this.#state = "connecting";

    const socket = io(`${this.#host}:${this.#port}`, {
      query: {
        id: this.#id,
      },
    });

    socket.on("connect", () => {
      logger.debug("connected to signaling server");
      this.#state = "connected";
      this.emit("connect");
    });

    socket.on("message", (msg: SignalingMessage) => {
      logger.debug("server message:", msg);
      this.emit("message", msg);
    });

    socket.on("error", (msg: string) => {
      this.#emitError("signal", msg);
    });

    socket.on("connect_error", () => {
      logger.debug("error connecting to signaling server");
      this.#emitError("network", "Error connecting to signaling server");
    });

    socket.on("disconnect", () => {
      logger.log("disconnected from signaling server");
      this.#state = "disconnected";
      this.emit("disconnect");
    });

    this.#socket = socket;
  }

  disconnect() {
    logger.debug("disconnecting from signaling server");
    if (this.#state === "disconnected") {
      return;
    }
    this.#socket?.disconnect();
    this.#socket = undefined;
    this.#state = "disconnected";
  }

  send(msg: SignalingMessage) {
    logger.debug("sending message:", msg);
    if (this.#state !== "connected" || !this.#socket) {
      this.#emitError("signal", "Cannot send message unless connected");
      return;
    }
    this.#socket.emit("message", msg);
  }

  #emitError(type: SignalingErrorType, err: Error | string) {
    logger.debug("signaling error:", type, err);
    this.emit("error", new SignalingError(type, err));
  }
}
