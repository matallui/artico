import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Peer from "@rtco/peer";
import { useEffect, useMemo, useState } from "react";

export function PeerConsole({ name }: { name: string }) {
  const [initiator, setInitiator] = useState(false);
  const [incomingSignal, setIncomingSignal] = useState<string>("");
  const [outgoingSignal, setOutgoingSignal] = useState<string[]>([]);
  const [peerConnected, setPeerConnected] = useState(false);
  const peer = useMemo(() => new Peer({ initiator }), [initiator]);

  useEffect(() => {
    peer.on("signal", (signal) => {
      console.log(`Peer ${name} signal:`, signal);
      setOutgoingSignal((prev) => [...prev, JSON.stringify(signal)]);
    });

    peer.on("connect", () => {
      console.log(`Peer ${name} connected`);
      setOutgoingSignal([]);
      setPeerConnected(true);
    });
  }, [peer, name]);

  return (
    <Card className="w-[600px]">
      <CardHeader>
        <CardTitle>Peer {name}</CardTitle>
        <CardDescription>Get your peers connected</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5 overflow-x-scroll no-scrollbar">
            <Label htmlFor="name">Signal to peer</Label>
            <code className="text-xs min-h-20">
              {outgoingSignal.length > 0
                ? outgoingSignal[0]
                : peerConnected
                ? "Connected"
                : "No pending signal"}
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
                  const signal = JSON.parse(incomingSignal ?? "");
                  peer.signal(signal);
                  setIncomingSignal("");
                  if (outgoingSignal.length > 0) {
                    setOutgoingSignal((prev) => prev.slice(1));
                  }
                }}
              >
                Signal
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            setOutgoingSignal([]);
            setInitiator(false);
            setPeerConnected(false);
          }}
        >
          Reset
        </Button>
        <Button onClick={() => setInitiator(true)}>Initiate</Button>
      </CardFooter>
    </Card>
  );
}
