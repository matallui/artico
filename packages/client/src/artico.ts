import { Connection } from "./connection";
import logger, { LogLevel } from "./logger";
import { Signaling, SocketIOSignaling } from "./signaling";
import type { WRTC } from "@rtco/peer";
import EventEmitter from "eventemitter3";

export type ArticoErrorType = "network" | "signal" | "disconnected";

type ArticoServerMessage = {
  type: "signal" | "offer" | "open" | "error";
  src: string;
  payload: any;
};

class ArticoError extends Error {
  type: ArticoErrorType;

  constructor(type: ArticoErrorType, err: Error | string) {
    if (typeof err === "string") {
      super(err);
    } else {
      super();
      Object.assign(this, err);
    }
    this.type = type;
  }
}
export type { ArticoError };

export type ArticoOptions = {
  id: string;
  debug: LogLevel;
  wrtc: WRTC;
  signaling: Signaling;
};

export type ArticoEvents = {
  open: (id: string) => void;
  call: (conn: Connection) => void;
  close: () => void;
  error: (err: ArticoError) => void;
};

export class Artico extends EventEmitter<ArticoEvents> {
  readonly #options: ArticoOptions;
  readonly #connections: Map<string, Connection> = new Map();
  readonly #signaling: Signaling;

  constructor(options: Partial<ArticoOptions>) {
    super();

    options = {
      debug: LogLevel.Errors,
      signaling: options.signaling ?? new SocketIOSignaling({ id: options.id }),
      ...options,
    };
    this.#options = options as ArticoOptions;
    this.#signaling = options.signaling!;

    logger.logLevel = this.#options.debug;

    logger.debug("Artico options:", this.#options);

    this.#signaling.on("connect", () => {
      logger.debug("Signaling connected");
    });
    this.#signaling.on("disconnect", () => {
      logger.debug("Signaling disconnected");
    });
    this.#signaling.on("message", this.#handleMessage.bind(this));

    this.#signaling.connect();
  }

  get options() {
    return this.#options;
  }

  get connections() {
    return this.#connections;
  }

  call = (target: string, metadata?: object) => {
    logger.debug("Calling:", target, metadata);
    if (this.#signaling.state !== "connected") {
      this.#emitError(
        "disconnected",
        "Cannot connect to a new peer after disconnecting from server."
      );
      return;
    }

    const conn = new Connection(this.#signaling, target, {
      debug: this.options.debug,
      wrtc: this.options.wrtc,
      initiator: true,
      metadata,
    });

    conn.on("close", () => {
      this.#connections.delete(conn.id);
    });
    this.#connections.set(conn.id, conn);

    return conn;
  };

  reconnect = () => {
    logger.debug("Reconnecting");
    if (this.#signaling.state !== "disconnected") {
      return;
    }
    this.#signaling.connect();
  };

  disconnect = async () => {
    logger.debug("Disconnecting");
    if (this.#signaling.state === "disconnected") {
      return;
    }
    this.#signaling.disconnect();
  };

  close = async () => {
    logger.debug("Closing");
    await this.disconnect();
    this.#connections.forEach((conn) => conn.close());
    this.#connections.clear();
    this.emit("close");
  };

  #emitError(type: ArticoErrorType, err: Error | string) {
    this.emit("error", new ArticoError(type, err));
  }

  #handleMessage(msg: ArticoServerMessage) {
    const { type, payload, src: peerId } = msg;
    logger.debug("Server message:", type, peerId);

    switch (type) {
      // The connection to the server is open.
      case "open":
        logger.debug("open:", peerId);
        this.emit("open", peerId);
        break;

      // Server error.
      case "error":
        logger.warn("server error:", payload);
        break;

      // Someone is trying to call us.
      case "offer":
        {
          const { session, metadata, signal } = payload;
          logger.debug("offer:", payload);

          const conn = new Connection(this.#signaling, peerId, {
            debug: this.options.debug,
            wrtc: this.options.wrtc,
            initiator: false,
            session,
            metadata,
          });

          conn.signal(signal);

          this.#connections.set(conn.id, conn);

          this.emit("call", conn);
        }
        break;

      // WebRTC signaling data.
      case "signal":
        {
          const { session, signal } = payload;
          logger.debug("signal:", payload);

          const conn = this.#connections.get(session);
          if (!conn) {
            logger.warn("received signal for unknown session:", session);
            return;
          }

          conn.signal(signal);
        }
        break;

      default:
        logger.warn("unknown message:", msg);
        break;
    }
  }
}
