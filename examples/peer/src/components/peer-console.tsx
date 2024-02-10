import { StreamVideo } from "./stream-video";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Peer from "@rtco/peer";
import { useEffect, useRef, useState } from "react";

interface PeerConsoleProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  initiator: boolean;
}

export function PeerConsole({ name, initiator, ...props }: PeerConsoleProps) {
  const [incomingSignal, setIncomingSignal] = useState<string>("");
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
      <CardHeader>
        <CardTitle>Peer {name}</CardTitle>
        <CardDescription>
          {peerConnected
            ? "Communicate with your peer"
            : "Get your peers connected"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-2 overflow-x-scroll overflow-y-scroll no-scrollbar relative max-w-full">
            {outgoingSignal.length > 0 && (
              <Button
                className="absolute top-0 right-0"
                variant="ghost"
                onClick={() => {
                  // copy outgoingSignal to clipboard
                  navigator.clipboard.writeText(outgoingSignal[0]);
                  // remove the copied signal from outgoingSignal
                  setOutgoingSignal((prev) => prev.slice(1));
                }}
              >
                Copy
              </Button>
            )}
            <Label htmlFor="name">Signal to peer</Label>
            <code className="text-xs h-20 max-w-full">
              {outgoingSignal.length > 0
                ? outgoingSignal[0]
                : "No pending signals"}
            </code>
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="name">Input signal from peer</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                className="overflow-x-scroll"
                value={incomingSignal}
                onChange={(ev) => {
                  setIncomingSignal(ev.target.value);
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!incomingSignal) return;
                  const signal = JSON.parse(incomingSignal);
                  peer.current?.signal(signal);
                  setIncomingSignal("");
                }}
              >
                Signal
              </Button>
            </div>
          </div>
          {peerConnected && (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <Button
                    variant={outgoingCameraStream ? "destructive" : "secondary"}
                    onClick={handleCamera}
                  >
                    {outgoingCameraStream ? "Stop" : "Start"} Camera
                  </Button>
                  <Button
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
