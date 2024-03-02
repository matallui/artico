import {
  InSignalMessage,
  OutSignalMessage,
  Signaling,
  SignalingEvents,
  SignalingState,
} from ".";
import { LogLevel, Logger } from "@rtco/logger";
import { io, type Socket } from "socket.io-client";
import { EventEmitter } from "eventemitter3";
import { randomId } from "~/util";

export interface SocketSignalingOptions {
  debug: LogLevel;
  host: string;
  port: number;
}

export class SocketSignaling
  extends EventEmitter<SignalingEvents>
  implements Signaling
{
  #logger: Logger;
  #socket: Socket | undefined;
  #state: SignalingState = "disconnected";
  #host: string;
  #port: number;
  #id = randomId();

  constructor(options?: Partial<SocketSignalingOptions>) {
    super();

    this.#logger = new Logger("[io]", options?.debug ?? LogLevel.Errors);
    this.#logger.debug("new SocketSignaling:", options);

    this.#host = options?.host ?? "0.artico.dev";
    this.#port = options?.port ?? 443;

    // TODO: figure out a way of using this when doing dev
    // without using NODE_ENV, so other people can use it
    // in dev as well.
    // if (process.env.NODE_ENV === "development") {
    //   this.#host = "localhost";
    //   this.#port = 9000;
    // }
  }

  get id() {
    return this.#id;
  }

  get state() {
    return this.#state;
  }

  connect(id?: string) {
    this.#logger.debug(`connect(${id})`);
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
      this.#logger.debug("connect");
      this.#state = "connected";
    });

    socket.on("open", (id: string) => {
      this.#logger.debug("open:", id);
      this.#state = "ready";
      this.emit("connect", id);
    });

    socket.on("signal", (msg: InSignalMessage) => {
      this.#logger.debug("rx signal:", msg);
      this.emit("signal", msg);
    });

    socket.on("join", (roomId: string, peerId: string, metadata?: string) => {
      this.#logger.debug("join:", { roomId, peerId, metadata });
      this.emit("join", roomId, peerId, metadata);
    });

    socket.on("error", (msg: string) => {
      this.#logger.debug("error:", msg);
      this.emit("error", new Error(msg));
    });

    socket.on("connect_error", () => {
      this.#logger.debug("connect_error");
      this.emit("error", new Error("Error connecting to signaling server"));
    });

    socket.on("disconnect", () => {
      this.#logger.debug("disconnect");
      this.#state = "disconnected";
      this.emit("disconnect");
    });

    this.#socket = socket;
  }

  disconnect() {
    this.#logger.debug("disconnect()");
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
    this.#logger.debug("tx signal:", msg);
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
    this.#logger.debug(`join(${roomId}, ${metadata})`);
    this.#socket.emit("join", roomId, metadata);
  }
}
