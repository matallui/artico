import { EventEmitter } from "eventemitter3";

import { Logger, LogLevel } from "@rtco/logger";

import type { InSignalMessage, Signaling } from "~/signaling";
import { Call } from "~/call";
import { randomToken } from "~/util";

/**
 * Runs `operation` for every call selected by `target` (or every call when no
 * target is given), isolating each call's failure so one throwing call never
 * prevents the remaining calls from being attempted. The first captured value
 * is rethrown as-is after all selected calls have been attempted — including
 * falsy non-Error values — preserving the original thrown value and the
 * caller's synchronous failure semantics.
 */
const runEachCall = <T>(
  calls: ReadonlyMap<string, T>,
  operation: (call: T, peerId: string) => void,
  target?: string | string[] | null,
) => {
  const targets = target ? (Array.isArray(target) ? target : [target]) : null;
  let firstError: { value: unknown } | undefined;

  calls.forEach((call, peerId) => {
    if (targets && !targets.includes(peerId)) {
      return;
    }
    try {
      operation(call, peerId);
    } catch (error) {
      firstError ??= { value: error };
    }
  });

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
  #calls = new Map<string, Call>();

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
    // Only calls that are ready at call time receive the message; pending or
    // closed calls are skipped with no exception, queue, or later replay.
    runEachCall(
      this.#calls,
      (call) => {
        if (!call.ready) return;
        call.send(msg);
      },
      target,
    );
  }

  addStream(
    stream: MediaStream,
    metadata?: string,
    target?: string | string[] | null,
  ) {
    // Only calls that are ready at call time run the whole Call.addStream;
    // pending calls receive no metadata and no stream, with no later replay.
    runEachCall(
      this.#calls,
      (call) => {
        if (!call.ready) return;
        call.addStream(stream, metadata);
      },
      target,
    );
  }

  removeStream(stream: MediaStream, target?: string | string[]) {
    runEachCall(this.#calls, (call) => call.removeStream(stream), target);
  }

  addTrack(
    track: MediaStreamTrack,
    stream: MediaStream,
    target?: string | string[],
  ) {
    runEachCall(this.#calls, (call) => call.addTrack(track, stream), target);
  }

  removeTrack(track: MediaStreamTrack, target?: string | string[]) {
    runEachCall(this.#calls, (call) => call.removeTrack(track), target);
  }

  #close = () => {
    this.#removeSignalingListeners();
    // Listener removal is a local unsubscribe and cannot fail; only hangup may
    // fail, so every call is still attempted and the first failure is
    // rethrown as-is after all hangups.
    try {
      runEachCall(this.#calls, (call) => {
        this.#removeCallListeners(call);
        call.hangup();
      });
    } finally {
      this.emit("close");
      this.removeAllListeners();
    }
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!found) {
      // callee
      const call = new Call({
        debug: this.#logger.logLevel,
        signaling: this.#signaling,
        rtcConfig: this.#rtcConfig,
        signal: msg,
      });
      this.#calls.set(call.target, call);
      call.answer();
      this.#setupCallListeners(call);
    }
  };

  #onJoin = (roomId: string, peerId: string, metadata?: string) => {
    if (roomId !== this.#id) {
      return;
    }
    this.#logger.debug("onJoin:", roomId, peerId, metadata);

    // caller
    const call = new Call({
      debug: this.#logger.logLevel,
      signaling: this.#signaling,
      rtcConfig: this.#rtcConfig,
      session: `${this.#session}:${Call.SESSION_PREFIX}${randomToken()}`,
      target: peerId,
      metadata,
    });
    this.#calls.set(call.target, call);
    this.#setupCallListeners(call);
  };

  // Call events

  #setupCallListeners = (call: Call) => {
    call.on("open", this.#handleCallOpen.bind(this, call));
    call.on("close", this.#handleCallClose.bind(this, call));
    call.on("data", this.#handleCallData.bind(this, call));
    call.on("stream", this.#handleCallStream.bind(this, call));
    call.on("removestream", this.#handleCallRemoveStream.bind(this, call));
    call.on("track", this.#handleCallTrack.bind(this, call));
    call.on("removetrack", this.#handleCallRemoveTrack.bind(this, call));
  };

  #removeCallListeners = (call: Call) => {
    // `off` with a fresh `.bind(...)` can never match the registered listener;
    // detach every Call listener at once instead.
    call.removeAllListeners();
  };

  #handleCallOpen = (call: Call) => {
    this.emit("join", call.target, call.metadata);
  };

  #handleCallClose = (call: Call) => {
    this.#removeCallListeners(call);
    this.#calls.delete(call.target);
    this.emit("leave", call.target);
  };

  #handleCallData = (call: Call, data: string) => {
    this.emit("message", data, call.target);
  };

  #handleCallStream = (call: Call, stream: MediaStream, metadata?: string) => {
    this.emit("stream", stream, call.target, metadata);
  };

  #handleCallRemoveStream = (
    call: Call,
    stream: MediaStream,
    metadata?: string,
  ) => {
    this.emit("removestream", stream, call.target, metadata);
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
    metadata?: string,
  ) => {
    this.emit("removetrack", track, stream, call.target, metadata);
  };
}
