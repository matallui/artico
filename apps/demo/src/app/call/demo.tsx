"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Artico,
  SocketSignaling,
  type ArticoOptions,
  type Call,
} from "@rtco/client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function CallDemo() {
  const articoRef = useRef<Artico>();
  const [userId, setUserId] = useState<string>("");
  const [call, setcall] = useState<Call>();
  const [localCamera, setLocalCamera] = useState<MediaStream>();
  const [localScreen, setLocalScreen] = useState<MediaStream>();
  const [remoteCamera, setRemoteCamera] = useState<MediaStream>();
  const [remoteScreen, setRemoteScreen] = useState<MediaStream>();

  const setupcall = useCallback((call: Call) => {
    call.on("open", () => {
      console.log("call open");
      setcall(call);
    });

    call.on("close", () => {
      console.log("call close");
      setcall(undefined);
      setLocalCamera((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return undefined;
      });
      setLocalScreen((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return undefined;
      });
      setRemoteCamera((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return undefined;
      });
      setRemoteScreen((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return undefined;
      });
    });

    call.on("error", (err) => {
      console.log("call error:", err);
      call.hangup();
    });

    call.on("data", (data) => {
      console.log("call data:", data);
    });

    call.on("stream", (stream, metadata) => {
      console.log("call stream:", { stream, metadata });
    });

    call.on("track", (track, stream, metadata) => {
      const meta = JSON.parse(metadata!) as { type: string };
      console.log("call track:", { track, stream, metadata });
      if (meta.type === "camera") {
        setRemoteCamera(stream);
      } else if (meta.type === "screen") {
        setRemoteScreen(stream);
      }
    });

    call.on("removetrack", (track, stream, metadata) => {
      console.log("call removetrack:", { track, stream, metadata });
    });

    call.on("removestream", (stream, metadata) => {
      const meta = JSON.parse(metadata!) as { type: string };
      console.log("call removestream:", { stream, metadata });
      if (meta.type === "camera") {
        setRemoteCamera(undefined);
        // setRemoteCamera((current) => {
        //   // current?.getTracks().forEach((track) => track.stop())
        //   return undefined
        // })
      } else if (meta.type === "screen") {
        setRemoteScreen((current) => {
          current?.getTracks().forEach((track) => track.stop());
          return undefined;
        });
      }
    });
  }, []);

  useEffect(() => {
    const options: Partial<ArticoOptions> = {
      debug: 4, // 0 (none) - 4 (all)
      signaling: new SocketSignaling({
        debug: 4,
        url:
          process.env.NODE_ENV === "development"
            ? "http://localhost:9000"
            : "https://0.artico.dev:443",
      }),
    };

    const artico = new Artico(options);

    artico.on("open", (id) => {
      console.log("artico open", id);
      setUserId(id);
    });

    artico.on("close", () => {
      console.log("artico close");
    });

    artico.on("error", (err) => {
      console.log("artico error:", err.message);
    });

    artico.on("call", (call) => {
      console.log("artico call:", call.session);
      setupcall(call);

      // answer call
      call.answer();
    });

    articoRef.current = artico;

    return () => {
      artico.close();
      articoRef.current = undefined;
    };
  }, [setupcall]);

  const handleCall = (peerId: string) => {
    if (peerId.trim() === "") {
      alert("Please enter a peer ID");
      return;
    }
    if (!articoRef.current) {
      console.log("error: artico not initialized");
      return;
    }

    // generate random user name
    const name = `user${Math.floor(Math.random() * 1000)}`;

    console.log("Calling peer:", peerId);
    const call = articoRef.current.call(
      peerId,
      JSON.stringify({
        name,
      }),
    );
    setupcall(call);
  };

  const handleHangup = () => {
    call?.hangup();
    setcall(undefined);
  };

  const handleShareCamera = () => {
    if (!call) {
      console.log("error: can't share camera without a call");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: false, video: true })
      .then((stream) => {
        if (localCamera) {
          call?.removeStream(localCamera);
          localCamera.getTracks().forEach((track) => track.stop());
        }
        setLocalCamera(stream);
        call?.addStream(stream, JSON.stringify({ type: "camera" }));
      })
      .catch((err) => {
        console.log("getUserMedia error:", err);
      });
  };

  const handleStopShareCamera = () => {
    if (!localCamera) {
      return;
    }

    call?.removeStream(localCamera);
    localCamera.getTracks().forEach((track) => track.stop());
    setLocalCamera(undefined);
  };

  const handleShareScreen = () => {
    if (!call) {
      console.log("error: can't share camera without a call");
      return;
    }

    navigator.mediaDevices
      .getDisplayMedia({ audio: false, video: true })
      .then((stream) => {
        if (localScreen) {
          call?.removeStream(localScreen);
          localScreen.getTracks().forEach((track) => track.stop());
        }
        setLocalScreen(stream);
        call?.addStream(stream, JSON.stringify({ type: "screen" }));
      })
      .catch((err) => {
        console.log("getUserMedia error:", err);
      });
  };

  const handleStopShareScreen = () => {
    if (!localScreen) {
      return;
    }

    call?.removeStream(localScreen);
    localScreen.getTracks().forEach((track) => track.stop());
    setLocalScreen(undefined);
  };

  return (
    <section className="flex flex-col items-center justify-center">
      <div className="container mb-2 space-y-4">
        <p>Your Peer ID is: {userId}</p>
      </div>
      <div className="container space-y-4">
        <Input
          data-1p-ignore
          id="peerId"
          type="text"
          placeholder="Peer ID"
          disabled={!!call}
        />
        <div className="flex flex-row space-x-4">
          <Button
            onClick={() => {
              if (call) {
                handleHangup();
              } else {
                const peerId = document.getElementById(
                  "peerId",
                ) as HTMLInputElement;
                handleCall(peerId.value);
              }
            }}
          >
            {call ? "Hangup" : "Call"}
          </Button>
          <Button
            disabled={!call}
            variant="secondary"
            onClick={() => {
              if (localCamera) {
                handleStopShareCamera();
              } else {
                handleShareCamera();
              }
            }}
          >
            {localCamera ? "Stop" : "Start"} Camera
          </Button>
          <Button
            disabled={!call}
            variant="secondary"
            onClick={() => {
              if (localScreen) {
                handleStopShareScreen();
              } else {
                handleShareScreen();
              }
            }}
          >
            {localScreen ? "Stop" : "Start"} Screen
          </Button>
        </div>
      </div>
      <div className="container my-4 grid grid-cols-2 grid-rows-2 gap-2">
        <video
          className="w-full border-2 border-blue-400"
          style={{ transform: "rotateY(180deg)" }}
          autoPlay
          playsInline
          muted
          ref={(video) => {
            if (!video) return;
            video.srcObject = localCamera || null;
          }}
        />
        <video
          className="w-full border-2 border-blue-300"
          autoPlay
          playsInline
          ref={(video) => {
            if (!video) return;
            video.srcObject = localScreen || null;
          }}
        />
        <video
          className="w-full border-2 border-red-400"
          autoPlay
          playsInline
          muted
          ref={(video) => {
            if (!video) return;
            video.srcObject = remoteCamera || null;
          }}
        />
        <video
          className="w-full border-2 border-red-300"
          autoPlay
          playsInline
          ref={(video) => {
            if (!video) return;
            video.srcObject = remoteScreen || null;
          }}
        />
      </div>
    </section>
  );
}
