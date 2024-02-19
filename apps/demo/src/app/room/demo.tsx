"use client";
import React from "react";
import type { Room } from "@rtco/client";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useArtico } from "./use-artico";

export function RoomDemo() {
  const { rtco, state } = useArtico();
  const [roomName, setRoomName] = React.useState<string>("");
  const [room, setRoom] = React.useState<Room>();

  const join = React.useCallback(
    (name: string) => {
      if (state !== "ready") {
        return;
      }
      if (name.length === 0) {
        return;
      }

      const r = rtco.join(name);
      setRoom(r);

      r.on("close", () => {
        setRoom(undefined);
      });
    },
    [rtco, state],
  );

  return (
    <>
      <div className="flex gap-2 max-w-sm items-center w-full">
        <Input
          disabled={state !== "ready" && !!room}
          type="text"
          placeholder="Enter room name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <Button
          disabled={state !== "ready" && !!room}
          onClick={() => join(roomName.trim())}
        >
          Join
        </Button>
      </div>
      {room && <RoomView room={room} />}
    </>
  );
}

function RoomView({ room }: { room: Room }) {
  const [peers, setPeers] = React.useState<string[]>(room.peers);
  const [camera, setCamera] = React.useState<MediaStream>();
  const [streams, setStreams] = React.useState<MediaStream[]>([]);

  React.useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        setCamera(stream);
        room.addStream(stream, undefined, "camera");
        return () => {
          room.removeStream(stream);
          stream.getTracks().forEach((track) => track.stop());
        };
      });
  }, [room]);

  React.useEffect(() => {
    if (!room) {
      return;
    }

    room.on("join", (peerId) => {
      console.log(`Peer ${peerId} joined`);
      setPeers(room.peers);
      if (camera) {
        room.addStream(camera, peerId, "camera");
      }
    });

    room.on("leave", (peerId) => {
      console.log(`Peer ${peerId} left`);
      setPeers(room.peers);
    });

    room.on("stream", (stream, peerId, metadata) => {
      console.log(`Received stream from ${peerId} with metadata: ${metadata}`);
      setStreams((prev) => [...prev, stream]);
    });
    room.on("track", (_track, _stream, peerId, metadata) => {
      console.log(`Received track from ${peerId} with metadata: ${metadata}`);
    });

    return () => {
      room.off("join");
      room.off("leave");
      room.off("stream");
      room.off("track");
    };
  }, [camera, room]);

  if (!room) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-4 max-w-2xl">
      <p>Peers: {peers.join(", ")}</p>
      {streams.map((stream, i) => (
        <video
          key={i}
          className="w-32 h-32"
          autoPlay
          playsInline
          ref={(el) => {
            if (el && stream) {
              el.srcObject = stream;
            }
          }}
        />
      ))}
    </div>
  );
}
