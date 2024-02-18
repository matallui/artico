import logger, { LogLevel } from "@rtco/logger";
import { WRTC } from "@rtco/peer";
import EventEmitter from "eventemitter3";
import { Signaling, SignalingError, SignalMessage } from "~/signaling";
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
  call: (target: string, metadata?: object) => Connection;
  join: (roomId: string) => Room;
  reconnect: () => void;
  disconnect: () => void;
  close: () => void;
}

export class Artico extends EventEmitter<ArticoEvents> implements IArtico {
  readonly #options: ArticoOptions;
  readonly #connections: Map<string, Connection> = new Map();
  readonly #rooms: Map<string, Room> = new Map();
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
      logger.debug("signaling disconnected");
    });

    this.#signaling.on("open", (id) => {
      this.emit("open", id);
    });

    this.#signaling.on("signal", this.#handleSignal.bind(this));

    this.#signaling.on("join", (roomId, peerId) => {
      this.#rooms.get(roomId)?.emit("join", peerId);
    });

    this.#signaling.on("leave", (roomId, peerId) => {
      this.#rooms.get(roomId)?.emit("leave", peerId);
    });

    this.#signaling.connect();
  }

  get options() {
    return this.#options;
  }

  get connections() {
    return this.#connections;
  }

  call = (target: string, metadata?: object) => {
    logger.debug("call:", target, metadata);

    if (this.#signaling.state !== "connected") {
      throw new Error("Cannot call while disconnected.");
    }

    const conn = new Connection(this.#signaling, target, {
      debug: this.options.debug,
      wrtc: this.options.wrtc,
      metadata,
    });
    this.#connections.set(conn.id, conn);

    conn.on("close", () => {
      this.#connections.delete(conn.id);
    });

    return conn;
  };

  join = (roomId: string) => {
    logger.debug("join:", roomId);

    if (this.#signaling.state !== "connected") {
      throw new Error("Cannot join room while disconnected.");
    }

    const room = new Room(this.#signaling, roomId, {
      debug: this.options.debug,
      wrtc: this.options.wrtc,
    });
    this.#rooms.set(roomId, room);

    room.on("leave", () => {
      this.#rooms.delete(roomId);
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
    this.#connections.forEach((conn) => conn.close());
    this.#connections.clear();
    this.emit("close");
  };

  #handleSignal(msg: SignalMessage) {
    // Artico only handles "call" signals
    if (msg.type === "call") {
      logger.debug("call from", msg.source, msg.signal);

      const conn = new Connection(this.#signaling, msg.source!, {
        debug: this.options.debug,
        wrtc: this.options.wrtc,
        signal: msg.signal,
        session: msg.session,
        metadata: msg.metadata,
      });

      this.#connections.set(conn.id, conn);

      this.emit("call", conn);
    }
  }
}
