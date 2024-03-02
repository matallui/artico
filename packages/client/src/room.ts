import logger, { LogLevel } from "@rtco/logger";
import { EventEmitter } from "eventemitter3";
import { InSignalMessage, Signaling } from "~/signaling";
import { Call } from "~/call";
import { randomToken } from "~/util";

export type RoomEvents = {
  close: () => void;

  join: (peerId: string, metadata?: string) => void;
  leave: (peerId: string) => void;

  stream: (stream: MediaStream, peerId: string, metadata?: string) => void;
  removestream: (stream: MediaStream, peerId: string) => void;

  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    peerId: string,
    metadata?: string,
  ) => void;
  removetrack: (
    track: MediaStreamTrack,
    stream: MediaStream,
    peerId: string,
  ) => void;

  message: (data: string, peerId: string) => void;
};

export type RoomOptions = {
  signaling: Signaling;
  roomId: string;
  debug?: LogLevel;
  metadata?: string;
};

interface IRoom {
  get id(): string;
  get session(): string;
  get peers(): string[];
  leave(): void;
  send(msg: string, target?: string | string[]): void;
  addStream(
    stream: MediaStream,
    target?: string | string[],
    metadata?: string,
  ): void;
  removeStream(stream: MediaStream, target?: string | string[]): void;
  addTrack(
    track: MediaStreamTrack,
    stream: MediaStream,
    target?: string | string[],
  ): void;
  removeTrack(track: MediaStreamTrack, target?: string | string[]): void;
}

export class Room extends EventEmitter<RoomEvents> implements IRoom {
  static readonly SESSION_PREFIX = "room:";

  #id: string;
  #session: string;
  #debug: LogLevel;
  #signaling: Signaling;
  #calls: Map<string, Call> = new Map();

  constructor(options: RoomOptions) {
    super();

    this.#debug = options.debug ?? LogLevel.Errors;
    logger.debug("new Room:", options);

    this.#id = options.roomId;
    this.#session = Room.SESSION_PREFIX + this.#id;

    this.#signaling = options.signaling;
    this.#setupSignalingListeners();
    this.#signaling.join(this.#id, options.metadata);
  }

  get id() {
    return this.#id;
  }

  get session() {
    return this.#session;
  }

  get peers() {
    return Array.from(this.#calls.keys());
  }

  leave() {
    logger.debug("leaving room:", this.#id);
    this.#close();
  }

  send(msg: string, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((peer, peerId) => {
      if (!targets || targets.includes(peerId)) {
        peer.send(msg);
      }
    });
  }

  addStream(stream: MediaStream, target?: string | string[] | null) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((peer, peerId) => {
      if (!targets || targets.includes(peerId)) {
        peer.addStream(stream);
      }
    });
  }

  removeStream(stream: MediaStream, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((peer, peerId) => {
      if (!targets || targets.includes(peerId)) {
        peer.removeStream(stream);
      }
    });
  }

  addTrack(
    track: MediaStreamTrack,
    stream: MediaStream,
    target?: string | string[],
  ) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((peer, peerId) => {
      if (!targets || targets.includes(peerId)) {
        peer.addTrack(track, stream);
      }
    });
  }

  removeTrack(track: MediaStreamTrack, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((peer, peerId) => {
      if (!targets || targets.includes(peerId)) {
        peer.removeTrack(track);
      }
    });
  }

  #close = () => {
    this.#removeSignalingListeners();
    this.#calls.forEach((call) => {
      this.#removeCallListeners(call);
      call.hangup();
    });
    this.emit("close");
    this.removeAllListeners();
  };

  #setupSignalingListeners() {
    this.#signaling.on("disconnect", this.#close);
    this.#signaling.on("signal", this.#onSignal);
    this.#signaling.on("join", this.#onJoin);
  }

  #removeSignalingListeners() {
    this.#signaling.off("disconnect", this.#close);
    this.#signaling.off("signal", this.#onSignal);
    this.#signaling.off("join", this.#onJoin);
  }

  // Signaling events

  #onSignal = (msg: InSignalMessage) => {
    if (!msg.session.startsWith(this.#session)) {
      return;
    }
    let found = false;
    this.#calls.forEach((call) => {
      if (call.session === msg.session) {
        found = true;
      }
    });
    if (!found) {
      const call = new Call({
        debug: this.#debug,
        signaling: this.#signaling,
        signal: msg,
      });
      this.#setupCallListeners(call);
    }
  };

  #onJoin = (roomId: string, peerId: string, metadata?: string) => {
    if (roomId !== this.#id) {
      return;
    }
    logger.debug("onJoin:", roomId, peerId, metadata);

    const call = new Call({
      debug: this.#debug,
      signaling: this.#signaling,
      target: peerId,
      metadata,
      session: `${this.#session}:call:${randomToken()}`,
    });
    this.#setupCallListeners(call);
  };

  // Call events

  #setupCallListeners = (call: Call) => {
    call.on("open", this.#handleCallOpen.bind(this, call));
    call.on("close", this.#handleCallClose.bind(this, call));
    call.on("stream", this.#handleCallStream.bind(this, call));
    call.on("removestream", this.#handleCallRemoveStream.bind(this, call));
    call.on("track", this.#handleCallTrack.bind(this, call));
    call.on("removetrack", this.#handleCallRemoveTrack.bind(this, call));
  };

  #removeCallListeners = (call: Call) => {
    call.off("open", this.#handleCallOpen.bind(this, call));
    call.off("close", this.#handleCallClose.bind(this, call));
    call.off("stream", this.#handleCallStream.bind(this, call));
    call.off("removestream", this.#handleCallRemoveStream.bind(this, call));
    call.off("track", this.#handleCallTrack.bind(this, call));
    call.off("removetrack", this.#handleCallRemoveTrack.bind(this, call));
  };

  #handleCallOpen = (call: Call) => {
    this.#calls.set(call.target, call);
    this.emit("join", call.target, call.metadata);
  };

  #handleCallClose = (call: Call) => {
    this.#removeCallListeners(call);
    this.#calls.delete(call.target);
    this.emit("leave", call.target);
  };

  #handleCallStream = (call: Call, stream: MediaStream, metadata?: string) => {
    this.emit("stream", stream, call.target, metadata);
  };

  #handleCallRemoveStream = (call: Call, stream: MediaStream) => {
    this.emit("removestream", stream, call.target);
  };

  #handleCallTrack = (
    call: Call,
    track: MediaStreamTrack,
    stream: MediaStream,
    metadata?: string,
  ) => {
    this.emit("track", track, stream, call.target, metadata);
  };

  #handleCallRemoveTrack = (
    call: Call,
    track: MediaStreamTrack,
    stream: MediaStream,
  ) => {
    this.emit("removetrack", track, stream, call.target);
  };
}
