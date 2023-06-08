import { Artico } from "./artico";
import { randomToken } from "./util";
import EventEmitter from "eventemitter3";
import SimplePeer, { type SimplePeerData } from "simple-peer";

export type ConnectionOptions = SimplePeer.Options & {
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
  private readonly _metadata: object;

  private readonly _peer: SimplePeer.Instance;

  private _open = false;

  private readonly _provider: Artico;

  private _localStreams: MediaStream[] = [];
  // private _remoteStreams: MediaStream[] = [];

  readonly medatada: unknown;

  constructor(provider: Artico, peerId: string, options?: ConnectionOptions) {
    super();

    options = {
      initiator: true,
      ...options,
    };

    const { metadata = {} } = options;

    this._id = Connection.ID_PREFIX + randomToken();
    this._provider = provider;
    this._metadata = metadata || {};

    const peer = new SimplePeer(options);
    this._peer = peer;

    peer.on("signal", (signal) => {
      this.provider.socket.emit("signal", {
        target: peerId,
        session: this.id,
        metadata: this.metadata,
        signal,
      });
    });

    peer.on("connect", () => {
      this._open = true;
    });

    peer.on("data", (data) => {
      this.emit("data", data);
    });

    peer.on("stream", (stream) => {
      this.emit("stream", stream);
    });

    peer.on("track", (track, stream) => {
      this.emit("track", track, stream);
    });

    peer.on("close", () => {
      this.emit("close");
    });

    peer.on("error", (err) => {
      this.emit("error", err);
    });
  }

  get id() {
    return this._id;
  }

  get metadata() {
    return this._metadata;
  }

  get open() {
    return this._open;
  }

  get provider() {
    return this._provider;
  }

  get peer() {
    return this._peer;
  }

  public send = async (data: SimplePeerData) => {
    this.peer.send(data);
    console.log("Connection send:", data);
  };

  public addStream = async (stream: MediaStream) => {
    this.peer.addStream(stream);
    this._localStreams.push(stream);
  };

  public removeStream = async (stream: MediaStream) => {
    this.peer.removeStream(stream);
    this._localStreams = this._localStreams.filter((s) => s !== stream);
  };

  public addTrack = async (track: MediaStreamTrack, stream: MediaStream) => {
    this.peer.addTrack(track, stream);
  };

  public removeTrack = async (track: MediaStreamTrack, stream: MediaStream) => {
    this.peer.removeTrack(track, stream);
  };

  public replaceTrack = async (
    oldTrack: MediaStreamTrack,
    newTrack: MediaStreamTrack,
    stream: MediaStream
  ) => {
    this.peer.replaceTrack(oldTrack, newTrack, stream);
  };

  public close = async () => {
    this.peer.destroy();
  };
}
