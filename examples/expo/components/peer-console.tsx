import Peer from "@rtco/peer";
import React from "react";
import { View, Text, TextInput, Button, ViewProps } from "react-native";
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc";

interface PeerConsoleProps extends ViewProps {
  name: string;
  initiator?: boolean;
}

export function PeerConsole({
  name,
  initiator = false,
  ...props
}: PeerConsoleProps) {
  const [incomingSignal, setIncomingSignal] = React.useState<string>("");
  const [outgoingSignal, setOutgoingSignal] = React.useState<string[]>([]);
  const [outgoingCameraStream, setOutgoingCameraStream] =
    React.useState<MediaStream>();
  const [outgoingScreenStream, setOutgoingScreenStream] =
    React.useState<MediaStream>();
  const [incomingStreams, setIncomingStreams] = React.useState<MediaStream[]>(
    []
  );
  const [peerConnected, setPeerConnected] = React.useState(false);
  const peer = React.useRef<Peer>();

  React.useEffect(() => {
    const p = new Peer({
      initiator,
      debug: 4,
      wrtc: {
        RTCIceCandidate: RTCIceCandidate as any,
        RTCPeerConnection: RTCPeerConnection as any,
        RTCSessionDescription: RTCSessionDescription as any,
      },
    });
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
      setIncomingStreams((prev) => [...prev, stream as any]);
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
      peer.current?.removeStream(outgoingCameraStream as any);
      setOutgoingCameraStream(undefined);
      return;
    }
    const s = await mediaDevices.getUserMedia({ video: true });
    console.log("Assigned camera stream:", s.id);
    setOutgoingCameraStream(s);
    peer.current?.addStream(s as any);
  };

  return (
    <View {...props}>
      <Text>Peer {name}</Text>
      <View>
        <Text>Signal to peer</Text>
      </View>
      <View>
        <Text>{outgoingSignal}</Text>
      </View>
      <Button title="Send" />
    </View>
  );
}
