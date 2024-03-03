import { Logger, LogLevel } from "@rtco/logger";
import Peer, { Signal } from "@rtco/peer";
import EventEmitter from "eventemitter3";
import { InSignalMessage, OutSignalMessage, Signaling } from "~/signaling";
import { randomToken } from "~/util";

type ArticoData = {
  type: "[artico]";
  data: {
    cmd: "stream-meta";
    payload: {
      streamId: string;
      metadata?: string;
    };
  };
};

interface CallOpts {
  signaling: Signaling;
  debug?: LogLevel;
  metadata?: string;
}

interface CallerOptions extends CallOpts {
  target: string;
  session?: string;
}

interface CalleeOptions extends CallOpts {
  signal: InSignalMessage;
}

export type CallOptions = CallerOptions | CalleeOptions;

const isCallerOptions = (opts: CallOptions): opts is CallerOptions =>
  (opts as CallerOptions).target !== undefined;

export type CallEvents = {
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

interface ICall {
  get session(): string;
  get metadata(): string | undefined;
  get initiator(): boolean;
  get ready(): boolean;

  answer(): void;
  hangup(): void;

  send(data: string): void;

  addStream(stream: MediaStream, metadata?: string): void;
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;

  removeStream(stream: MediaStream): void;
  removeTrack(track: MediaStreamTrack): void;
}

export class Call extends EventEmitter<CallEvents> implements ICall {
  static readonly SESSION_PREFIX = "call:";

  #logger: Logger;

  #signaling: Signaling;

  #session: string;
  #target: string;
  #initiator: boolean;
  #metadata?: string;

  #peer?: Peer;
  #queue: Signal[] = [];

  #streamMetadata: Map<string, string> = new Map();

  constructor(options: CallOptions) {
    super();

    this.#logger = new Logger("[call]", options.debug ?? LogLevel.Errors);
    this.#logger.debug("new Call:", options);

    if (isCallerOptions(options)) {
      this.#session =
        options.session ?? `${Call.SESSION_PREFIX}${randomToken()}`;
      this.#target = options.target;
      this.#initiator = true;
    } else {
      this.#session = options.signal.session;
      this.#target = options.signal.source;
      this.#initiator = false;
      this.#queue.push(options.signal.signal);
    }

    this.#metadata = options.metadata;
    this.#signaling = options.signaling;
    this.#signaling.on("signal", this.#handleSignal);

    if (this.#initiator) {
      this.#startCall(true);
    }
  }

  get session() {
    return this.#session;
  }

  get metadata() {
    return this.#metadata;
  }

  get initiator() {
    return this.#initiator;
  }

  get ready() {
    return this.#peer?.ready ?? false;
  }

  get target() {
    return this.#target;
  }

  hangup = async () => {
    this.#logger.debug("hangup");
    this.#peer?.destroy();
    this.removeAllListeners();
  };

  answer = () => {
    this.#logger.debug("answer");
    if (this.initiator) {
      throw new Error("Only non-initiators can answer calls");
    }
    this.#startCall();
  };

  send = async (data: string) => {
    this.#logger.debug("send:", data);
    this.#peer?.send(data);
  };

  addStream = async (stream: MediaStream, metadata?: string) => {
    this.#logger.debug("addStream:", stream.id, metadata);
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
    this.#logger.debug("removeStream:", stream.id);
    this.#peer?.removeStream(stream);
  };

  addTrack = async (track: MediaStreamTrack, stream: MediaStream) => {
    this.#logger.debug("addTrack:", track.id, stream.id);
    this.#peer?.addTrack(track, stream);
  };

  removeTrack = async (track: MediaStreamTrack) => {
    this.#logger.debug("removeTrack:", track.id);
    this.#peer?.removeTrack(track);
  };

  #handleSignal = (msg: InSignalMessage) => {
    if (msg.session !== this.#session) {
      return;
    }
    this.#logger.debug("signal:", msg);
    if (this.#peer) {
      this.#peer.signal(msg.signal);
    } else {
      this.#queue.push(msg.signal);
    }
  };

  #startCall = (initiator = false) => {
    const peer = new Peer({
      debug: this.#logger.logLevel,
      initiator,
    });
    this.#peer = peer;

    while (this.#queue.length > 0) {
      const msg = this.#queue.shift();
      if (msg) peer.signal(msg);
    }

    peer.on("signal", (signal) => {
      const msg: OutSignalMessage = {
        target: this.#target,
        session: this.#session,
        metadata: this.metadata,
        signal,
      };
      this.#signaling.signal(msg);
    });

    peer.on("connect", () => {
      this.#logger.debug("open:", this.session);
      this.emit("open");
    });

    peer.on("data", (data) => {
      this.#logger.debug("data:", { session: this.session, data });

      if (typeof data !== "string") {
        this.#logger.warn("received non-string data:", {
          session: this.session,
          data,
        });
        return;
      }

      try {
        const articoData = JSON.parse(data) as ArticoData;
        if (articoData.type === "[artico]") {
          const { cmd, payload } = articoData.data;
          switch (cmd) {
            case "stream-meta":
              this.#logger.debug("adding stream metadata:", {
                session: this.session,
                streamId: payload.streamId,
                metadata: payload.metadata,
              });
              if (payload.metadata) {
                this.#streamMetadata.set(payload.streamId, payload.metadata);
              }
              break;
            default:
              this.#logger.warn("unknown artico command:", {
                session: this.session,
                cmd,
              });
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
      this.#logger.debug("stream:", {
        session: this.session,
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
      this.#logger.debug("track:", {
        session: this.session,
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
      this.#logger.log("close:", this.session);
      this.emit("close");
    });

    peer.on("error", (err) => {
      this.#logger.warn("error:", { session: this.session, error: err });
      this.emit("error", err);
    });
  };
}
