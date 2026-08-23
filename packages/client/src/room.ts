import { EventEmitter } from "eventemitter3";

import { Logger, LogLevel } from "@rtco/logger";

import type { InSignalMessage, Signaling } from "~/signaling";
import { Call } from "~/call";
import { randomToken } from "~/util";

interface RoomCallListeners {
  open: () => void;
  close: () => void;
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
}

interface RoomCall {
  call: Call;
  connected: boolean;
  removing: boolean;
  listeners: RoomCallListeners;
}

const runEachCall = (
  roomCalls: RoomCall[],
  operation: (call: Call) => void,
) => {
  let firstError: { value: unknown } | undefined;

  for (const { call } of roomCalls) {
    try {
      operation(call);
    } catch (error) {
      firstError ??= { value: error };
    }
  }

  if (firstError) {
    throw firstError.value;
  }
};

export interface RoomEvents {
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
}

export interface RoomOptions {
  signaling: Signaling;
  roomId: string;
  debug?: LogLevel;
  metadata?: string;
  /**
   * Optional RTCConfiguration for the peer connections.
   * @defaultValue { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" } ] }
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration
   */
  rtcConfig?: RTCConfiguration;
}

interface IRoom {
  get id(): string;
  get session(): string;
  get peers(): string[];
  leave(): void;
  send(msg: string, target?: string | string[]): void;
  addStream(
    stream: MediaStream,
    metadata?: string,
    target?: string | string[],
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

  #logger: Logger;
  #id: string;
  #rtcConfig?: RTCConfiguration;
  #session: string;
  #signaling: Signaling;
  #calls = new Map<string, RoomCall>();
  #closed = false;

  constructor(options: RoomOptions) {
    super();

    this.#logger = new Logger("[room]", options.debug ?? LogLevel.Errors);
    this.#logger.debug("new Room:", options);

    this.#id = options.roomId;
    this.#session = Room.SESSION_PREFIX + this.#id;
    this.#rtcConfig = options.rtcConfig;
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
    this.#logger.debug("leaving room:", this.#id);
    this.#close();
  }

  send(msg: string, target?: string | string[]) {
    runEachCall(this.#selectCalls(target), (call) => {
      if (call.ready) call.send(msg);
    });
  }

  addStream(
    stream: MediaStream,
    metadata?: string,
    target?: string | string[] | null,
  ) {
    runEachCall(this.#selectCalls(target), (call) => {
      if (call.ready) call.addStream(stream, metadata);
    });
  }

  removeStream(stream: MediaStream, target?: string | string[]) {
    runEachCall(this.#selectCalls(target), (call) => call.removeStream(stream));
  }

  addTrack(
    track: MediaStreamTrack,
    stream: MediaStream,
    target?: string | string[],
  ) {
    runEachCall(this.#selectCalls(target), (call) =>
      call.addTrack(track, stream),
    );
  }

  removeTrack(track: MediaStreamTrack, target?: string | string[]) {
    runEachCall(this.#selectCalls(target), (call) => call.removeTrack(track));
  }

  #selectCalls(target?: string | string[] | null) {
    const targets = target ? (Array.isArray(target) ? target : [target]) : null;
    return Array.from(this.#calls.values()).filter(
      ({ call }) => !targets || targets.includes(call.target),
    );
  }

  #close = () => {
    if (this.#closed) return;
    this.#closed = true;
    this.#removeSignalingListeners();

    let firstError: { value: unknown } | undefined;
    for (const roomCall of Array.from(this.#calls.values())) {
      try {
        this.#removeCall(roomCall, { hangup: true, emitLeave: false });
      } catch (error) {
        firstError ??= { value: error };
      }
    }

    this.emit("close");
    this.removeAllListeners();

    if (firstError) throw firstError.value;
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

  #onSignal = (msg: InSignalMessage) => {
    if (
      this.#closed ||
      !msg.session.startsWith(this.#session) ||
      this.#calls.has(msg.source)
    ) {
      return;
    }

    const call = new Call({
      debug: this.#logger.logLevel,
      signaling: this.#signaling,
      rtcConfig: this.#rtcConfig,
      signal: msg,
    });
    const roomCall = this.#ownCall(call);

    try {
      call.answer();
    } catch (error) {
      try {
        this.#removeCall(roomCall, { hangup: true, emitLeave: false });
      } catch {
        // Preserve the activation failure.
      }
      throw error;
    }
  };

  #onJoin = (roomId: string, peerId: string, metadata?: string) => {
    if (this.#closed || roomId !== this.#id || this.#calls.has(peerId)) return;
    this.#logger.debug("onJoin:", roomId, peerId, metadata);

    this.#ownCall(
      new Call({
        debug: this.#logger.logLevel,
        signaling: this.#signaling,
        rtcConfig: this.#rtcConfig,
        session: `${this.#session}:${Call.SESSION_PREFIX}${randomToken()}`,
        target: peerId,
        metadata,
      }),
    );
  };

  #ownCall(call: Call) {
    const roomCall = {} as RoomCall;
    const listeners: RoomCallListeners = {
      open: () => {
        if (roomCall.removing || roomCall.connected) return;
        roomCall.connected = true;
        this.emit("join", call.target, call.metadata);
      },
      close: () => this.#removeCall(roomCall, { emitLeave: true }),
      data: (data) => this.emit("message", data, call.target),
      stream: (stream, metadata) =>
        this.emit("stream", stream, call.target, metadata),
      removestream: (stream, metadata) =>
        this.emit("removestream", stream, call.target, metadata),
      track: (track, stream, metadata) =>
        this.emit("track", track, stream, call.target, metadata),
      removetrack: (track, stream, metadata) =>
        this.emit("removetrack", track, stream, call.target, metadata),
    };

    Object.assign(roomCall, {
      call,
      connected: false,
      removing: false,
      listeners,
    });
    this.#calls.set(call.target, roomCall);
    this.#addCallListeners(roomCall);
    return roomCall;
  }

  #addCallListeners({ call, listeners }: RoomCall) {
    call.on("open", listeners.open);
    call.on("close", listeners.close);
    call.on("data", listeners.data);
    call.on("stream", listeners.stream);
    call.on("removestream", listeners.removestream);
    call.on("track", listeners.track);
    call.on("removetrack", listeners.removetrack);
  }

  #removeCallListeners({ call, listeners }: RoomCall) {
    call.off("open", listeners.open);
    call.off("close", listeners.close);
    call.off("data", listeners.data);
    call.off("stream", listeners.stream);
    call.off("removestream", listeners.removestream);
    call.off("track", listeners.track);
    call.off("removetrack", listeners.removetrack);
  }

  #removeCall(
    roomCall: RoomCall,
    options: { hangup?: boolean; emitLeave: boolean },
  ) {
    if (roomCall.removing) return;
    roomCall.removing = true;

    const { call, connected } = roomCall;
    this.#calls.delete(call.target);
    this.#removeCallListeners(roomCall);

    try {
      if (options.hangup) call.hangup();
    } finally {
      if (options.emitLeave && connected) this.emit("leave", call.target);
    }
  }
}
