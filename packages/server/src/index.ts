import type { InSignalMessage, OutSignalMessage } from "@rtco/client";
import { LogLevel, Logger } from "@rtco/logger";
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
  #logger: Logger;
  #server: Server;
  #peers: Map<string, Socket> = new Map();
  #rooms: Map<string, Set<string>> = new Map();

  constructor(options?: Partial<ArticoServerOptions>) {
    this.#logger = new Logger("[artico]", options?.debug ?? LogLevel.Errors);
    this.#logger.debug("new ArticoServer:", options);

    const socketOptions = options?.serverOptions ?? {
      transports: ["websocket"],
      cors: {
        origin: "*",
      },
    };
    const server = new Server(socketOptions);
    this.#server = server;

    server.on("connection", (socket) => {
      const { id } = socket.handshake.query;
      this.#logger.log("connection:", id);

      if (!id || typeof id !== "string") {
        socket.emit("error", "invalid-id");
        socket.disconnect(true);
        return;
      }

      if (this.#peers.has(id)) {
        socket.emit("error", "id-taken");
        socket.disconnect(true);
        return;
      }

      socket.emit("open", id);

      this.#peers.set(id, socket);

      socket.on("disconnect", () => {
        this.#logger.log("disconnected:", id);
        this.#peers.delete(id);
      });

      socket.on("signal", (msg: OutSignalMessage) => {
        this.#logger.debug("signal:", msg);
        const withSource: InSignalMessage = {
          ...msg,
          source: id,
        };
        this.#peers.get(msg.target)?.emit("signal", withSource);
      });

      socket.on("join", (roomId: string, metadata?: string) => {
        this.#logger.debug(`peer ${id} joins room ${roomId}`);
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
