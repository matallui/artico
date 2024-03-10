import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Peer from "@rtco/peer";

export default function PeerScreen() {
  return (
    <View className="flex-1 items-center justify-end gap-8 pb-16">
      <PeerCard name="Alice" initiator />
      <PeerCard name="Bob" />
    </View>
  );
}

function PeerCard({
  name,
  initiator = false,
}: {
  name: string;
  initiator?: boolean;
}) {
  const [peer, setPeer] = useState<Peer>();
  const [isConnected, setIsConnected] = useState(false);
  const [outgoingSignals, setOutgoingSignals] = useState<string[]>([]);
  const [incomingMessages, setIncomingMessages] = useState<string[]>([]);

  const setupPeer = useCallback(() => {
    const p = new Peer({ initiator, debug: 4 });

    setPeer(p);

    p.on("connect", () => {
      setIsConnected(true);
    });

    p.on("close", () => {
      setIsConnected(false);
      setOutgoingSignals([]);
      setIncomingMessages([]);
      // Re-create the peer to allow for re-connection
      setupPeer();
    });

    p.on("error", (err) => {
      console.debug(err);
    });

    p.on("signal", (signal) => {
      setOutgoingSignals((prev) => [...prev, JSON.stringify(signal)]);
    });

    p.on("data", (data) => {
      if (typeof data !== "string") {
        console.debug("Received non-string data:", data);
        return;
      }
      setIncomingMessages((prev) => [...prev, data]);
    });

    return p;
  }, [initiator]);

  useEffect(() => {
    const p = setupPeer();
    return () => {
      p.destroy();
    };
  }, [setupPeer]);

  const geetPeer = () => {
    if (!peer || !isConnected) return;
    peer.send(`Greetings from ${name}!`);
  };

  const disconnect = () => {
    peer?.destroy();
  };

  if (isConnected) {
    return (
      <View className="w-full h-72 border border-gray-500 rounded-xl p-4 bg-[#111]">
        <Text className="text-white text-lg font-bold">{name}</Text>
        <Text className="text-gray-300 text-sm">
          You can now exchange greets with your peer
        </Text>
        <ScrollView className="flex-1 border border-gray-600 bg-[#0f0f0f] my-3 rounded-md">
          <Text className="text-white text-xs p-2 font-mono">
            {incomingMessages.join("\n") || "No messages yet!"}
          </Text>
        </ScrollView>
        <View className="flex flex-row items-center justify-evenly">
          <TouchableOpacity
            onPress={geetPeer}
            className="p-2 rounded-lg border border-gray-500"
          >
            <Text className="text-white">Greet Peer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={disconnect}
            className="p-2 rounded-lg border border-gray-500"
          >
            <Text className="text-white">Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="w-full h-72 border border-gray-500 rounded-xl p-4 bg-[#111]">
      <Text className="text-white text-lg font-bold">{name}</Text>
      <Text className="text-gray-300 text-sm">
        Manually exchange WebRTC signals
      </Text>
      <ScrollView className="flex-1 border border-gray-600 bg-[#0f0f0f] my-3 rounded-md">
        <Text className="text-white text-xs p-2 font-mono">
          {outgoingSignals[0] ?? "No pending signals"}
        </Text>
      </ScrollView>
      <View className="flex flex-row items-center justify-evenly">
        <TouchableOpacity
          onPress={async () => {
            if (!peer || outgoingSignals.length === 0) {
              return;
            }
            await Clipboard.setStringAsync(outgoingSignals[0]);
            setOutgoingSignals((prev) => prev.slice(1));
          }}
          className="p-2 rounded-lg border border-gray-500"
        >
          <Text className="text-white">Copy Outgoing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            if (!peer) {
              return;
            }
            try {
              const text = await Clipboard.getStringAsync();
              const signal = JSON.parse(text);
              peer.signal(signal);
            } catch (err) {
              console.debug("Error parsing signal:", err);
            }
          }}
          className="p-2 rounded-lg border border-gray-500"
        >
          <Text className="text-white">Paste Incoming</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
