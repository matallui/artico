import { useEffect } from "react";
import "./App.css";
import Peer from "@rtco/peer";

function App() {
  useEffect(() => {
    const peerA = new Peer({
      initiator: true,
    });

    const peerB = new Peer();

    peerA.on("signal", (signal) => {
      console.log("peerA signal:", signal);
      peerB.signal(signal);
    });

    peerB.on("signal", (signal) => {
      console.log("peerB signal:", signal);
      peerA.signal(signal);
    });

    peerA.on("connect", () => {
      console.log("peerA connected");
      peerA.send("Hello, peerB!");
    });

    peerB.on("data", (data) => {
      console.log("peerB received:", data);
    });

    peerB.on("connect", () => {
      console.log("peerB connected");
      peerB.send("Hello, peerA!");
    });

    peerA.on("data", (data) => {
      console.log("peerA received:", data);
    });

    return () => {
      peerA.destroy();
      peerB.destroy();
    };
  }, []);

  return (
    <div>
      <h1>Peer Example</h1>
    </div>
  );
}

export default App;
