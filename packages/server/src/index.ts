import logger, { LogLevel } from "@rtco/logger";
import type { SignalData } from "@rtco/peer";
import type { ServerOptions, Socket } from "socket.io";
import { Server } from "socket.io";

export type SignalingMessage =
  | {
      type: "open";
      peerId: string;
    }
  | {
      type: "error";
      msg: string;
    }
  | {
      type: "offer" | "signal";
      source?: string;
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

      const msg: SignalingMessage = {
        type: "open",
        peerId: id,
      };
      socket.emit("message", msg);

      this.#peers.set(id, socket);

      socket.on("disconnect", () => {
        logger.log("Disconnected:", id);
        this.#peers.delete(id);
      });

      // Create room for peer
      socket.join(id);

      socket.on("message", (msg: SignalingMessage) => {
        switch (msg.type) {
          case "open":
            logger.warn("Ignoring open message from", id);
            break;
          case "error":
            logger.error("Ignoring error from", id, ":", msg.msg);
            break;
          case "offer":
            logger.debug("Received offer from", id, "to", msg.target);
          case "signal":
            logger.debug("Received signal from", id, "to", msg.target);
          default:
            socket.broadcast.to(msg.target).emit("message", {
              ...msg,
              source: id,
            } satisfies SignalingMessage);
        }
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
