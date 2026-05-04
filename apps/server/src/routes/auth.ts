import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import {
  clearSessionCookie,
  getCurrentProfile,
  hashPin,
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
    if (profile.pinHash === "") return reply.code(409).send({ error: "pin_not_set" });
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

  // First-use PIN setup: only succeeds if the profile has no PIN yet. Sets the
  // PIN and signs the user in.
  const SetupBody = z.object({
    profileId: z.string().min(1),
    pin: z.string().regex(/^\d{4}$/),
  });
  app.post("/api/auth/setup-pin", async (req, reply) => {
    const body = SetupBody.parse(req.body);
    const profile = await prisma.profile.findUnique({ where: { id: body.profileId } });
    if (!profile) return reply.code(404).send({ error: "not_found" });
    if (profile.pinHash !== "") return reply.code(409).send({ error: "pin_already_set" });
    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: { pinHash: await hashPin(body.pin) },
    });
    setSessionCookie(reply, updated.id);
    return {
      profile: {
        id: updated.id,
        name: updated.name,
        color: updated.color,
        isAdmin: updated.isAdmin,
      },
    };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
