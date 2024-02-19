import logger, { LogLevel } from "@rtco/logger";
import { WRTC } from "@rtco/peer";
import EventEmitter from "eventemitter3";
import {
  Signaling,
  SignalingError,
  SignalingState,
  SignalMessage,
} from "~/signaling";
import { SocketSignaling } from "~/signaling/socket-io";
import { Connection } from "~/connection";
import { Room } from "~/room";

export type ArticoError = SignalingError;

export type ArticoOptions = {
  debug: LogLevel;
  id: string;
  signaling: Signaling;
  wrtc: WRTC;
};

export type ArticoEvents = {
  open: (id: string) => void;
  call: (conn: Connection) => void;
  close: () => void;
  error: (err: ArticoError) => void;
};

interface IArtico {
  get id(): string;
  get state(): SignalingState;
  call: (target: string, metadata?: string) => Connection;
  join: (roomId: string) => Room;
  reconnect: () => void;
  disconnect: () => void;
  close: () => void;
}

export class Artico extends EventEmitter<ArticoEvents> implements IArtico {
  readonly #options: ArticoOptions;
  readonly #signaling: Signaling;

  constructor(options: Partial<ArticoOptions>) {
    super();

    const signaling =
      options.signaling ?? new SocketSignaling({ id: options.id });

    options = {
      debug: LogLevel.Errors,
      signaling,
      ...options,
    };
    this.#options = options as ArticoOptions;
    this.#signaling = signaling;

    logger.logLevel = this.#options.debug;

    logger.debug("new Artico:", this.#options);

    this.#signaling.on("error", (err) => {
      this.emit("error", err);
    });

    this.#signaling.on("connect", () => {
      logger.debug("signaling connected");
    });

    this.#signaling.on("disconnect", () => {
      this.close();
      logger.debug("signaling disconnected");
    });

    this.#signaling.on("open", (id) => {
      this.emit("open", id);
    });

    this.#signaling.on("signal", this.#handleSignal.bind(this));

    this.#signaling.connect();
  }

  get id() {
    return this.#options.id;
  }

  get state() {
    return this.#signaling.state;
  }

  call = (target: string, metadata?: string) => {
    logger.debug("call:", target, metadata);

    if (this.#signaling.state !== "ready") {
      throw new Error("Cannot call peers until signaling is ready.");
    }

    const conn = new Connection(this.#signaling, target, {
      debug: this.#options.debug,
      wrtc: this.#options.wrtc,
      metadata,
    });
    return conn;
  };

  join = (roomId: string) => {
    logger.debug("join:", roomId);

    if (this.#signaling.state !== "ready") {
      throw new Error("Cannot join room until signaling is ready.");
    }

    const room = new Room(this.#signaling, roomId, {
      debug: this.#options.debug,
      wrtc: this.#options.wrtc,
    });
    return room;
  };

  reconnect = () => {
    logger.debug("reconnect");
    if (this.#signaling.state !== "disconnected") {
      return;
    }
    this.#signaling.connect();
  };

  disconnect = () => {
    logger.debug("disconnect");
    if (this.#signaling.state === "disconnected") {
      return;
    }
    this.#signaling.disconnect();
  };

  close = () => {
    logger.debug("close");
    this.disconnect();
    this.emit("close");
  };

  #handleSignal(msg: SignalMessage) {
    // Artico only handles "call" signals that are not meant for a room
    if (msg.type === "call" && !msg.room) {
      logger.debug("call from", msg.source, msg.signal);

      const conn = new Connection(this.#signaling, msg.source!, {
        debug: this.#options.debug,
        wrtc: this.#options.wrtc,
        signal: msg.signal,
        conn: msg.conn,
        metadata: msg.metadata,
      });
      this.emit("call", conn);
    }
  }
}
