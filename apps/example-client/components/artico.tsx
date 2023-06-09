"use client"

import { useEffect, useRef, useState } from "react"
import { Artico, ArticoOptions, Connection } from "@rtco/client"

import { Button } from "./ui/button"
import { Input } from "./ui/input"

export function ArticoDemo() {
  const articoRef = useRef<Artico>()
  const [userId, setUserId] = useState<string>("")
  const [connection, setConnection] = useState<Connection>()
  const [localCamera, setLocalCamera] = useState<MediaStream>()
  const [localScreen, setLocalScreen] = useState<MediaStream>()
  const [remoteCamera, setRemoteCamera] = useState<MediaStream>()
  const [remoteScreen, setRemoteScreen] = useState<MediaStream>()

  const setupConnection = (conn: Connection) => {
    setConnection(conn)

    conn.on("close", () => {
      console.log("connection close")
      setConnection(undefined)
      setLocalCamera((current) => {
        current?.getTracks().forEach((track) => track.stop())
        return undefined
      })
      setLocalScreen((current) => {
        current?.getTracks().forEach((track) => track.stop())
        return undefined
      })
      setRemoteCamera((current) => {
        current?.getTracks().forEach((track) => track.stop())
        return undefined
      })
      setRemoteScreen((current) => {
        current?.getTracks().forEach((track) => track.stop())
        return undefined
      })
    })

    conn.on("error", (err) => {
      console.log("connection error:", err)
    })

    conn.on("data", (data) => {
      console.log("connection data:", data)
    })

    conn.on("stream", (stream, metadata) => {
      console.log("connection stream:", { stream, metadata })
    })

    conn.on("track", (track, stream, metadata) => {
      const meta = metadata as { type: string }
      console.log("connection track:", { track, stream, metadata })
      if (meta.type === "camera") {
        setRemoteCamera(stream)
      } else if (meta.type === "screen") {
        setRemoteScreen(stream)
      }
    })

    conn.on("removetrack", (track, stream, metadata) => {
      console.log("connection removetrack:", { track, stream, metadata })
    })

    conn.on("removestream", (stream, metadata) => {
      const meta = metadata as { type: string }
      console.log("connection removestream:", { stream, metadata })
      if (meta.type === "camera") {
        setRemoteCamera(undefined)
        // setRemoteCamera((current) => {
        //   // current?.getTracks().forEach((track) => track.stop())
        //   return undefined
        // })
      } else if (meta.type === "screen") {
        setRemoteScreen((current) => {
          current?.getTracks().forEach((track) => track.stop())
          return undefined
        })
      }
    })
  }

  useEffect(() => {
    const options: Partial<ArticoOptions> = {
      debug: 4, // 0 (none) - 4 (all)
    }

    if (process.env.NODE_ENV === "development") {
      options.host = "localhost"
      options.port = 9000
    }

    const artico = new Artico(options)

    artico.on("open", (id) => {
      console.log("artico open", id)
      setUserId(id)
    })

    artico.on("close", () => {
      console.log("artico close")
    })

    artico.on("error", (err) => {
      console.log("artico error:", err)
    })

    artico.on("call", (conn) => {
      console.log("artico connection:", conn.id)

      const metadata = conn.metadata as { name: string }
      const res = prompt("Incoming call from " + metadata.name, "answer")
      if (res !== "answer") {
        return
      }

      setupConnection(conn)

      // answer call
      conn.answer()
    })

    articoRef.current = artico

    return () => {
      artico.disconnect()
      articoRef.current = undefined
    }
  }, [])

  const handleConnect = (peerId: string) => {
    if (peerId.trim() === "") {
      alert("Please enter a peer ID")
      return
    }

    // generate random user name
    const name = "user" + Math.floor(Math.random() * 1000)

    const conn = articoRef.current?.call(peerId, {
      name,
    })

    if (!conn) {
      console.log("no connection")
      return
    }

    setupConnection(conn)
  }

  const handleDisconnect = () => {
    connection?.close()
    setConnection(undefined)
    articoRef.current?.close()
    articoRef.current = undefined
  }

  const handleShareCamera = () => {
    if (!connection) {
      console.log("error: can't share camera without a connection")
      return
    }

    navigator.mediaDevices
      .getUserMedia({ audio: false, video: true })
      .then((stream) => {
        if (localCamera) {
          connection?.removeStream(localCamera)
          localCamera.getTracks().forEach((track) => track.stop())
        }
        setLocalCamera(stream)
        connection?.addStream(stream, { type: "camera" })
      })
      .catch((err) => {
        console.log("getUserMedia error:", err)
      })
  }

  const handleStopShareCamera = () => {
    if (!localCamera) {
      return
    }

    connection?.removeStream(localCamera)
    localCamera.getTracks().forEach((track) => track.stop())
    setLocalCamera(undefined)
  }

  const handleShareScreen = () => {
    if (!connection) {
      console.log("error: can't share camera without a connection")
      return
    }

    navigator.mediaDevices
      .getDisplayMedia({ audio: false, video: true })
      .then((stream) => {
        if (localScreen) {
          connection?.removeStream(localScreen)
          localScreen.getTracks().forEach((track) => track.stop())
        }
        setLocalScreen(stream)
        connection?.addStream(stream, { type: "screen" })
      })
      .catch((err) => {
        console.log("getUserMedia error:", err)
      })
  }

  const handleStopShareScreen = () => {
    if (!localScreen) {
      return
    }

    connection?.removeStream(localScreen)
    localScreen.getTracks().forEach((track) => track.stop())
    setLocalScreen(undefined)
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col items-center justify-center">
      <div className="container mb-2 space-y-4">
        <p>Your Peer ID is: {userId}</p>
      </div>
      <div className="container space-y-4">
        <Input id="peerId" type="text" placeholder="Peer ID" />
        <div className="flex flex-row space-x-4">
          <Button
            onClick={() => {
              if (connection) {
                handleDisconnect()
              } else {
                const peerId = document.getElementById(
                  "peerId"
                ) as HTMLInputElement
                handleConnect(peerId.value)
              }
            }}
          >
            {connection ? "Disconnect" : "Connect"}
          </Button>
          <Button
            onClick={() => {
              if (localCamera) {
                handleStopShareCamera()
              } else {
                handleShareCamera()
              }
            }}
          >
            {localCamera ? "Stop" : "Start"} Camera
          </Button>
          <Button
            onClick={() => {
              if (localScreen) {
                handleStopShareScreen()
              } else {
                handleShareScreen()
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
          autoPlay
          playsInline
          muted
          ref={(video) => {
            if (!video) return
            video.srcObject = localCamera || null
          }}
        />
        <video
          className="w-full border-2 border-blue-300"
          autoPlay
          playsInline
          ref={(video) => {
            if (!video) return
            video.srcObject = localScreen || null
          }}
        />
        <video
          className="w-full border-2 border-red-400"
          autoPlay
          playsInline
          muted
          ref={(video) => {
            if (!video) return
            video.srcObject = remoteCamera || null
          }}
        />
        <video
          className="w-full border-2 border-red-300"
          autoPlay
          playsInline
          ref={(video) => {
            if (!video) return
            video.srcObject = remoteScreen || null
          }}
        />
      </div>
    </section>
  )
}
