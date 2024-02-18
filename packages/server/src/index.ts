import type { SignalMessage } from "@rtco/client";
import logger, { LogLevel } from "@rtco/logger";
import type { ServerOptions, Socket } from "socket.io";
import { Server } from "socket.io";

export type ArticoServerOptions = {
  debug: LogLevel;
  serverOptions: ServerOptions;
};

export class ArticoServer {
  #server: Server;
  #peers: Map<string, Socket> = new Map();
  #rooms: Map<string, Set<string>> = new Map();

  constructor(options?: Partial<ArticoServerOptions>) {
    if (options?.debug) {
      logger.logLevel = options.debug;
    }
    const socketOptions = options?.serverOptions ?? {
      cors: {
        origin: "*",
      },
    };

    logger.debug("Socket.io server options:", socketOptions);

    const server = new Server(socketOptions);
    this.#server = server;

    server.on("connection", (socket) => {
      const { id } = socket.handshake.query;
      logger.log("New connection:", id);

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

      if (this.#peers.has(id)) {
        socket.emit("error", "ID already in use");
        socket.disconnect(true);
        return;
      }

      socket.emit("open", id);

      this.#peers.set(id, socket);

      socket.on("disconnect", () => {
        logger.log("Disconnected:", id);
        this.#peers.delete(id);
      });

      // Create room for peer
      socket.join(id);

      socket.on("signal", (msg: SignalMessage) => {
        switch (msg.type) {
          case "call":
          case "signal":
            logger.debug(`Received ${msg.type} from ${id} to ${msg.target}`);
            socket.broadcast.to(msg.target).emit("signal", {
              ...msg,
              source: id,
            } satisfies SignalMessage);
            break;
          default:
            logger.warn("Unknwon signal:", msg);
            break;
        }
      });

      socket.on("join", (roomId: string) => {
        logger.debug(`Peer ${id} asks to join room ${roomId}`);
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("join", roomId, id);
        if (!this.#rooms.has(roomId)) {
          this.#rooms.set(roomId, new Set());
        }
        this.#rooms.get(roomId)?.add(id);
      });

      socket.on("leave", (roomId: string) => {
        logger.debug(`Peer ${id} asks to leave room ${roomId}`);
        socket.broadcast.to(roomId).emit("leave", roomId, id);
        socket.leave(roomId);
        this.#rooms.get(roomId)?.delete(id);
      });
    });
  }

  get server() {
    return this.#server;
  }

  public listen = async (port: number) => {
    this.server.listen(port);
  };
}
