/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-non-null-assertion, @typescript-eslint/only-throw-error */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "eventemitter3";

import type { Signal } from "@rtco/peer";

import type {
  InSignalMessage,
  SignalingEvents,
  SignalingState,
} from "~/signaling";

type CallOptions =
  | { target: string; session?: string; metadata?: string }
  | { signal: InSignalMessage; metadata?: string };

const calls: FakeCall[] = [];

class FakeCall extends EventEmitter {
  static readonly SESSION_PREFIX = "call:";

  session: string;
  target: string;
  metadata?: string;
  ready = false;

  answer = mock(() => {});
  hangup = mock(() => {});
  send = mock((_data: string) => {});
  addStream = mock((_stream: MediaStream, _metadata?: string) => {});
  removeStream = mock((_stream: MediaStream) => {});
  addTrack = mock((_track: MediaStreamTrack, _stream: MediaStream) => {});
  removeTrack = mock((_track: MediaStreamTrack) => {});

  constructor(options: CallOptions) {
    super();
    if ("signal" in options) {
      this.session = options.signal.session;
      this.target = options.signal.source;
      this.metadata = options.signal.metadata;
    } else {
      this.session = options.session ?? "call:generated";
      this.target = options.target;
      this.metadata = options.metadata;
    }
    calls.push(this);
  }
}

void mock.module("~/call", () => ({ Call: FakeCall }));

const { Room } = await import("~/room");

class FakeSignaling extends EventEmitter<SignalingEvents> {
  id = "local";
  state: SignalingState = "ready";
  join = mock((_roomId: string, _metadata?: string) => {});
  connect = mock(() => {});
  disconnect = mock(() => {});
  signal = mock(() => {});
}

const signal = (source: string, session = `room:test:call:${source}`) =>
  ({
    source,
    target: "local",
    session,
    signal: { type: "candidate", data: {} } as Signal,
  }) satisfies InSignalMessage;

const setup = () => {
  const signaling = new FakeSignaling();
  const room = new Room({ signaling, roomId: "test" });
  return { room, signaling };
};

beforeEach(() => {
  calls.length = 0;
});

describe("Room call mesh", () => {
  test("owns one pending Call per peer and activates incoming Calls after ownership", () => {
    const { room, signaling } = setup();

    signaling.emit("signal", signal("peer"));
    const first = calls[0]!;
    expect(room.peers).toEqual(["peer"]);
    expect(first.answer).toHaveBeenCalledTimes(1);

    signaling.emit("signal", signal("peer", "room:test:call:duplicate"));
    signaling.emit("join", "test", "peer");
    expect(calls).toHaveLength(1);
  });

  test("translates owned Call events and emits leave only after join", () => {
    const { room, signaling } = setup();
    const events: unknown[] = [];
    room.on("join", (...args) => events.push(["join", ...args]));
    room.on("message", (...args) => events.push(["message", ...args]));
    room.on("leave", (...args) => events.push(["leave", ...args]));

    signaling.emit("join", "test", "peer", "person");
    const call = calls[0]!;
    call.emit("data", "early");
    call.emit("close");
    expect(events).toEqual([["message", "early", "peer"]]);

    signaling.emit("join", "test", "peer", "person");
    const connected = calls[1]!;
    connected.emit("open");
    connected.emit("data", "hello");
    connected.emit("close");
    connected.emit("close");

    expect(events).toEqual([
      ["message", "early", "peer"],
      ["join", "peer", "person"],
      ["message", "hello", "peer"],
      ["leave", "peer"],
    ]);
    expect(room.peers).toEqual([]);
  });

  test("removes only Room-owned listeners", () => {
    const { signaling } = setup();
    signaling.emit("join", "test", "peer");
    const call = calls[0]!;
    const external = mock(() => {});
    call.on("data", external);

    call.emit("close");
    call.emit("data", "still subscribed");

    expect(external).toHaveBeenCalledWith("still subscribed");
  });

  test("snapshots targets, skips unready sends, attempts all, and rethrows first value", () => {
    const { room, signaling } = setup();
    signaling.emit("join", "test", "one");
    signaling.emit("join", "test", "two");
    signaling.emit("join", "test", "three");
    const [one, two, three] = calls;
    one!.ready = true;
    two!.ready = true;
    three!.ready = false;
    one!.send = mock(() => {
      one!.emit("close");
      throw 0;
    });
    two!.send = mock(() => {
      throw new Error("second");
    });

    let thrown: unknown;
    try {
      room.send("hello", ["one", "two", "three", "missing"]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(0);
    expect(one!.send).toHaveBeenCalledTimes(1);
    expect(two!.send).toHaveBeenCalledTimes(1);
    expect(three!.send).not.toHaveBeenCalled();
  });

  test("fans media operations out only to selected Calls", () => {
    const { room, signaling } = setup();
    signaling.emit("join", "test", "one");
    signaling.emit("join", "test", "two");
    const [one, two] = calls;
    one!.ready = true;
    two!.ready = false;
    const stream = {} as MediaStream;
    const track = {} as MediaStreamTrack;

    room.addStream(stream, "camera");
    room.removeStream(stream, "two");
    room.addTrack(track, stream, ["one"]);
    room.removeTrack(track, "missing");

    expect(one!.addStream).toHaveBeenCalledWith(stream, "camera");
    expect(two!.addStream).not.toHaveBeenCalled();
    expect(two!.removeStream).toHaveBeenCalledWith(stream);
    expect(one!.addTrack).toHaveBeenCalledWith(track, stream);
    expect(one!.removeTrack).not.toHaveBeenCalled();
  });

  test("shuts down once, hangs up every Call, emits close once, and preserves the first failure", () => {
    const { room, signaling } = setup();
    signaling.emit("join", "test", "one");
    signaling.emit("join", "test", "two");
    const [one, two] = calls;
    const closes = mock(() => {});
    const external = mock(() => {});
    room.on("close", closes);
    one!.on("data", external);
    one!.hangup = mock(() => {
      one!.emit("close");
      throw "first";
    });
    two!.hangup = mock(() => {
      throw new Error("second");
    });

    expect(() => room.leave()).toThrow("first");
    expect(one!.hangup).toHaveBeenCalledTimes(1);
    expect(two!.hangup).toHaveBeenCalledTimes(1);
    expect(closes).toHaveBeenCalledTimes(1);
    expect(room.peers).toEqual([]);

    room.leave();
    signaling.emit("disconnect");
    expect(closes).toHaveBeenCalledTimes(1);
    expect(one!.hangup).toHaveBeenCalledTimes(1);
    one!.emit("data", "external survives");
    expect(external).toHaveBeenCalledWith("external survives");
  });
});
