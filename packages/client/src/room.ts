import logger, { LogLevel } from "@rtco/logger";
import { EventEmitter } from "eventemitter3";
import { InSignalMessage, Signaling } from "~/signaling";
import { Call } from "~/call";

export type RoomEvents = {
  close: () => void;

  join: (peerId: string, metadata?: string) => void;
  leave: (peerId: string) => void;

  stream: (stream: MediaStream, peerId: string, metadata?: string) => void;
  removestream: (
    stream: MediaStream,
    peerId: string,
    metadata?: string,
  ) => void;

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
    metadata?: string,
  ) => void;

  message: (data: string, peerId: string) => void;
};

export type RoomOptions = {
  debug: LogLevel;
  metadata?: string;
};

interface IRoom {
  get id(): string;
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
  #id: string;
  #options: RoomOptions;
  #signaling: Signaling;
  #calls: Map<string, Call> = new Map();

  constructor(
    signaling: Signaling,
    roomId: string,
    options?: Partial<RoomOptions>,
  ) {
    logger.debug("new Room:", options);
    super();
    this.#id = roomId;
    this.#options = {
      debug: LogLevel.Errors,
      ...options,
    };
    this.#signaling = signaling;
    this.#signaling.join(this.#id, this.#options.metadata);
    this.#signaling.on("signal", this.#onSignal);
    this.#signaling.on("join", this.#onJoin);
    this.#signaling.on("leave", this.#onLeave);
  }

  get id() {
    return this.#id;
  }

  get peers() {
    return [this.#signaling.id, ...Array.from(this.#calls.keys())];
  }

  leave() {
    logger.debug("Leaving room:", this.#id);
    this.#signaling.leave(this.#id);
    this.emit("close");
    this.removeAllListeners();
  }

  send(msg: string, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        conn.send(msg);
      }
    });
  }

  addStream(
    stream: MediaStream,
    target?: string | string[] | null,
    metadata?: string,
  ) {
    console.log("[room] addStream", { stream: stream.id, target, metadata });
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        console.log("[room] addStream", stream.id, metadata);
        conn.addStream(stream, metadata);
      }
    });
  }

  removeStream(stream: MediaStream, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        conn.removeStream(stream);
      }
    });
  }

  addTrack(
    track: MediaStreamTrack,
    stream: MediaStream,
    target?: string | string[],
  ) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        conn.addTrack(track, stream);
      }
    });
  }

  removeTrack(track: MediaStreamTrack, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#calls.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        conn.removeTrack(track);
      }
    });
  }

  #onSignal = (msg: InSignalMessage) => {
    if (msg.session !== this.#id) {
      return;
    }

    // if (msg.type === "call" && msg.source !== undefined) {
    //   const source = msg.source;
    //   const conn = new Call(this.#signaling, source, {
    //     debug: this.#options.debug,
    //     signal: msg.signal,
    //     conn: msg.conn,
    //     room: msg.room,
    //     metadata: msg.metadata,
    //   });
    //   conn.answer();
    //   conn.on("open", () => {
    //     this.#calls.set(source, conn);
    //     this.emit("join", source);
    //   });
    //   conn.on("close", () => {
    //     this.#calls.delete(source);
    //   });
    //   conn.on("stream", (stream, metadata) => {
    //     this.emit("stream", stream, source, metadata);
    //   });
    //   conn.on("removestream", (stream, metadata) => {
    //     this.emit("removestream", stream, source, metadata);
    //   });
    //   conn.on("track", (track, stream, metadata) => {
    //     this.emit("track", track, stream, source, metadata);
    //   });
    //   conn.on("removetrack", (track, stream, metadata) => {
    //     this.emit("removetrack", track, stream, source, metadata);
    //   });
    //   conn.on("data", (data) => {
    //     this.emit("message", data, source);
    //   });
    // }
  };

  #onJoin = (roomId: string, peerId: string, metadata?: string) => {
    if (roomId !== this.#id) {
      return;
    }
    logger.debug("onJoin:", roomId, peerId, metadata);

    const call = new Call({
      debug: this.#options.debug,
      signaling: this.#signaling,
      target: peerId,
      metadata,
    });

    call.on("open", () => {
      this.#calls.set(peerId, call);
      this.emit("join", peerId);
    });
    call.on("close", () => {
      this.#calls.delete(peerId);
      this.emit("leave", peerId);
    });
    call.on("stream", (stream, metadata) => {
      this.emit("stream", stream, peerId, metadata);
    });
    call.on("removestream", (stream, metadata) => {
      this.emit("removestream", stream, peerId, metadata);
    });
    call.on("track", (track, stream, metadata) => {
      this.emit("track", track, stream, peerId, metadata);
    });
    call.on("removetrack", (track, stream, metadata) => {
      this.emit("removetrack", track, stream, peerId, metadata);
    });
    call.on("data", (data) => {
      this.emit("message", data, peerId);
    });
  };

  #onLeave = (roomId: string, peerId: string) => {
    if (roomId !== this.#id) {
      return;
    }
    logger.debug("onLeave:", roomId, peerId);
    this.#calls.get(peerId)?.hangup();
  };
}
