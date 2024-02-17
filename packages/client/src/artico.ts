import logger, { LogLevel } from "@rtco/logger";
import { WRTC } from "@rtco/peer";
import EventEmitter from "eventemitter3";
import { Signaling, SignalingError, SignalMessage } from "./signaling";
import { SocketSignaling } from "./signaling/socket-io";
import { Connection } from "./connection";
import { Room } from "./room";

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

    logger.debug("Artico options:", this.#options);

    this.#signaling.on("error", (err) => {
      this.emit("error", err);
    });

    this.#signaling.on("connect", () => {
      logger.debug("Signaling connected");
    });

    this.#signaling.on("disconnect", () => {
      logger.debug("Signaling disconnected");
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
      initiator: true,
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
    switch (msg.type) {
      // Someone is trying to call us.
      case "offer":
        {
          logger.debug("offer from", msg.source, msg.signal);

          const conn = new Connection(this.#signaling, msg.source!, {
            debug: this.options.debug,
            wrtc: this.options.wrtc,
            initiator: false,
            session: msg.session,
            metadata: msg.metadata,
          });

          conn.signal(msg.signal);

          this.#connections.set(conn.id, conn);

          this.emit("call", conn);
        }
        break;

      // WebRTC signaling data.
      case "signal":
        {
          logger.debug("signal:", msg.signal);

          const conn = this.#connections.get(msg.session);
          if (!conn) {
            logger.warn("received signal for unknown session:", msg.session);
            return;
          }

          conn.signal(msg.signal);
        }
        break;

      default:
        logger.warn("unknown message:", msg);
        break;
    }
  }
}
