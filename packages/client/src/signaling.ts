import logger from "./logger";
import { randomId } from "./util";
import { SignalData } from "@rtco/peer";
import { EventEmitter } from "eventemitter3";
import { io, type Socket } from "socket.io-client";

export type SignalingServerMessage = {
  type: "signal" | "offer" | "open" | "error";
  src: string;
  payload: any;
};

export type SignalingMessage = {
  type: "signal" | "offer" | "open" | "error";
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
  message: (msg: SignalingServerMessage) => void;
};

export type SocketIOSignalingOptions = {
  id: string;
  host: string;
  port: number;
};

type SignalingState = "disconnected" | "connecting" | "connected";

export interface Signaling extends EventEmitter<SignalingEvents> {
  connect(): void;
  disconnect(): void;
  send(msg: SignalingMessage): void;
  get state(): SignalingState;
}

export class SocketIOSignaling
  extends EventEmitter<SignalingEvents>
  implements Signaling
{
  #id: string;
  #socket: Socket | undefined;
  #host: string;
  #port: number;
  #state: SignalingState = "disconnected";

  constructor(options: Partial<SocketIOSignalingOptions>) {
    super();
    this.#id = options.id ?? randomId();
    this.#host = options.host ?? "0.artico.dev";
    this.#port = options.port ?? 443;

    this.connect();
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
      this.#state = "connected";
      logger.debug("connected to signaling server");
    });

    socket.on("message", (msg: SignalingServerMessage) => {
      logger.debug("server message:", msg);
      this.emit("message", msg);
    });

    socket.on("connect_error", () => {
      this.#emitError("network", "Error connecting to signaling server");
    });

    socket.on("disconnect", () => {
      logger.log("disconnected from signaling server");
      this.#state = "disconnected";
    });

    return socket;
  }

  disconnect() {
    if (this.#state === "disconnected") {
      return;
    }
    this.#socket?.disconnect();
  }

  send(msg: SignalingMessage) {
    if (this.#state !== "connected") {
      this.#emitError("signal", "Cannot send message unless connected");
      return;
    }
    this.#socket?.emit(msg.type, msg);
  }

  #emitError(type: SignalingErrorType, err: Error | string) {
    this.emit("error", new SignalingError(type, err));
  }
}
