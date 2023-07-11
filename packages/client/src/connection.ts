import { Artico } from "./artico";
import logger, { LogLevel } from "./logger";
import { randomToken } from "./util";
import Peer, { PeerOptions, SignalData } from "@rtco/peer";
import EventEmitter from "eventemitter3";

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

export type ConnectionOptions = PeerOptions & {
  session?: string;
  metadata?: object;
};

export type ConnectionEvents = {
  close: () => void;
  error: (err: Error) => void;

  data: (data: unknown) => void;

  stream: (stream: MediaStream, metadata?: object) => void;
  removestream: (stream: MediaStream, metadata?: object) => void;

  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: object
  ) => void;
  removetrack: (
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: object
  ) => void;
};

export class Connection extends EventEmitter<ConnectionEvents> {
  private static readonly ID_PREFIX = "session_";

  private readonly _provider: Artico;

  private readonly _id: string;
  private readonly _target: string;
  private readonly _options: ConnectionOptions;

  private _peer?: Peer;
  private _queue: SignalData[] = [];

  private _streamMetadata: Map<string, object> = new Map();

  private _open = false;

  constructor(provider: Artico, target: string, options?: ConnectionOptions) {
    super();

    options = {
      debug: LogLevel.Errors,
      initiator: false,
      ...options,
    };
    options.metadata = options.metadata || {};
    options.session = options.session || Connection.ID_PREFIX + randomToken();

    this._id = options.session;
    this._options = options;
    this._provider = provider;
    this._target = target;

    if (options.initiator) {
      this._startConnection();
    }
  }

  private _startConnection = () => {
    let firstOfferSent = false;

    const peer = new Peer(this._options);
    this._peer = peer;

    while (this._queue.length > 0) {
      const msg = this._queue.pop();
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
        this.provider.socket.emit("offer", {
          target: this._target,
          session: this.id,
          metadata: this.metadata,
          signal,
        });
      } else {
        this.provider.socket.emit("signal", {
          target: this._target,
          session: this.id,
          metadata: this.metadata,
          signal,
        });
      }
    });

    peer.on("connect", () => {
      logger.log("connection open:", this.id);
      this._open = true;
    });

    peer.on("data", (data) => {
      logger.debug("connection data:", { session: this.id, data });

      // check if data is of type ArticoData
      // @ts-ignore
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
            this._streamMetadata.set(payload.streamId, payload.metadata);
            break;
          default:
            logger.warn("unknown artico command:", { session: this.id, cmd });
        }
      } else {
        this.emit("data", data);
      }
    });

    peer.on("stream", (stream) => {
      const metadata = this._streamMetadata.get(stream.id);
      logger.debug("connection stream:", {
        session: this.id,
        stream,
        metadata,
      });
      this.emit("stream", stream, metadata);
    });

    peer.on("removestream", (stream) => {
      const metadata = this._streamMetadata.get(stream.id);
      this.emit("removestream", stream, metadata);
      this._streamMetadata.delete(stream.id);
    });

    peer.on("track", (track, stream) => {
      const metadata = this._streamMetadata.get(stream.id);
      logger.debug("connection track:", {
        session: this.id,
        track,
        stream,
        metadata,
      });
      this.emit("track", track, stream, metadata);
    });

    peer.on("removetrack", (track, stream) => {
      const metadata = this._streamMetadata.get(stream.id);
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

  get id() {
    return this._id;
  }

  get metadata() {
    return this._options.metadata;
  }

  get initiator() {
    return this._options.initiator;
  }

  get open() {
    return this._open;
  }

  get provider() {
    return this._provider;
  }

  get target() {
    return this._target;
  }

  get peer() {
    return this._peer;
  }

  /**
   * @internal
   */
  signal = (signal: SignalData) => {
    if (this.peer) {
      this.peer.signal(signal);
    } else {
      this._queue.push(signal);
    }
  };

  /**
   * External API
   */

  public answer = () => {
    if (this.initiator) {
      throw new Error("Only non-initiators can answer calls");
    }

    this._startConnection();
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
}
