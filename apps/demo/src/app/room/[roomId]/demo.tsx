"use client";

import React from "react";
import { useArtico } from "../use-artico";
import type { Room } from "@rtco/client";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Icons } from "~/components/icons";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

export function RoomDemo({ roomId }: { roomId: string }) {
  const { rtco, state } = useArtico();
  const [room, setRoom] = React.useState<Room>();

  React.useEffect(() => {
    if (!rtco || state !== "ready") {
      return;
    }

    const r = rtco.join(roomId, "lala");
    setRoom(r);

    return () => {
      r.leave();
    };
  }, [state, roomId, rtco]);

  if (state !== "ready" || !room) {
    return <h1 className="text-3xl">Joining...</h1>;
  }

  return (
    <div className="w-full h-full flex flex-col sm:flex-row">
      <div className="grow">
        <RoomVideo room={room} />
      </div>
      <div className="sm:w-96 border-l h-64 sm:h-full border-t overflow-y-scroll">
        <RoomChat room={room} />
      </div>
    </div>
  );
}

interface Stream {
  id: string;
  peerId: string;
  stream: MediaStream;
}

function RoomVideo({ room }: { room: Room }) {
  const [count, setCount] = React.useState(1);
  const [cameraStream, setCameraStream] = React.useState<
    MediaStream | undefined
  >();
  const [streams, setStreams] = React.useState<Stream[]>([]);

  React.useEffect(() => {
    const handleJoin = (peerId: string, metadata?: string) => {
      console.log("peer joined:", peerId, metadata);
      setCount((prev) => prev + 1);
      setCameraStream((prev) => {
        if (prev) {
          try {
            console.debug("*** adding stream ***");
            room.addStream(prev, metadata, peerId);
          } catch (e) {
            // ignore error
          }
        }
        return prev;
      });
    };

    const handleLeave = (_peerId: string) => {
      setCount((prev) => prev - 1);
    };

    const handleStream = (stream: MediaStream, peerId: string) => {
      setStreams((prev) => {
        const existingStream = prev.find((s) => s.peerId === peerId);
        if (existingStream) {
          return prev;
        }
        return [...prev, { id: stream.id, peerId, stream }];
      });

      stream.onremovetrack = () => {
        setStreams((prev) => {
          return prev.filter((s) => s.peerId !== peerId);
        });
      };
    };

    console.debug("adding listeners")
    room.on("join", handleJoin);
    room.on("leave", handleLeave);
    room.on("stream", handleStream);

    return () => {
      console.debug("removing listeners")
      room.off("join", handleJoin);
      room.off("leave", handleLeave);
      room.off("stream", handleStream);
    };
  }, [room]);

  const toggleCamera = async () => {
    if (cameraStream) {
      room.removeStream(cameraStream);
      setStreams((prev) => prev.filter((s) => s.peerId !== "me"));
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
      const existingStream = prev.find((s) => s.peerId === "me");
      if (existingStream) {
        return prev;
      }
      return [{ id: stream.id, peerId: "me", stream }, ...prev];
    });

    room.addStream(stream);
  };

  return (
    <div
      className={cn("relative w-full h-full p-1", {
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
          className="w-full h-full flex items-center justify-center relative"
        >
          <div className="apect-video flex-1 max-h-full max-w-full relative">
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
            <p className="absolute bottom-0 right-0 text-xs text-white bg-black bg-opacity-50 py-1 px-2">
              {stream.peerId}
            </p>
          </div>
        </div>
      ))}
      <div className="absolute bottom-4 w-full flex items-center justify-center">
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
  content: string;
}

function RoomChat({ room }: { room: Room }) {
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    const handleMessage = (data: string, peerId: string) => {
      const msg: ChatMessage = {
        id: `${Date.now().toString()}-${peerId}`,
        peer: peerId,
        content: data,
      };
      setChatMessages((prev) => [...prev, msg]);
    };
    room.on("message", handleMessage);

    return () => {
      room.off("message", handleMessage);
    };
  }, [room]);

  const handleSendMessage = () => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now().toString()}-me`,
        peer: "me",
        content: message,
      },
    ]);
    room.send(message);
    setMessage("");
  };

  return (
    <div className="w-full h-full flex flex-col p-2">
      <div className="flex-grow flex flex-col overflow-y-auto gap-2">
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
                <div className="flex gap-2 items-center">
                  <span className="text-sm">{msg.peer}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString()}
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
