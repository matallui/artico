import { EventEmitter } from "eventemitter3";

import { Logger, LogLevel } from "@rtco/logger";

import type { InSignalMessage, Signaling, SignalingState } from "~/signaling";
import { Call } from "~/call";
import { Room } from "~/room";
import { SocketSignaling } from "~/signaling/socket-io";

export type ArticoEvents = {
  open: (id: string) => void;
  close: () => void;
  error: (err: Error) => void;
  call: (call: Call) => void;
};

export type ArticoOptions = {
  /**
   * The log level (0: none, 1: errors, 2: warnings, 3: info, 4: debug).
   * @defaultValue 1
   */
  debug: LogLevel;
  /**
   * Optional signaling implementation.
   * Defaults to using Artico's built-in socket.io signaling.
   */
  signaling: Signaling;
  /**
   * Requested peer ID. If not provided, a random ID will be generated.
   */
  id: string;
  /**
   * Optional RTCConfiguration for the peer connections.
   * @defaultValue { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" } ] }
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration
   */
  rtcConfig: RTCConfiguration;
};

interface IArtico {
  get id(): string;
  get state(): SignalingState;
  close: () => void;
  call: (target: string, metadata?: string) => Call;
  join: (roomId: string, metadata?: string) => Room;
}

export class Artico extends EventEmitter<ArticoEvents> implements IArtico {
  #logger: Logger;
  #signaling: Signaling;
  #calls = new Map<string, Call>();
  #rtcConfig?: RTCConfiguration;

  constructor(options?: Partial<ArticoOptions>) {
    super();

    this.#logger = new Logger("[artico]", options?.debug ?? LogLevel.Errors);
    this.#logger.debug("new Artico:", options);

    this.#signaling =
      options?.signaling ??
      new SocketSignaling({ debug: this.#logger.logLevel, id: options?.id });
    this.#rtcConfig = options?.rtcConfig;

    this.#setupSignalingListeners();

    this.#signaling.connect();
  }

  get id() {
    return this.#signaling.id;
  }

  get state() {
    return this.#signaling.state;
  }

  call = (target: string, metadata?: string) => {
    this.#logger.debug(`call(${target}, ${metadata})`);

    if (this.#signaling.state !== "ready") {
      throw new Error("Cannot call peers until signaling is ready.");
    }

    const call = new Call({
      signaling: this.#signaling,
      debug: this.#logger.logLevel,
      target,
      metadata,
      rtcConfig: this.#rtcConfig,
    });
    this.#calls.set(call.session, call);
    return call;
  };

  join = (roomId: string, metadata?: string) => {
    this.#logger.debug("join:", roomId, metadata);

    if (this.#signaling.state !== "ready") {
      throw new Error("Cannot join room until signaling is ready.");
    }

    return new Room({
      debug: this.#logger.logLevel,
      signaling: this.#signaling,
      roomId,
      metadata,
    });
  };

  close = () => {
    this.#logger.debug("close");
    this.removeAllListeners();
    this.#removeSignalingListeners();
    this.#signaling.disconnect();
    this.emit("close");
  };

  #setupSignalingListeners() {
    this.#signaling.on("error", this.#handleError.bind(this));
    this.#signaling.on("connect", this.#handleConnect.bind(this));
    this.#signaling.on("disconnect", this.#handleDisconnect.bind(this));
    this.#signaling.on("signal", this.#handleSignal.bind(this));
  }

  #removeSignalingListeners() {
    this.#signaling.off("error", this.#handleError.bind(this));
    this.#signaling.off("connect", this.#handleConnect.bind(this));
    this.#signaling.off("disconnect", this.#handleDisconnect.bind(this));
    this.#signaling.off("signal", this.#handleSignal.bind(this));
  }

  #handleError(err: Error) {
    this.emit("error", err);
  }

  #handleConnect(id: string) {
    this.emit("open", id);
  }

  #handleDisconnect() {
    this.emit("close");
    this.removeAllListeners();
    this.#removeSignalingListeners();
  }

  #handleSignal(msg: InSignalMessage) {
    // Artico only handles the first signal for a call,
    // so it can generate a "call" event for the app.
    if (
      msg.session.startsWith(Call.SESSION_PREFIX) &&
      !this.#calls.has(msg.session)
    ) {
      this.#logger.debug("call from", msg.source, msg.signal);

      const call = new Call({
        debug: this.#logger.logLevel,
        signaling: this.#signaling,
        metadata: msg.metadata,
        signal: msg,
        rtcConfig: this.#rtcConfig,
      });
      this.#calls.set(call.session, call);
      this.emit("call", call);
    }
  }
}
