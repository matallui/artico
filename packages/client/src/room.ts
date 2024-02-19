import logger, { LogLevel } from "@rtco/logger";
import type { WRTC } from "@rtco/peer";
import { EventEmitter } from "eventemitter3";
import { SignalMessage, Signaling } from "~/signaling";
import { Connection } from "~/connection";

export type RoomEvents = {
  join: (peerId: string) => void;
  leave: (peerId: string) => void;
  close: () => void;
  stream: (stream: MediaStream, peerId: string, metadata?: string) => void;
  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    peerId: string,
    metadata?: string,
  ) => void;
};

export type RoomOptions = {
  debug: LogLevel;
  wrtc?: WRTC;
};

interface IRoom {
  get id(): string;
  get peers(): string[];
  leave(): void;
  send(data: string, target: string | string[]): void;
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
  #connections: Map<string, Connection> = new Map();

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
    this.#signaling.join(this.#id);
    this.#signaling.on("signal", this.#onSignal);
    this.#signaling.on("join", this.#onJoin);
    this.#signaling.on("leave", this.#onLeave);
  }

  get id() {
    return this.#id;
  }

  get peers() {
    return Array.from(this.#connections.keys());
  }

  leave() {
    logger.debug("Leaving room:", this.#id);
    this.#signaling.leave(this.#id);
    this.emit("close");
  }

  send(data: string, target: string | string[]) {
    const targets = Array.isArray(target) ? target : [target];
    this.#connections.forEach((conn, peerId) => {
      if (targets.includes(peerId)) {
        conn.send(data);
      }
    });
  }

  addStream(
    stream: MediaStream,
    target?: string | string[],
    metadata?: string,
  ) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#connections.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        conn.addStream(stream, metadata);
      }
    });
  }

  removeStream(stream: MediaStream, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#connections.forEach((conn, peerId) => {
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
    this.#connections.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        conn.addTrack(track, stream);
      }
    });
  }

  removeTrack(track: MediaStreamTrack, target?: string | string[]) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    this.#connections.forEach((conn, peerId) => {
      if (!targets || targets.includes(peerId)) {
        conn.removeTrack(track);
      }
    });
  }

  #onSignal = (msg: SignalMessage) => {
    if (msg.room !== this.#id) {
      return;
    }

    if (msg.type === "call" && !!msg.source) {
      const conn = new Connection(this.#signaling, msg.source!, {
        debug: this.#options.debug,
        wrtc: this.#options.wrtc,
        signal: msg.signal,
        conn: msg.conn,
        room: msg.room,
        metadata: msg.metadata,
      });
      this.#connections.set(conn.id, conn);
      conn.answer();
    }
  };

  #onJoin = (roomId: string, peerId: string) => {
    if (roomId !== this.#id) {
      return;
    }
    logger.debug("onJoin:", roomId, peerId);

    const conn = new Connection(this.#signaling, peerId, {
      debug: this.#options.debug,
      room: roomId,
      wrtc: this.#options.wrtc,
    });

    conn.on("open", () => {
      this.#connections.set(peerId, conn);
      this.emit("join", peerId);
    });

    conn.on("close", () => {
      this.#connections.delete(peerId);
      this.emit("leave", peerId);
    });
  };

  #onLeave = (roomId: string, peerId: string) => {
    if (roomId !== this.#id) {
      return;
    }
    logger.debug("onLeave:", roomId, peerId);
    this.#connections.get(peerId)?.close();
  };
}
