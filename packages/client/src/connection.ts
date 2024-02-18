import logger, { LogLevel } from "@rtco/logger";
import Peer, { SignalData, WRTC } from "@rtco/peer";
import EventEmitter from "eventemitter3";
import { SignalMessage, Signaling } from "~/signaling";
import { randomToken } from "~/util";

type ArticoData = {
  type: "artico";
  data: {
    cmd: "stream-meta";
    payload: {
      streamId: string;
      metadata: object;
    };
  };
};

export type ConnectionOptions = {
  debug: LogLevel;
  metadata: object;
  session: string;
  signal?: SignalData;
  wrtc?: WRTC;
};

export type ConnectionEvents = {
  open: () => void;
  close: () => void;
  error: (err: Error) => void;

  data: (data: unknown) => void;

  stream: (stream: MediaStream, metadata?: object) => void;
  removestream: (stream: MediaStream, metadata?: object) => void;

  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: object,
  ) => void;
  removetrack: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: object,
  ) => void;
};

export class Connection extends EventEmitter<ConnectionEvents> {
  static readonly ID_PREFIX = "conn_";

  readonly #signaling: Signaling;

  readonly #id: string;
  readonly #target: string;
  readonly #options: ConnectionOptions;

  #peer?: Peer;
  #queue: SignalData[] = [];

  #streamMetadata: Map<string, object> = new Map();

  #open = false;

  constructor(
    signaling: Signaling,
    target: string,
    options?: Partial<ConnectionOptions>,
  ) {
    super();

    this.#options = {
      debug: LogLevel.Errors,
      session: Connection.ID_PREFIX + randomToken(),
      metadata: {},
      ...options,
    };
    logger.debug("new Connection:", this.#options);

    this.#id = this.#options.session;
    this.#signaling = signaling;
    this.#target = target;

    this.#signaling.on("signal", this.#handleSignal);

    if (this.#options.signal) {
      this.#queue.push(this.#options.signal);
    } else {
      this.#startConnection();
    }
  }

  get id() {
    return this.#id;
  }

  get metadata() {
    return this.#options.metadata;
  }

  get initiator() {
    return this.#options.signal === undefined;
  }

  get open() {
    return this.#open;
  }

  get signaling() {
    return this.#signaling;
  }

  get target() {
    return this.#target;
  }

  get peer() {
    return this.#peer;
  }

  public answer = () => {
    if (this.initiator) {
      throw new Error("Only non-initiators can answer calls");
    }

    this.#startConnection();
  };

  public send = async (data: string) => {
    this.peer?.send(data);
  };

  public addStream = async (stream: MediaStream, metadata?: object) => {
    const msg: ArticoData = {
      type: "artico",
      data: {
        cmd: "stream-meta",
        payload: {
          streamId: stream.id,
          metadata: metadata || {},
        },
      },
    };
    this.peer?.send(JSON.stringify(msg));
    this.peer?.addStream(stream);
  };

  public addTrack = async (track: MediaStreamTrack, stream: MediaStream) => {
    this.peer?.addTrack(track, stream);
  };
  public removeStream = async (stream: MediaStream) => {
    this.peer?.removeStream(stream);
  };

  public removeTrack = async (track: MediaStreamTrack) => {
    this.peer?.removeTrack(track);
  };

  public close = async () => {
    this.peer?.destroy();
  };

  #handleSignal = (msg: SignalMessage) => {
    // We only care about signals for this connection
    if (msg.session !== this.#id || msg.type !== "signal") {
      return;
    }
    if (this.peer) {
      this.peer.signal(msg.signal);
    } else {
      this.#queue.push(msg.signal);
    }
  };

  #startConnection = () => {
    let firstOfferSent = false;

    const peer = new Peer({
      debug: this.#options.debug,
      initiator: this.initiator,
      wrtc: this.#options.wrtc,
    });
    this.#peer = peer;

    while (this.#queue.length > 0) {
      const msg = this.#queue.pop();
      if (msg) peer.signal(msg);
    }

    peer.on("signal", (signal) => {
      logger.debug("connection signal:", { session: this.id, signal });
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
          session: this.id,
          metadata: this.metadata,
          signal,
        });
      } else {
        this.#signaling.signal({
          type: "signal",
          target: this.#target,
          session: this.id,
          metadata: this.metadata,
          signal,
        });
      }
    });

    peer.on("connect", () => {
      logger.log("connection open:", this.id);
      this.#open = true;
      this.emit("open");
    });

    peer.on("data", (data) => {
      logger.debug("connection data:", { session: this.id, data });

      if (typeof data !== "string") {
        logger.warn("received non-string data:", { session: this.id, data });
        return;
      }

      const articoData = JSON.parse(data) as ArticoData;
      if (articoData.type === "artico") {
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
