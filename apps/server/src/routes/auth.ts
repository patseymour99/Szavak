import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import {
  clearSessionCookie,
  getCurrentProfile,
  setSessionCookie,
  verifyPin,
} from "../auth.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/me", async (req) => {
    const profile = await getCurrentProfile(req);
    if (!profile) return { profile: null };
    return {
      profile: {
        id: profile.id,
        name: profile.name,
        color: profile.color,
        isAdmin: profile.isAdmin,
      },
    };
  });

  const LoginBody = z.object({
    profileId: z.string().min(1),
    pin: z.string().regex(/^\d{4}$/),
  });

  app.post("/api/auth/login", async (req, reply) => {
    const body = LoginBody.parse(req.body);
    const profile = await prisma.profile.findUnique({ where: { id: body.profileId } });
    if (!profile) return reply.code(401).send({ error: "invalid_credentials" });
    const ok = await verifyPin(body.pin, profile.pinHash);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });
    setSessionCookie(reply, profile.id);
    return {
      profile: {
        id: profile.id,
        name: profile.name,
        color: profile.color,
        isAdmin: profile.isAdmin,
      },
    };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
