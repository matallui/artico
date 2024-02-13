import logger, { LogLevel } from "@rtco/logger";
import type { SignalData } from "@rtco/peer";
import { Server, type Socket, type ServerOptions } from "socket.io";

type Signal = {
  target: string;
  session: string;
  metadata: object;
  signal: SignalData;
};

export type ArticoServerOptions = {
  debug: LogLevel;
  serverOptions: ServerOptions;
};

export class ArticoServer {
  #server: Server;
  #peers: Map<string, Socket> = new Map();

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

      socket.emit("message", {
        type: "open",
        src: id,
        payload: {},
      });
      this.#peers.set(id, socket);

      socket.on("disconnect", () => {
        logger.log("Disconnected:", id);
        this.#peers.delete(id);
      });

      // Create room for peer
      socket.join(id);

      socket.on("offer", (data: Signal) => {
        const { target, session, metadata, signal } = data;
        logger.debug("Received offer:", id, target);

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
        logger.debug("Received signal:", data);
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
    return this.#server;
  }

  public listen = async (port: number) => {
    this.server.listen(port);
  };
}
