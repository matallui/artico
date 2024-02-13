import { ArticoServer } from "@rtco/server";

const port = Number(process.env.PORT) || 9000;

console.log("Starting Artico server...");

const server = new ArticoServer({ debug: 4 });

console.log("Artico server listening on port", port);
server.listen(port);
