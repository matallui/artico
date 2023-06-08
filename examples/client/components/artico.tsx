"use client"

import { useEffect, useRef, useState } from "react"
import { Artico, Connection } from "@artico/client"

import { Button } from "./ui/button"
import { Input } from "./ui/input"

export function ArticoDemo() {
  const [userId, setUserId] = useState<string>("")
  const [localStream, setLocalStream] = useState<MediaStream>()
  const [remoteStream, setRemoteStream] = useState<MediaStream>()
  const [connection, setConnection] = useState<Connection>()
  const articoRef = useRef<Artico>()

  const setupConnection = (conn: Connection) => {
    setConnection(conn)

    conn.on("close", () => {
      console.log("connection close")
      setConnection(undefined)
      setLocalStream((current) => {
        current?.getTracks().forEach((track) => track.stop())
        return undefined
      })
      setRemoteStream((current) => {
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

    conn.on("stream", (stream) => {
      console.log("connection stream:", stream)
    })

    conn.on("track", (track, stream) => {
      console.log("connection track:", track, stream)
      setRemoteStream(stream)
    })
  }

  useEffect(() => {
    const artico = new Artico({
      host: "localhost",
      port: 9000,
    })

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
      const res = prompt("Incoming call from " + conn.target, "answer")
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

    const conn = articoRef.current?.call(peerId)

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
        if (localStream) {
          connection?.removeStream(localStream)
          localStream.getTracks().forEach((track) => track.stop())
        }
        setLocalStream(stream)
        connection?.addStream(stream)
      })
      .catch((err) => {
        console.log("getUserMedia error:", err)
      })
  }

  const handleShareScreen = () => {
    if (!connection) {
      console.log("error: can't share camera without a connection")
      return
    }

    navigator.mediaDevices
      .getDisplayMedia({ audio: false, video: true })
      .then((stream) => {
        if (localStream) {
          connection?.removeStream(localStream)
          localStream.getTracks().forEach((track) => track.stop())
        }
        setLocalStream(stream)
        connection?.addStream(stream)
      })
      .catch((err) => {
        console.log("getUserMedia error:", err)
      })
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
              handleShareCamera()
            }}
          >
            Share Camera
          </Button>
          <Button
            onClick={() => {
              handleShareScreen()
            }}
          >
            Share Screen
          </Button>
        </div>
      </div>
      <div className="container mt-2 flex flex-row space-y-4">
        <video
          className="w-1/2 border-2 border-blue-400"
          autoPlay
          playsInline
          muted
          ref={(video) => {
            if (video && localStream) {
              video.srcObject = localStream
            }
          }}
        />
        <video
          className="w-1/2 border-2 border-red-300"
          autoPlay
          playsInline
          ref={(video) => {
            if (video && remoteStream) {
              video.srcObject = remoteStream
            }
          }}
        />
      </div>
    </section>
  )
}
