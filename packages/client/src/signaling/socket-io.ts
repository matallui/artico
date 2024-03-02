import {
  InSignalMessage,
  OutSignalMessage,
  Signaling,
  SignalingEvents,
  SignalingState,
} from ".";
import logger from "@rtco/logger";
import { io, type Socket } from "socket.io-client";
import { EventEmitter } from "eventemitter3";
import { randomId } from "~/util";

export interface SocketSignalingOptions {
  host: string;
  port: number;
}

export class SocketSignaling
  extends EventEmitter<SignalingEvents>
  implements Signaling
{
  #socket: Socket | undefined;
  #state: SignalingState = "disconnected";
  #host: string;
  #port: number;
  #id = randomId();

  constructor(options?: Partial<SocketSignalingOptions>) {
    super();

    this.#host = options?.host ?? "0.artico.dev";
    this.#port = options?.port ?? 443;

    if (process.env.NODE_ENV === "development") {
      this.#host = "localhost";
      this.#port = 9000;
    }
  }

  get id() {
    return this.#id;
  }

  get state() {
    return this.#state;
  }

  connect(id?: string) {
    if (id) {
      this.#id = id;
    }

    this.#state = "connecting";

    const socket = io(`${this.#host}:${this.#port}`, {
      query: {
        id: this.#id,
      },
    });

    socket.on("connect", () => {
      logger.debug("signaling connected");
      this.#state = "connected";
    });

    socket.on("open", (id: string) => {
      logger.debug("signaling ready:", id);
      this.#state = "ready";
      this.emit("connect", id);
    });

    socket.on("signal", (msg: InSignalMessage) => {
      logger.debug("rx signal:", msg);
      this.emit("signal", msg);
    });

    socket.on("join", (roomId: string, peerId: string, metadata?: string) => {
      this.emit("join", roomId, peerId, metadata);
    });

    socket.on("leave", (roomId: string, peerId: string) => {
      this.emit("leave", roomId, peerId);
    });

    socket.on("error", (msg: string) => {
      this.emit("error", new Error(msg));
    });

    socket.on("connect_error", () => {
      logger.debug("error connecting to signaling server");
      this.emit("error", new Error("Error connecting to signaling server"));
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

  signal(msg: OutSignalMessage) {
    if (this.#state !== "ready" || !this.#socket) {
      this.emit(
        "error",
        new Error("Cannot send message until signaling is ready"),
      );
      return;
    }
    logger.debug("tx signal:", msg);
    this.#socket.emit("signal", msg);
  }

  join(roomId: string, metadata?: string) {
    if (this.#state !== "ready" || !this.#socket) {
      this.emit(
        "error",
        new Error("Cannot join room until signaling is ready"),
      );
      return;
    }
    this.#socket.emit("join", roomId, metadata);
  }

  leave(roomId: string) {
    if (this.#state !== "ready" || !this.#socket) {
      this.emit(
        "error",
        new Error("Cannot leave room unless signaling is ready"),
      );
      return;
    }
    this.#socket.emit("leave", roomId);
  }
}
