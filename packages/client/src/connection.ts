import { Artico } from "./artico";
import logger from "./logger";
import { randomToken } from "./util";
import EventEmitter from "eventemitter3";
import SimplePeer, { type SimplePeerData } from "simple-peer";

export type ConnectionOptions = SimplePeer.Options & {
  session?: string;
  metadata?: object;
};

export type ConnectionEvents = {
  close: () => void;
  error: (err: Error) => void;

  data: (data: unknown) => void;

  stream: (stream: MediaStream) => void;
  track: (track: MediaStreamTrack, stream: MediaStream) => void;
};

export class Connection extends EventEmitter<ConnectionEvents> {
  private static readonly ID_PREFIX = "session_";

  private readonly _id: string;
  private readonly _target: string;
  private readonly _options: ConnectionOptions;

  private _peer?: SimplePeer.Instance;
  private _queue: SimplePeer.SignalData[] = [];

  private _open = false;

  private readonly _provider: Artico;

  constructor(provider: Artico, target: string, options?: ConnectionOptions) {
    super();

    options = {
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

    const peer = new SimplePeer(this._options);
    this._peer = peer;

    while (this._queue.length > 0) {
      const msg = this._queue.pop();
      if (msg) peer.signal(msg);
    }

    peer.on("signal", (signal) => {
      if (this.initiator && signal.type === "offer" && !firstOfferSent) {
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
      this.emit("data", data);
    });

    peer.on("stream", (stream) => {
      logger.debug("connection stream:", { session: this.id, stream });
      this.emit("stream", stream);
    });

    peer.on("track", (track, stream) => {
      logger.debug("connection track:", { session: this.id, track, stream });
      this.emit("track", track, stream);
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
  signal = (signal: SimplePeer.SignalData) => {
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

  public send = async (data: SimplePeerData) => {
    this.peer?.send(data);
  };

  public addStream = async (stream: MediaStream) => {
    this.peer?.addStream(stream);
  };

  public removeStream = async (stream: MediaStream) => {
    this.peer?.removeStream(stream);
  };

  public addTrack = async (track: MediaStreamTrack, stream: MediaStream) => {
    this.peer?.addTrack(track, stream);
  };

  public removeTrack = async (track: MediaStreamTrack, stream: MediaStream) => {
    this.peer?.removeTrack(track, stream);
  };

  public replaceTrack = async (
    oldTrack: MediaStreamTrack,
    newTrack: MediaStreamTrack,
    stream: MediaStream
  ) => {
    this.peer?.replaceTrack(oldTrack, newTrack, stream);
  };

  public close = async () => {
    this.peer?.destroy();
  };
}
