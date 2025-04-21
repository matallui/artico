import type { Socket } from "socket.io-client";
import { EventEmitter } from "eventemitter3";
import { io } from "socket.io-client";

import { Logger, LogLevel } from "@rtco/logger";

import type {
  InSignalMessage,
  OutSignalMessage,
  Signaling,
  SignalingEvents,
  SignalingState,
} from ".";
import { randomId } from "~/util";

export interface SocketSignalingOptions {
  debug: LogLevel;
  url: string;
  id: string;
}

export class SocketSignaling
  extends EventEmitter<SignalingEvents>
  implements Signaling
{
  #logger: Logger;
  #state: SignalingState = "disconnected";
  #socket: Socket;
  #url: string;
  #id: string;

  constructor(options?: Partial<SocketSignalingOptions>) {
    super();

    this.#logger = new Logger("[io]", options?.debug ?? LogLevel.Errors);
    this.#logger.debug("new SocketSignaling:", options);

    this.#url = options?.url ?? "https://0.artico.dev:443";
    this.#id = options?.id ?? randomId();

    this.#socket = io(this.#url, {
      autoConnect: false,
      transports: ["websocket"],
      query: {
        id: this.#id,
      },
    });
  }

  get id() {
    return this.#id;
  }

  get state() {
    return this.#state;
  }

  connect() {
    this.#logger.debug(`connect(${this.#id})`);
    this.#state = "connecting";
    this.#setupSocketListeners();
    this.#socket.connect();
  }

  disconnect() {
    this.#logger.debug("disconnect()");
    this.#removeSocketListeners();
    this.#socket.disconnect();
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

  #setupSocketListeners() {
    this.#socket.on("connect", this.#onSockerConnect.bind(this));
    this.#socket.on("disconnect", this.#onSocketDisconnect.bind(this));
    this.#socket.on("connect_error", this.#onSocketConnectError.bind(this));
    this.#socket.on("open", this.#onSocketOpen.bind(this));
    this.#socket.on("error", this.#onSocketError.bind(this));
    this.#socket.on("signal", this.#onSocketSignal.bind(this));
    this.#socket.on("join", this.#onSocketJoin.bind(this));
  }

  #removeSocketListeners() {
    this.#socket.removeAllListeners();
  }

  #onSockerConnect() {
    this.#logger.debug("connect");
    this.#state = "connected";
  }

  #onSocketDisconnect() {
    this.#logger.debug("disconnect");
    this.#state = "disconnected";
    this.emit("disconnect");
    this.#removeSocketListeners();
  }

  #onSocketConnectError(err: Error) {
    this.#logger.debug("connect_error:", err.message);
    this.emit("error", new Error("connect-error"));
  }

  #onSocketOpen(id: string) {
    this.#logger.debug("open:", id);
    this.#state = "ready";
    this.emit("connect", id);
  }

  #onSocketError(msg: string) {
    this.#logger.debug("error:", msg);
    this.emit("error", new Error(msg));
    this.#removeSocketListeners();
    this.#socket.disconnect();
    this.#state = "disconnected";
    this.emit("disconnect");
  }

  #onSocketSignal(msg: InSignalMessage) {
    this.#logger.debug("rx signal:", msg);
    this.emit("signal", msg);
  }

  #onSocketJoin(roomId: string, peerId: string, metadata?: string) {
    this.#logger.debug("join:", { roomId, peerId, metadata });
    this.emit("join", roomId, peerId, metadata);
  }
}
