import Peer from "@rtco/peer";
import * as Clipboard from "expo-clipboard";
import React from "react";
import {
  View,
  Text,
  TextInput,
  ViewProps,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  RTCView,
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
      <View className="bg-white rounded-lg shadow shadow-black/20 p-3 space-y-3">
        <View>
          <Text className="font-bold text-lg">Peer {name}</Text>
          <Text className="font-bold text-sm text-gray-600">
            Get your peers connected
          </Text>
        </View>
        <View className="space-y-1 relative">
          <Text className="font-bold text-xs">Signal to peer</Text>
          <ScrollView className="h-16">
            <Text className="text-xs font-semibold text-gray-700">
              {outgoingSignal.length > 0
                ? outgoingSignal[0]
                : "No pending signals"}
            </Text>
          </ScrollView>
          {outgoingSignal.length > 0 && (
            <TouchableOpacity
              className="bg-black/10 absolute right-0 top-0 p-2 rounded-full"
              onPress={() => {
                void Clipboard.setStringAsync(outgoingSignal[0]);
                setOutgoingSignal((prev) => prev.slice(1));
              }}
            >
              <Text className="text-gray-700">Copy</Text>
            </TouchableOpacity>
          )}
        </View>
        <View className="">
          <Text className="font-bold text-xs">Incoming signal</Text>
          <View className="flex-row space-x-2">
            <TextInput
              className="bg-white border border-gray-400 rounded-sm p-1 flex-1"
              onChangeText={(text) => setIncomingSignal(text)}
              value={incomingSignal}
            />
            <TouchableOpacity
              className="bg-black/10 p-2 rounded-full"
              onPress={() => {
                if (incomingSignal.length === 0) return;
                peer.current?.signal(JSON.parse(incomingSignal));
                setIncomingSignal("");
              }}
            >
              <Text className="text-gray-700">Send</Text>
            </TouchableOpacity>
          </View>
        </View>
        {peerConnected && (
          <View className="items-start">
            <TouchableOpacity
              className="bg-black/10 p-2 rounded-full"
              onPress={() => handleCamera()}
            >
              <Text className="text-gray-700">
                {outgoingCameraStream ? "Stop" : "Start"} Camera
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {incomingStreams.map((stream) => (
          <RTCView
            key={stream.id}
            streamURL={stream.toURL()}
            style={{ width: 200, height: 200 }}
          />
        ))}
      </View>
    </View>
  );
}
