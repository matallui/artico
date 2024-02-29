import logger, { LogLevel } from "@rtco/logger";
import Peer, { Signal } from "@rtco/peer";
import EventEmitter from "eventemitter3";
import { SignalMessage, Signaling } from "~/signaling";
import { randomToken } from "~/util";

type ArticoData = {
  type: "[artico]";
  data: {
    cmd: "stream-meta";
    payload: {
      streamId: string;
      metadata: string;
    };
  };
};

export type ConnectionOptions = {
  debug: LogLevel;
  initiator: boolean;
  metadata: string;
  conn: string;
  room?: string;
  signal?: Signal;
};

export type ConnectionEvents = {
  open: () => void;
  close: () => void;
  error: (err: Error) => void;

  data: (data: string) => void;

  stream: (stream: MediaStream, metadata?: string) => void;
  removestream: (stream: MediaStream, metadata?: string) => void;

  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: string,
  ) => void;
  removetrack: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: string,
  ) => void;
};

interface IConnection {
  get id(): string;
  get metadata(): string;
  get initiator(): boolean;
  get ready(): boolean;

  answer(): void;
  send(data: string): void;
  addStream(stream: MediaStream, metadata?: string): void;
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  removeStream(stream: MediaStream): void;
  removeTrack(track: MediaStreamTrack): void;
  close(): void;
}

export class Connection
  extends EventEmitter<ConnectionEvents>
  implements IConnection
{
  static readonly ID_PREFIX = "conn_";

  readonly #signaling: Signaling;

  readonly #id: string;
  readonly #target: string;
  readonly #options: ConnectionOptions;

  #peer?: Peer;
  #queue: Signal[] = [];

  #streamMetadata: Map<string, string> = new Map();

  constructor(
    signaling: Signaling,
    target: string,
    options?: Partial<ConnectionOptions>,
  ) {
    super();

    this.#options = {
      debug: LogLevel.Errors,
      conn: Connection.ID_PREFIX + randomToken(),
      initiator: false,
      metadata: "",
      ...options,
    };
    logger.debug("new Connection:", { target, ...this.#options });

    this.#id = this.#options.conn;
    this.#signaling = signaling;
    this.#target = target;

    this.#signaling.on("signal", this.#handleSignal);

    if (this.#options.signal) {
      this.#queue.push(this.#options.signal);
    }

    if (this.#options.initiator) {
      this.#startConnection(true);
    }
  }

  get id() {
    return this.#id;
  }

  get metadata() {
    return this.#options.metadata;
  }

  get initiator() {
    return this.#options.initiator;
  }

  get ready() {
    return this.#peer?.ready ?? false;
  }

  get target() {
    return this.#target;
  }

  close = async () => {
    this.#peer?.destroy();
    this.removeAllListeners();
  };

  answer = () => {
    if (this.initiator) {
      throw new Error("Only non-initiators can answer calls");
    }

    this.#startConnection();
  };

  send = async (data: string) => {
    this.#peer?.send(data);
  };

  addStream = async (stream: MediaStream, metadata?: string) => {
    console.log("[conn] addStream:", stream.id, metadata);
    const msg: ArticoData = {
      type: "[artico]",
      data: {
        cmd: "stream-meta",
        payload: {
          streamId: stream.id,
          metadata: metadata ?? "",
        },
      },
    };
    this.#peer?.send(JSON.stringify(msg));
    this.#peer?.addStream(stream);
  };

  removeStream = async (stream: MediaStream) => {
    this.#peer?.removeStream(stream);
  };

  addTrack = async (track: MediaStreamTrack, stream: MediaStream) => {
    this.#peer?.addTrack(track, stream);
  };

  removeTrack = async (track: MediaStreamTrack) => {
    this.#peer?.removeTrack(track);
  };

  #handleSignal = (msg: SignalMessage) => {
    // We only care about signals for this connection
    if (msg.conn !== this.#id || msg.type !== "signal") {
      return;
    }
    if (this.#peer) {
      this.#peer.signal(msg.signal);
    } else {
      this.#queue.push(msg.signal);
    }
  };

  #startConnection = (initiator = false) => {
    let firstOfferSent = false;

    const peer = new Peer({
      debug: this.#options.debug,
      initiator,
    });
    this.#peer = peer;

    while (this.#queue.length > 0) {
      const msg = this.#queue.pop();
      if (msg) peer.signal(msg);
    }

    peer.on("signal", (signal) => {
      if (
        this.initiator &&
        signal.type === "sdp" &&
        signal.data.type === "offer" &&
        !firstOfferSent
      ) {
        firstOfferSent = true;
        this.#signaling.signal({
          type: "call",
          target: this.#target,
          conn: this.id,
          room: this.#options.room,
          metadata: this.metadata,
          signal,
        });
      } else {
        this.#signaling.signal({
          type: "signal",
          target: this.#target,
          conn: this.id,
          room: this.#options.room,
          metadata: this.metadata,
          signal,
        });
      }
    });

    peer.on("connect", () => {
      logger.debug("connection open:", this.id);
      this.emit("open");
    });

    peer.on("data", (data) => {
      logger.debug("connection data:", { session: this.id, data });

      if (typeof data !== "string") {
        logger.warn("received non-string data:", { session: this.id, data });
        return;
      }

      try {
        const articoData = JSON.parse(data) as ArticoData;
        if (articoData.type === "[artico]") {
          const { cmd, payload } = articoData.data;
          switch (cmd) {
            case "stream-meta":
              logger.debug("adding stream metadata:", {
                session: this.id,
                streamId: payload.streamId,
                metadata: payload.metadata,
              });
              this.#streamMetadata.set(payload.streamId, payload.metadata);
              break;
            default:
              logger.warn("unknown artico command:", { session: this.id, cmd });
          }
        } else {
          this.emit("data", data);
        }
      } catch (_err) {
        this.emit("data", data);
      }
    });

    peer.on("stream", (stream) => {
      const metadata = this.#streamMetadata.get(stream.id);
      logger.debug("connection stream:", {
        session: this.id,
        stream,
        metadata,
      });
      this.emit("stream", stream, metadata);
    });

    peer.on("removestream", (stream) => {
      const metadata = this.#streamMetadata.get(stream.id);
      this.emit("removestream", stream, metadata);
      this.#streamMetadata.delete(stream.id);
    });

    peer.on("track", (track, stream) => {
      const metadata = this.#streamMetadata.get(stream.id);
      logger.debug("connection track:", {
        session: this.id,
        track,
        stream,
        metadata,
      });
      this.emit("track", track, stream, metadata);
    });

    peer.on("removetrack", (track, stream) => {
      const metadata = this.#streamMetadata.get(stream.id);
      this.emit("removetrack", track, stream, metadata);
    });

    peer.on("close", () => {
      logger.log("connection closed:", this.id);
      this.emit("close");
    });

    peer.on("error", (err) => {
      logger.warn("connection error:", { session: this.id, error: err });
      this.emit("error", err);
    });
  };
}
