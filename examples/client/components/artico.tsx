"use client"

import { useEffect, useRef, useState } from "react"
import { Artico } from "@artico/client"

import { Button } from "./ui/button"
import { Input } from "./ui/input"

export function ArticoDemo() {
  const [userId, setUserId] = useState<string>("")
  const articoRef = useRef<Artico>()

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

    artico.on("connection", () => {})

    artico.on("error", (err) => {
      console.log("artico error", err)
    })

    artico.on("call", (conn) => {
      console.log("artico connection", conn)
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

    conn.on("close", () => {
      console.log("connection close")
    })

    conn.on("error", (err) => {
      console.log("connection error", err)
    })

    conn.on("data", (data) => {
      console.log("connection data", data)
    })

    conn.on("stream", (stream) => {
      console.log("connection stream", stream)
    })

    conn.on("track", (track, stream) => {
      console.log("connection track", track, stream)
    })
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col items-center justify-center">
      <div className="container mb-2 space-y-4">
        <p>Your Peer ID is: {userId}</p>
      </div>
      <div className="container space-y-4">
        <Input id="peerId" type="text" placeholder="Peer ID" />
        <Button
          onClick={() => {
            const peerId = document.getElementById("peerId") as HTMLInputElement
            handleConnect(peerId.value)
          }}
        >
          Connect to Peer
        </Button>
      </div>
    </section>
  )
}
