import logger, { LogLevel } from "@rtco/logger";
import type { WRTC } from "@rtco/peer";
import { EventEmitter } from "eventemitter3";
import { Signaling } from "~/signaling";
import { Connection } from "~/connection";

export type RoomEvents = {
  join: (peerId: string) => void;
  leave: (peerId: string) => void;
  close: () => void;
  stream: (stream: MediaStream, peerId: string, metadata?: object) => void;
  track: (
    track: MediaStreamTrack,
    stream: MediaStream,
    peerId: string,
    metadata?: object,
  ) => void;
};

export type RoomOptions = {
  debug: LogLevel;
  wrtc?: WRTC;
};

interface IRoom {
  leave(): void;
  getOccupants(): string[];
  send(data: string, target: string | string[]): void;
  addStream(
    stream: MediaStream,
    target?: string | string[],
    metadata?: object,
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
    this.#signaling.on("join", this.#onJoin);
    this.#signaling.on("leave", this.#onLeave);
  }

  leave() {
    logger.debug("Leaving room:", this.#id);
    this.#signaling.leave(this.#id);
    this.emit("close");
  }

  getOccupants() {
    return Array.from(this.#connections.keys());
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
    metadata?: object,
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

  #onJoin = (peerId: string) => {
    const conn = new Connection(this.#signaling, peerId, {
      debug: this.#options.debug,
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

  #onLeave = (peerId: string) => {
    this.#connections.get(peerId)?.close();
  };
}
