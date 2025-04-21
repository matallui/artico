import { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RTCView } from "react-native-webrtc";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import type { Call } from "@rtco/client";
import { Artico } from "@rtco/client";

declare global {
  interface MediaStream {
    toURL(): string;
  }
}

export default function App() {
  return (
    <View style={styles.container}>
      <Demo />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  demoContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    padding: 32,
    backgroundColor: "#222",
  },
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  yourIdText: {
    fontSize: 18,
    color: "white",
  },
  bold: {
    fontWeight: "bold",
  },
  clipboardIcon: {
    fontSize: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    backgroundColor: "#eee",
    color: "black", // Ensure text is visible
  },
  callButton: {
    borderWidth: 1,
    borderColor: "#666",
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 8,
  },
  callButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  callViewContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#222",
  },
  hangupButton: {
    position: "absolute",
    bottom: 24,
    left: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    zIndex: 50,
    opacity: 0.8,
  },
  hangupButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  remoteViewContainer: {
    width: "100%",
    flex: 1,
  },
  remoteView: {
    flex: 1,
  },
  noStreamContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderWidth: 1,
    borderColor: "#666",
    backgroundColor: "#111",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  userIcon: {
    fontSize: 64,
    color: "#333",
  },
  localViewContainer: {
    position: "absolute",
    bottom: 24,
    right: 16,
    width: 96,
    height: 128,
  },
  localView: {
    flex: 1,
  },
  bottomButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    width: "100%",
    padding: 16,
    position: "absolute",
    bottom: 0,
  },
  cameraButton: {
    borderRadius: 999,
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.8,
  },
  cameraButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});

function Demo() {
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
        const meta = metadata
          ? (JSON.parse(metadata) as { type: string })
          : { type: "unknown" };
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
    [setOutStream],
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
      <View style={styles.demoContainer}>
        <View style={styles.rowContainer}>
          <Text style={styles.yourIdText}>
            <Text style={styles.bold}>Your ID:</Text> {rtco?.id ?? ""}
          </Text>
          <TouchableOpacity
            onPress={async () => {
              if (rtco?.id) {
                await Clipboard.setStringAsync(rtco.id);
              }
            }}
          >
            <Text style={styles.clipboardIcon}>📋</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Target peer ID"
          onChangeText={setTargetPeerId}
          value={targetPeerId}
          placeholderTextColor="#888" // Optional: Adjust placeholder text color
        />
        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <Text style={styles.callButtonText}>📞 Call</Text>
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
    <View style={styles.callViewContainer}>
      <TouchableOpacity style={styles.hangupButton} onPress={handleHangup}>
        <Text style={styles.hangupButtonText}>Hangup</Text>
      </TouchableOpacity>
      {inStream ? (
        <View style={styles.remoteViewContainer}>
          <RTCView
            style={styles.remoteView}
            objectFit="cover"
            streamURL={inStream.toURL()}
          />
        </View>
      ) : (
        <View style={styles.noStreamContainer}>
          <FontAwesome
            name="user"
            size={64}
            color="#333"
            style={styles.userIcon}
          />
        </View>
      )}
      {outStream && (
        <View style={styles.localViewContainer}>
          <RTCView
            style={styles.localView}
            zOrder={30}
            objectFit="cover"
            streamURL={outStream.toURL()}
          />
        </View>
      )}
      <View style={styles.bottomButtonsContainer}>
        <TouchableOpacity
          onPress={handleCamera}
          style={[
            styles.cameraButton,
            { backgroundColor: outStream ? "#EF4444" : "#333" },
          ]}
        >
          <Text style={styles.cameraButtonText}>
            <FontAwesome name="camera" size={28} />
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
