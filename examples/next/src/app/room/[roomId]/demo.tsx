"use client";

import React from "react";

import type { Room } from "@rtco/client";
import { Button } from "@rtco/ui/components/button";
import { Card, CardContent } from "@rtco/ui/components/card";
import { Icons } from "@rtco/ui/components/icons";
import { Input } from "@rtco/ui/components/input";
import { cn } from "@rtco/ui/lib/utils";

import { useArtico } from "../use-artico";

interface RoomMessage {
  type: "username" | "message";
  data: string;
}

export function RoomDemo({
  roomId,
  username,
}: {
  roomId: string;
  username: string;
}) {
  const { rtco, state } = useArtico();
  const [room, setRoom] = React.useState<Room>();

  React.useEffect(() => {
    if (!rtco || state !== "ready") {
      return;
    }

    const r = rtco.join(roomId, username);
    setRoom(r);

    return () => {
      r.leave();
    };
  }, [state, roomId, rtco, username]);

  if (state !== "ready" || !room || !rtco) {
    return <h1 className="text-3xl">Joining...</h1>;
  }

  return (
    <div className="flex h-full w-full flex-col sm:flex-row">
      <div className="grow">
        <RoomVideo room={room} peerId={rtco.id} username={username} />
      </div>
      <div className="h-64 overflow-y-scroll border-t border-l sm:h-full sm:w-96">
        <RoomChat room={room} peerId={rtco.id} />
      </div>
    </div>
  );
}

interface Stream {
  id: string;
  peerId: string;
  stream: MediaStream;
}

function RoomVideo({
  room,
  peerId,
  username,
}: {
  room: Room;
  peerId: string;
  username: string;
}) {
  const [count, setCount] = React.useState(1);
  const [cameraStream, setCameraStream] = React.useState<
    MediaStream | undefined
  >();
  const [streams, setStreams] = React.useState<Stream[]>([]);
  const usernames = React.useMemo(() => {
    const map = new Map<string, string>();
    map.set(peerId, "Me");
    return map;
  }, [peerId]);

  React.useEffect(() => {
    const handleJoin = (peerId: string, metadata?: string) => {
      usernames.set(peerId, metadata ?? "Anonymous");
      setCount((prev) => prev + 1);
      const msg: RoomMessage = { type: "username", data: username };
      room.send(JSON.stringify(msg));
      if (cameraStream) {
        room.addStream(cameraStream, undefined, peerId);
      }
    };

    const handleLeave = (peerId: string) => {
      usernames.delete(peerId);
      setCount((prev) => prev - 1);
      setStreams((prev) => prev.filter((s) => s.peerId !== peerId));
    };

    const handleStream = (stream: MediaStream, peerId: string) => {
      setStreams((prev) => {
        const existingStream = prev.find((s) => s.peerId === peerId);
        if (existingStream) {
          return prev;
        }
        return [...prev, { id: stream.id, peerId, stream }];
      });

      // eslint-disable-next-line
      stream.onremovetrack = () => {
        setStreams((prev) => {
          return prev.filter((s) => s.peerId !== peerId);
        });
      };
    };

    const handleMessage = (data: string, peerId: string) => {
      const msg = JSON.parse(data) as RoomMessage;
      if (msg.type === "username") {
        usernames.set(peerId, msg.data);
      }
    };

    room.on("join", handleJoin);
    room.on("leave", handleLeave);
    room.on("stream", handleStream);
    room.on("message", handleMessage);

    return () => {
      room.off("join", handleJoin);
      room.off("leave", handleLeave);
      room.off("stream", handleStream);
      room.off("message", handleMessage);
    };
  }, [cameraStream, room, username, usernames]);

  const toggleCamera = async () => {
    if (cameraStream) {
      room.removeStream(cameraStream);
      setStreams((prev) => prev.filter((s) => s.peerId !== peerId));
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(undefined);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        aspectRatio: 16 / 9,
      },
      audio: false,
    });
    setCameraStream(stream);
    setStreams((prev) => {
      const existingStream = prev.find((s) => s.peerId === peerId);
      if (existingStream) {
        return prev;
      }
      return [{ id: stream.id, peerId, stream }, ...prev];
    });

    room.addStream(stream);
  };

  return (
    <div
      className={cn("relative h-full w-full p-1", {
        "grid grid-cols-1 grid-rows-1 gap-1": streams.length === 1,
        "grid grid-cols-2 grid-rows-1 gap-1": streams.length === 2,
        "grid grid-cols-2 grid-rows-2 gap-1 gap-y-1":
          streams.length >= 3 && streams.length <= 4,
        "grid grid-cols-3 grid-rows-2":
          streams.length >= 5 && streams.length <= 6,
        "grid grid-cols-3 grid-rows-3": streams.length >= 7,
      })}
    >
      {streams.map((stream) => (
        <div
          key={stream.id}
          className="relative flex h-full w-full items-center justify-center"
        >
          <div className="apect-video relative max-h-full max-w-full flex-1">
            <video
              className="h-full w-full bg-black"
              style={{
                transform: `rotateY(${stream.peerId === "me" ? "180deg" : "0deg"})`,
              }}
              autoPlay
              muted
              playsInline
              width="100%"
              ref={(el) => {
                if (el) {
                  el.srcObject = stream.stream;
                }
              }}
            />
            <p className="bg-opacity-50 absolute right-0 bottom-0 bg-black px-2 py-1 text-xs text-white">
              {usernames.get(stream.peerId) ?? "Anonymous"}
            </p>
          </div>
        </div>
      ))}
      <div className="absolute bottom-4 flex w-full items-center justify-center">
        <Button
          variant={cameraStream ? "destructive" : "secondary"}
          className="rounded-full"
          onClick={async () => {
            await toggleCamera();
          }}
        >
          {cameraStream ? <Icons.videoOff /> : <Icons.video />}
        </Button>
      </div>
      <div className="absolute top-4 left-4">
        <span className="flex items-center">
          {count} <Icons.user className="w-4" />
        </span>
      </div>
    </div>
  );
}

interface ChatMessage {
  id: string;
  peer: string;
  timestamp: number;
  content: string;
}

function RoomChat({ room, peerId }: { room: Room; peerId: string }) {
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [message, setMessage] = React.useState("");
  const usernames = React.useMemo(() => {
    const map = new Map<string, string>();
    map.set(peerId, "Me");
    return map;
  }, [peerId]);

  React.useEffect(() => {
    const handleMessage = (data: string, peerId: string) => {
      const msg = JSON.parse(data) as RoomMessage;
      if (msg.type === "username") {
        usernames.set(peerId, msg.data);
      } else {
        const chatMsg: ChatMessage = {
          id: `${Date.now().toString()}-${peerId}`,
          peer: usernames.get(peerId) ?? "Anonymous",
          timestamp: Date.now(),
          content: msg.data,
        };
        setChatMessages((prev) => [...prev, chatMsg]);
      }
    };
    room.on("message", handleMessage);

    return () => {
      room.off("message", handleMessage);
    };
  }, [room, usernames]);

  const handleSendMessage = () => {
    const msg: RoomMessage = { type: "message", data: message };
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now().toString()}-me`,
        peer: "me",
        timestamp: Date.now(),
        content: message,
      },
    ]);
    room.send(JSON.stringify(msg));
    setMessage("");
  };

  return (
    <div className="flex h-full w-full flex-col p-2">
      <div className="flex flex-grow flex-col gap-2 overflow-y-auto">
        {chatMessages.map((msg) => (
          <Card
            key={msg.id}
            className={cn(
              "max-w-[80%]",
              msg.peer === "me" ? "self-end" : "self-start",
            )}
          >
            <CardContent className="p-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{msg.peer}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm font-bold">{msg.content}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <div
          className="h-2"
          ref={(el) => {
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
            }
          }}
        />
      </div>
      <div className="flex gap-4">
        <Input
          type="text"
          value={message}
          placeholder="Message"
          onChange={(e) => setMessage(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === "Enter") {
              handleSendMessage();
            }
          }}
        />
        <Button
          onClick={() => {
            handleSendMessage();
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
