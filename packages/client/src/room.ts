import logger, { LogLevel } from "@rtco/logger";
import { EventEmitter } from "eventemitter3";
import { Signaling } from "./signaling";

export type RoomEvents = {
  join: (peerId: string) => void;
  leave: (peerId: string) => void;
  stream: (stream: MediaStream, peerId: string, metadata?: object) => void;
};

export type RoomOptions = {
  debug: LogLevel;
};

interface IRoom {
  join(): void;
  leave(): void;
}

export class Room extends EventEmitter<RoomEvents> implements IRoom {
  #id: string;
  #signaling: Signaling;
  constructor(
    signaling: Signaling,
    roomId: string,
    options?: Partial<RoomOptions>,
  ) {
    logger.debug("Room options:", options);
    super();
    this.#id = roomId;
    this.#signaling = signaling;
    this.join();
  }

  join() {
    logger.debug("Joining room:", this.#id);
    this.#signaling.join(this.#id);
  }

  leave() {
    logger.debug("Leaving room:", this.#id);
    this.#signaling.leave(this.#id);
  }
}
