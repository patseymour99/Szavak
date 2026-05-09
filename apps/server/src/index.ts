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
    // below for unknown paths.
    // setHeaders sends ACAO:* on every static response. Vite emits the
    // index.html with `crossorigin` on its <script type="module"> and
    // <link rel="stylesheet"> tags, which forces CORS mode even for
    // same-origin URLs in some browsers; without ACAO the resource is
    // rejected and React never mounts.
    await app.register(staticPlugin, {
      root: webDist,
      prefix: "/",
      setHeaders(res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== "GET" || req.url.startsWith("/api") || req.url.startsWith("/socket.io")) {
        reply.code(404).send({ error: "not_found", url: req.url });
        return;
      }
      // SPA fallback: only return index.html for extension-less paths
      // (which look like client-side routes). Real asset requests like
      // /assets/foo.js must return 404 if the file is genuinely missing,
      // not HTML — otherwise a deploy mismatch produces a silent failure.
      const last = req.url.split("?")[0].split("/").pop() || "";
      if (last.includes(".")) {
        reply.code(404).send({ error: "not_found", url: req.url });
        return;
      }
      reply.type("text/html").sendFile("index.html");
    });

    // Quick diagnostic: list what files actually shipped with the runtime
    // image. Invoking /api/debug/assets returns the dist tree, so we can
    // tell the difference between "Vite emitted a different hash than the
    // HTML references" and "the file is there but routing isn't matching".
    app.get("/api/debug/assets", async () => {
      const { readdir } = await import("node:fs/promises");
      const root = webDist;
      const top = await readdir(root, { withFileTypes: true });
      const out: Record<string, string[]> = { ".": [] };
      for (const e of top) {
        if (e.isDirectory()) {
          out[e.name] = await readdir(path.join(root, e.name));
        } else {
          out["."].push(e.name);
        }
      }
      return { webDist, files: out };
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
