import type { InSignalMessage, OutSignalMessage } from "@rtco/client";
import { LogLevel, Logger } from "@rtco/logger";
import type { ServerOptions, Socket } from "socket.io";
import { Server } from "socket.io";

import type { Server as NodeServer } from "node:http";
import type { Server as HTTPSServer } from "node:https";
import type { Http2SecureServer, Http2Server } from "node:http2";

type HttpServerInstance =
  | NodeServer
  | HTTPSServer
  | Http2Server
  | Http2SecureServer;

export type ArticoServerOptions = {
  /**
   * The log level for the server.
   * @default LogLevel.Errors
   */
  debug: LogLevel;
  /**
   * Options for creating the Socket.IO server.
   * @default { transports: ["websocket"], cors: { origin: "*" } }
   */
  ioOptions: ServerOptions;
  /**
   * An existing HTTP server to attach the Socket.IO server to.
   */
  httpServer: HttpServerInstance;
};

interface IArticoServer {
  /** The underlying Socket.IO server */
  get server(): Server;
  /** Start listening on the specified port */
  listen(port: number): void;
}

export class ArticoServer implements IArticoServer {
  #logger: Logger;
  #httpServer?: HttpServerInstance;
  #server: Server;
  #peers: Map<string, Socket> = new Map();
  #rooms: Map<string, Set<string>> = new Map();

  constructor(options?: Partial<ArticoServerOptions>) {
    this.#logger = new Logger("[artico]", options?.debug ?? LogLevel.Errors);
    this.#logger.debug("new ArticoServer:", options);

    const ioOptions = options?.ioOptions ?? {
      transports: ["websocket"],
      cors: {
        origin: "*",
      },
    };

    if (options?.httpServer) {
      this.#httpServer = options.httpServer;
      this.#server = new Server(options.httpServer, ioOptions);
    } else {
      this.#server = new Server(ioOptions);
    }

    this.#server.on("connection", (socket) => {
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
    if (this.#httpServer) {
      this.#httpServer.listen(port);
    } else {
      this.server.listen(port);
    }
  };
}
