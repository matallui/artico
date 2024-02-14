import logger, { LogLevel } from "@rtco/logger";
import { Signaling, SignalingError, SignalingMessage, WRTC } from "@rtco/peer";
import EventEmitter from "eventemitter3";
import { Connection } from "./connection";
import { SocketSignaling } from "./signaling";

export type ArticoError = SignalingError;

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
      signaling: options.signaling ?? new SocketSignaling({ id: options.id }),
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

    this.#signaling.on("error", (err) => {
      this.emit("error", err);
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
    logger.debug("Calling:", target, metadata);
    if (this.#signaling.state !== "connected") {
      this.emit(
        "error",
        new SignalingError("disconnected", "Cannot call while disconnected."),
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

  #handleMessage(msg: SignalingMessage) {
    switch (msg.type) {
      // The connection to the server is open.
      case "open":
        logger.debug("open:", msg.peerId);
        this.emit("open", msg.peerId);
        break;

      // Server error.
      case "error":
        logger.warn("server error:", msg.msg);
        break;

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
