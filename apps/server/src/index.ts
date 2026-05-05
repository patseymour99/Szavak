import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import staticPlugin from "@fastify/static";
import { Server as IOServer } from "socket.io";
import { allowedOrigins, env } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProfileRoutes } from "./routes/profiles.js";
import { registerPuzzleRoutes } from "./routes/puzzles.js";
import { registerLeaderboardRoutes } from "./routes/leaderboard.js";
import { attachCollab } from "./sockets/collab.js";
import { startDailyScheduler } from "./scheduler/dailyPuzzle.js";

async function main() {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("origin_not_allowed"), false);
    },
    credentials: true,
  });

  app.get("/api/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerProfileRoutes(app);
  await registerPuzzleRoutes(app);
  await registerLeaderboardRoutes(app);

  // Serve the built React app from the Fastify process in production.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const webDist = path.resolve(__dirname, "../../web/dist");
  if (existsSync(webDist)) {
    // wildcard: true (default) registers a `/*` route so nested files like
    // /assets/index-XXXX.js are served. Falls through to the notFoundHandler
    // below for unknown paths, which serves index.html for SPA routing.
    await app.register(staticPlugin, { root: webDist, prefix: "/" });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api") && !req.url.startsWith("/socket.io")) {
        reply.type("text/html").sendFile("index.html");
        return;
      }
      reply.code(404).send({ error: "not_found" });
    });
  }

  await app.listen({ port: env.PORT, host: env.HOST });

  const io = new IOServer(app.server, {
    cors: { origin: allowedOrigins, credentials: true },
  });
  attachCollab(io);

  startDailyScheduler();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
