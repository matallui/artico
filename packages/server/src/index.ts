import type { SignalData } from "@rtco/peer";
import { Server, type Socket } from "socket.io";

type Signal = {
  target: string;
  session: string;
  metadata: object;
  signal: SignalData;
};

export class ArticoServer {
  private _server: Server;
  private _peers: Map<string, Socket> = new Map();

  constructor() {
    const server = new Server({
      cors: {
        origin: "*",
      },
    });
    this._server = server;

    server.on("connection", (socket) => {
      const { id } = socket.handshake.query;
      console.log("New connection:", id);

      if (!id) {
        socket.emit("error", "No id provided");
        socket.disconnect(true);
        return;
      }

      if (typeof id !== "string") {
        socket.emit("error", "Invalid ID provided");
        socket.disconnect(true);
        return;
      }

      if (this._peers.has(id)) {
        socket.emit("error", "ID already in use");
        socket.disconnect(true);
        return;
      }

      socket.emit("message", {
        type: "open",
        src: id,
        payload: {},
      });
      this._peers.set(id, socket);

      socket.on("disconnect", () => {
        console.log("Disconnected:", id);
        this._peers.delete(id);
      });

      // Create room for peer
      socket.join(id);

      socket.on("offer", (data: Signal) => {
        const { target, session, metadata, signal } = data;
        console.log("Received offer:", data);

        socket.broadcast.to(target).emit("message", {
          type: "offer",
          src: id,
          payload: {
            session,
            metadata,
            signal,
          },
        });
      });

      socket.on("signal", (data: Signal) => {
        console.log("Received signal:", data);
        const { target, session, metadata, signal } = data;

        socket.broadcast.to(target).emit("message", {
          type: "signal",
          src: id,
          payload: {
            session,
            metadata,
            signal,
          },
        });
      });
    });
  }

  get server() {
    return this._server;
  }

  public listen = async (port: number) => {
    this.server.listen(port);
  };
}
