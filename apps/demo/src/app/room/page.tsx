"use client";

import React from "react";
import { RoomDemo } from "./demo";

export default function RoomPage() {
  return (
    <div className="flex flex-col items-center gap-9 py-20">
      <h1 className="text-4xl">Room Demo</h1>
      <RoomDemo />
    </div>
  );
}
