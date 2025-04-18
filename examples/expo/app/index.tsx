import { useCallback, useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Clipboard from "expo-clipboard";
import { Artico, type Call } from "@rtco/client";
import { RTCView } from "react-native-webrtc";

export default function Index() {
  const [targetPeerId, setTargetPeerId] = useState("");
  const [rtco, setRtco] = useState<Artico>();
  const [call, setCall] = useState<Call>();
  const [outStream, setOutStream] = useState<MediaStream>();
  const [inStream, setInStream] = useState<MediaStream>();

  const setupCall = useCallback(
    (call: Call) => {
      call.on("open", () => {
        setCall(call);
      });
      call.on("close", () => {
        setOutStream((prev) => {
          prev?.getTracks().forEach((track) => track.stop());
          return undefined;
        });
        setOutStream(undefined);
        setInStream(undefined);
        setCall(undefined);
      });
      call.on("stream", (stream, metadata) => {
        console.debug(`Call stream:`, stream);
        const meta = metadata ? JSON.parse(metadata) : { type: "unknown" };
        if (meta.type !== "camera") {
          // ignore non-camera streams
          return;
        }
        setInStream(stream);
        stream.getTracks().forEach((track) => {
          track.onended = () => {
            setInStream(undefined);
          };
        });
      });
      call.on("removestream", (_stream) => {
        setInStream(undefined);
      });
    },
    [setOutStream]
  );

  useEffect(() => {
    const rtc = new Artico({ debug: 4 });

    rtc.on("open", (id) => {
      console.debug(`Artico open:`, id);
      setRtco(rtc);
    });

    rtc.on("close", () => {
      console.debug(`Artico close`);
      setRtco(undefined);
    });

    rtc.on("error", (err) => {
      console.debug(`Artico error:`, err.message);
    });

    rtc.on("call", (call) => {
      console.debug(`Artico call:`, call);
      call.answer();
      setupCall(call);
    });

    return () => {
      rtc.close();
    };
  }, [setupCall]);

  const handleCall = () => {
    if (!rtco) return;
    const target = targetPeerId.trim();
    if (target === "") return;

    const call = rtco.call(target);
    setupCall(call);
  };

  if (!call) {
    return (
      <View className="flex-1 justify-center gap-4 p-8 bg-[#222]">
        <View className="flex flex-row items-center justify-between">
          <Text className="text-lg text-white">
            <Text className="font-bold">Your ID:</Text> {rtco?.id ?? ""}
          </Text>
          <TouchableOpacity
            onPress={async () => {
              if (rtco?.id) {
                await Clipboard.setStringAsync(rtco.id);
              }
            }}
          >
            <Text className="text-xl">📋</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          className="border border-gray-600 rounded-lg p-3 w-full bg-[#eee]"
          placeholder="Target peer ID"
          onChangeText={setTargetPeerId}
          value={targetPeerId}
        />
        <TouchableOpacity
          className="border border-gray-600 bg-[#222] rounded-lg p-2"
          onPress={handleCall}
        >
          <Text className="text-white text-lg font-bold text-center">
            📞 Call
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleHangup = () => {
    call.hangup();
    outStream?.getTracks().forEach((track) => track.stop());
    setOutStream(undefined);
    setInStream(undefined);
    setCall(undefined);
  };

  const handleCamera = async () => {
    if (outStream) {
      // stop camera
      call.removeStream(outStream);
      outStream.getTracks().forEach((track) => track.stop());
      setOutStream(undefined);
    } else {
      // start camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      call.addStream(stream, JSON.stringify({ type: "camera" }));
      setOutStream(stream);
    }
  };

  return (
    <View className="flex-1 justify-center items-center relative bg-[#222]">
      <TouchableOpacity
        onPress={handleHangup}
        className="absolute bottom-6 left-4 p-2 rounded-lg bg-[#EF4444] z-50 opacity-80"
      >
        <Text className="text-white text-xl font-bold">Hangup</Text>
      </TouchableOpacity>
      {inStream ? (
        <View className="w-full flex-1">
          <RTCView
            style={{ flex: 1 }}
            objectFit="cover"
            // @ts-ignore
            streamURL={inStream.toURL()}
          />
        </View>
      ) : (
        <View className="w-full aspect-[4/3] border border-gray-600 bg-[#111] rounded-lg items-center justify-center">
          <FontAwesome name="user" size={64} color="#333" />
        </View>
      )}
      {outStream && (
        <View className="absolute bottom-6 right-4 w-24 h-32">
          <RTCView
            style={{ flex: 1 }}
            zOrder={30}
            objectFit="cover"
            // @ts-ignore
            streamURL={outStream.toURL()}
          />
        </View>
      )}
      <View className="flex flex-row items-center justify-evenly w-full p-4 absolute bottom-0">
        <TouchableOpacity
          onPress={handleCamera}
          className="rounded-full w-16 h-16 items-center justify-center"
          style={{
            opacity: 0.8,
            backgroundColor: outStream ? "#EF4444" : "#333",
          }}
        >
          <Text className="text-white font-bold">
            <FontAwesome name="camera" size={28} />
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
