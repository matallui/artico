import logger from "@rtco/logger";
import {
  SignalingBase,
  SignalingError,
  SignalingErrorType,
  SignalingMessage,
  SignalingOptions,
  SignalingState,
} from "@rtco/peer";
import { io, type Socket } from "socket.io-client";

export {
  SignalingBase,
  SignalingError,
  type SignalingErrorType,
  type SignalingMessage,
  type SignalingOptions,
  type SignalingState,
};

export interface SocketSignalingOptions extends SignalingOptions {
  host: string;
  port: number;
}

export class SocketSignaling extends SignalingBase {
  #socket: Socket | undefined;
  #host: string;
  #port: number;
  #state: SignalingState = "disconnected";

  constructor(options: Partial<SocketSignalingOptions>) {
    super({ id: options.id });

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
        id: this.id,
      },
    });

    socket.on("connect", () => {
      logger.debug("connected to signaling server");
      this.#state = "connected";
      this.emit("connect");
    });

    socket.on("message", (msg: SignalingMessage) => {
      logger.debug("server message:", msg);
      switch (msg.type) {
        case "offer":
          if (!msg.source) {
            this.#emitError("signal", "Offer message missing source");
            return;
          }
        default:
          this.emit("message", msg);
      }
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
