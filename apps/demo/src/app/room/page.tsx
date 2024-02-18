"use client";

import React from "react";
import Artico, { Room } from "@rtco/client";

export default function RoomPage() {
  const room = React.useRef<Room>();

  React.useEffect(() => {
    const artico = new Artico({ debug: 4 });

    artico.on("open", (id) => {
      console.log("open", id);
      room.current = artico.join("awesome-room");
    });

    artico.on("close", () => {
      console.log("close");
    });

    artico.on("error", (err) => {
      console.error(err);
    });

    return () => {
      room.current?.leave();
      room.current = undefined;
      artico.close();
    };
  }, []);
  return (
    <div className="flex flex-col items-center gap-6 py-20">
      <h1 className="text-4xl">Room Demo</h1>
      <p>Coming soon...</p>
    </div>
  );
}
