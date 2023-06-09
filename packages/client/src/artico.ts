import { Connection } from "./connection";
import logger, { LogLevel } from "./logger";
import { randomId } from "./util";
import EventEmitter from "eventemitter3";
import { io, type Socket } from "socket.io-client";

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
  debug: LogLevel;
  host: string;
  port: number;
  /** custom webrtc implementation, mainly useful in node to specify in the [wrtc](https://npmjs.com/package/wrtc) package. */
  wrtc?: {
    RTCPeerConnection: typeof RTCPeerConnection;
    RTCSessionDescription: typeof RTCSessionDescription;
    RTCIceCandidate: typeof RTCIceCandidate;
  };
};

export type ArticoEvents = {
  open: (id: string) => void;
  call: (conn: Connection) => void;
  close: () => void;
  error: (err: ArticoError) => void;
};

export class Artico extends EventEmitter<ArticoEvents> {
  private readonly _options: ArticoOptions;

  private readonly _id: string;
  private readonly _socket: Socket;

  private readonly _connections: Map<string, Connection> = new Map();

  private _open = false;
  private _disconnected = false;

  constructor(options: Partial<ArticoOptions>);
  constructor(id: string, options?: Partial<ArticoOptions>);

  constructor(
    id: string | Partial<ArticoOptions>,
    options?: Partial<ArticoOptions>
  ) {
    super();

    let userId: string | undefined;

    // Deal with overloading
    if (id && id.constructor == Object) {
      options = id as Partial<ArticoOptions>;
    } else if (id) {
      userId = id.toString();
    }

    options = {
      debug: LogLevel.Errors,
      host: "https://0.artico.dev",
      port: 443,
      ...options,
    };
    this._options = options as ArticoOptions;

    logger.logLevel = this._options.debug;

    this._id = userId || randomId();
    this._socket = this._createServerConnection();
  }

  get id() {
    return this._id;
  }

  get options() {
    return this._options;
  }

  get open() {
    return this._open;
  }

  get disconnected() {
    return this._disconnected;
  }

  get connections() {
    return this._connections;
  }

  /**
   * @internal
   */
  get socket() {
    return this._socket;
  }

  public call = (target: string, metadata?: object) => {
    if (this.disconnected) {
      this.emitError(
        "disconnected",
        "Cannot connect to a new peer after disconnecting from server."
      );
      return;
    }

    const conn = new Connection(this, target, {
      debug: this.options.debug,
      wrtc: this.options.wrtc,
      initiator: true,
      metadata,
    });

    conn.on("close", () => {
      this._connections.delete(conn.id);
    });
    this._connections.set(conn.id, conn);

    return conn;
  };

  public reconnect = () => {
    if (!this.disconnected) {
      return;
    }
    this._socket.connect();
  };

  public disconnect = async () => {
    if (this.disconnected) {
      return;
    }
    this._socket.disconnect();
    this._disconnected = true;
  };

  public close = async () => {
    await this.disconnect();
    this._connections.forEach((conn) => conn.close());
    this._connections.clear();
    this.emit("close");
  };

  emitError(type: ArticoErrorType, err: Error | string) {
    this.emit("error", new ArticoError(type, err));
  }

  private _createServerConnection() {
    const socket = io(`${this.options.host}:${this.options.port}`, {
      query: {
        id: this._id,
      },
    });

    socket.on("connect", () => {
      logger.log("connected to signaling server");
      this._disconnected = false;
    });

    socket.on("message", (msg: ArticoServerMessage) => {
      logger.debug("server message:", msg);
      this._handleMessage(msg);
    });

    socket.on("connect_error", () => {
      this.emitError("network", "Error connecting to signaling server");
    });

    socket.on("disconnect", () => {
      logger.log("disconnected from signaling server");
      this._disconnected = true;
    });

    return socket;
  }

  private _handleMessage(msg: ArticoServerMessage) {
    const { type, payload, src: peerId } = msg;

    switch (type) {
      // The connection to the server is open.
      case "open":
        console.debug("open:", peerId);
        this._open = true;
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

          const conn = new Connection(this, peerId, {
            debug: this.options.debug,
            wrtc: this.options.wrtc,
            initiator: false,
            session,
            metadata,
          });

          conn.signal(signal);

          this._connections.set(conn.id, conn);

          this.emit("call", conn);
        }
        break;

      // WebRTC signaling data.
      case "signal":
        {
          const { session, signal } = payload;
          logger.debug("signal:", payload);

          const conn = this._connections.get(session);
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
