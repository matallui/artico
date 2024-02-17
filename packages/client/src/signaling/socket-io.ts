import {
  Signaling,
  SignalingError,
  SignalingErrorType,
  SignalMessage,
  SignalingOptions,
  SignalingState,
  SignalingBase,
} from ".";
import logger from "@rtco/logger";
import { io, type Socket } from "socket.io-client";

export interface SocketSignalingOptions extends SignalingOptions {
  host: string;
  port: number;
}

export class SocketSignaling extends SignalingBase implements Signaling {
  #socket: Socket | undefined;
  #host: string;
  #port: number;
  #state: SignalingState = "disconnected";

  constructor(options?: Partial<SocketSignalingOptions>) {
    super(options?.id ? { id: options.id } : undefined);

    this.#host = options?.host ?? "0.artico.dev";
    this.#port = options?.port ?? 443;

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

    socket.on("open", (id: string) => {
      this.emit("open", id);
    });

    socket.on("signal", (msg: SignalMessage) => {
      logger.debug("signal (from server):", msg);
      switch (msg.type) {
        case "offer":
          if (!msg.source) {
            this.#emitError("signal", "Offer message missing source");
            return;
          }
        default:
          this.emit("signal", msg);
      }
    });

    socket.on("join", (roomId: string, peerId: string) => {
      this.emit("join", roomId, peerId);
    });

    socket.on("leave", (roomId: string, peerId: string) => {
      this.emit("leave", roomId, peerId);
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

  signal(msg: SignalMessage) {
    logger.debug("sending signal:", msg);
    if (this.#state !== "connected" || !this.#socket) {
      this.#emitError("disconnected", "Cannot send message unless connected");
      return;
    }
    this.#socket.emit("signal", msg);
  }

  join(roomId: string) {
    if (this.#state !== "connected" || !this.#socket) {
      this.#emitError("disconnected", "Cannot join room while disconnected");
      return;
    }
    this.#socket.emit("join", roomId);
  }

  leave(roomId: string) {
    if (this.#state !== "connected" || !this.#socket) {
      this.#emitError("disconnected", "Cannot leave room while disconnected");
      return;
    }
    this.#socket.emit("leave", roomId);
  }

  #emitError(type: SignalingErrorType, err: Error | string) {
    logger.debug("signaling error:", type, err);
    this.emit("error", new SignalingError(type, err));
  }
}
