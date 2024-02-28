"use client";

import { useEffect, useRef, useState } from "react";
import Peer from "@rtco/peer";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";

interface PeerConsoleProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  initiator?: boolean;
}

export function PeerConsole({
  name,
  initiator = false,
  ...props
}: PeerConsoleProps) {
  const [outgoingSignal, setOutgoingSignal] = useState<string[]>([]);
  const [outgoingCameraStream, setOutgoingCameraStream] =
    useState<MediaStream>();
  const [outgoingScreenStream, setOutgoingScreenStream] =
    useState<MediaStream>();
  const [incomingStreams, setIncomingStreams] = useState<MediaStream[]>([]);
  const [peerConnected, setPeerConnected] = useState(false);
  const peer = useRef<Peer>();

  useEffect(() => {
    const p = new Peer({ initiator, debug: 4 });
    peer.current = p;

    p.on("signal", (signal) => {
      console.log(`Peer ${name} signal:`, signal);
      setOutgoingSignal((prev) => [...prev, JSON.stringify(signal)]);
    });

    p.on("connect", () => {
      console.log(`Peer ${name} connected`);
      setOutgoingSignal([]);
      setPeerConnected(true);
    });

    p.on("data", (data) => {
      console.log(`Peer ${name} data:`, data);
    });

    p.on("stream", (stream) => {
      console.log(`Peer ${name} stream added:`, stream);
      setIncomingStreams((prev) => [...prev, stream]);
    });

    p.on("removestream", (stream) => {
      console.log(`Peer ${name} stream removed:`, stream);
      setIncomingStreams((prev) => prev.filter((s) => s.id !== stream.id));
    });

    p.on("track", (track, stream) => {
      console.log(`Peer ${name} track added:`, track, stream);
    });

    p.on("removetrack", (track, stream) => {
      console.log(`Peer ${name} track removed:`, track, stream);
    });

    p.on("error", (err) => {
      console.error(`Peer ${name} error:`, err);
    });

    p.on("close", () => {
      setPeerConnected(false);
    });

    return () => {
      p.destroy();
      peer.current = undefined;
    };
  }, [initiator, name]);

  const handleCamera = async () => {
    if (outgoingCameraStream) {
      console.log("Stopping camera stream:", outgoingCameraStream.id);
      outgoingCameraStream.getTracks().forEach((track) => track.stop());
      peer.current?.removeStream(outgoingCameraStream);
      setOutgoingCameraStream(undefined);
      return;
    }
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    console.log("Assigned camera stream:", s.id);
    setOutgoingCameraStream(s);
    peer.current?.addStream(s);
  };

  const handleScreen = async () => {
    if (outgoingScreenStream) {
      console.log("Stopping screen stream:", outgoingScreenStream.id);
      outgoingScreenStream.getTracks().forEach((track) => track.stop());
      peer.current?.removeStream(outgoingScreenStream);
      setOutgoingScreenStream(undefined);
      return;
    }
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
    console.log("Assigned screen stream:", s.id);
    setOutgoingScreenStream(s);
    peer.current?.addStream(s);
  };

  return (
    <Card {...props}>
      <CardHeader className="p-2 sm:p-6">
        <CardTitle>Peer {name}</CardTitle>
        <CardDescription>
          {peerConnected
            ? "Communicate with your peer"
            : "Get your peers connected"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-2 overflow-x-scroll overflow-y-scroll no-scrollbar relative max-w-full">
            <Label htmlFor="name">Signal to peer</Label>
            <code className="text-xs h-20 max-w-full overflow-scroll no-scrollbar">
              {outgoingSignal.length > 0
                ? outgoingSignal[0]
                : "No pending signals"}
            </code>
          </div>
          <div className="flex justify-between items-center">
            <Button
              size="sm"
              variant="secondary"
              disabled={outgoingSignal.length === 0}
              onClick={() => {
                // copy outgoingSignal to clipboard
                navigator.clipboard.writeText(outgoingSignal[0]);
                // remove the copied signal from outgoingSignal
                setOutgoingSignal((prev) => prev.slice(1));
              }}
            >
              Copy outgoing signal
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const signal = await navigator.clipboard.readText();
                try {
                  const parsed = JSON.parse(signal);
                  if (parsed?.type === "candidate" || parsed?.type === "sdp") {
                    peer.current?.signal(parsed);
                  }
                } catch (err) {
                  console.debug("Error parsing signal:", err);
                }
              }}
            >
              Paste incoming signal
            </Button>
          </div>
          {peerConnected && (
            <>
              <div className="flex flex-col gap-1 sm:gap-4">
                <div className="flex sm:gap-4 gap-1">
                  <Button
                    size="sm"
                    variant={outgoingCameraStream ? "destructive" : "secondary"}
                    onClick={handleCamera}
                  >
                    {outgoingCameraStream ? "Stop" : "Start"} Camera
                  </Button>
                  <Button
                    size="sm"
                    variant={outgoingScreenStream ? "destructive" : "secondary"}
                    onClick={handleScreen}
                  >
                    {outgoingScreenStream ? "Stop" : "Start"} Screen
                  </Button>
                </div>
                <div className="flex flex-row gap-2 flex-wrap">
                  {incomingStreams.map((stream) => (
                    <StreamVideo
                      key={stream.id}
                      stream={stream}
                      className="flex-1"
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface StreamVideoProps extends React.HTMLProps<HTMLVideoElement> {
  stream: MediaStream;
}

export function StreamVideo({ stream, ...props }: StreamVideoProps) {
  return (
    <video
      {...props}
      autoPlay
      playsInline
      ref={(video) => {
        if (video && stream) {
          video.srcObject = stream;
        }
      }}
    />
  );
}
