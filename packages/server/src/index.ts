import type { InSignalMessage, OutSignalMessage } from "@rtco/client";
import logger, { LogLevel } from "@rtco/logger";
import type { ServerOptions, Socket } from "socket.io";
import { Server } from "socket.io";

export type ArticoServerOptions = {
  debug: LogLevel;
  serverOptions: ServerOptions;
};

interface IArticoServer {
  get server(): Server;
  listen(port: number): void;
}

export class ArticoServer implements IArticoServer {
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

      socket.on("signal", (msg: OutSignalMessage) => {
        const withSource: InSignalMessage = {
          ...msg,
          source: id,
        };
        this.#peers.get(msg.target)?.emit("signal", withSource);
      });

      socket.on("join", (roomId: string, metadata?: string) => {
        logger.debug(`Peer ${id} (${metadata}) asks to join room ${roomId}`);
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("join", roomId, id, metadata);
        if (!this.#rooms.has(roomId)) {
          this.#rooms.set(roomId, new Set());
        }
        this.#rooms.get(roomId)?.add(id);
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
