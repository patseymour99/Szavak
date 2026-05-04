import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPin, requireProfile } from "../auth.js";
import { env } from "../config.js";

const PROFILE_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export async function registerProfileRoutes(app: FastifyInstance) {
  // Public: list profiles for the login picker (id, name, color, hasPin only).
  app.get("/api/profiles", async () => {
    const rows = await prisma.profile.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, color: true, pinHash: true },
    });
    return {
      profiles: rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hasPin: r.pinHash !== "",
      })),
    };
  });

  const CreateBody = z.object({
    name: z.string().min(1).max(40),
    pin: z.string().regex(/^\d{4}$/),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    bootstrapPin: z.string().regex(/^\d{4}$/).optional(),
  });

  app.post("/api/profiles", async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const existingCount = await prisma.profile.count();
    let isAdmin = false;
    if (existingCount === 0) {
      // Bootstrap: the very first profile is admin, gated by ADMIN_BOOTSTRAP_PIN.
      if (body.bootstrapPin !== env.ADMIN_BOOTSTRAP_PIN) {
        return reply.code(403).send({ error: "invalid_bootstrap_pin" });
      }
      isAdmin = true;
    } else {
      // Subsequent profiles: must be created by an admin.
      const me = await requireProfile(req, reply);
      if (!me) return;
      if (!me.isAdmin) {
        return reply.code(403).send({ error: "admin_required" });
      }
    }
    const taken = await prisma.profile.findUnique({ where: { name: body.name } });
    if (taken) return reply.code(409).send({ error: "name_taken" });
    const color = body.color ?? PROFILE_COLORS[existingCount % PROFILE_COLORS.length];
    const profile = await prisma.profile.create({
      data: {
        name: body.name,
        pinHash: await hashPin(body.pin),
        color,
        isAdmin,
      },
      select: { id: true, name: true, color: true, isAdmin: true },
    });
    return { profile };
  });

  app.delete("/api/profiles/:id", async (req, reply) => {
    const me = await requireProfile(req, reply);
    if (!me) return;
    if (!me.isAdmin) return reply.code(403).send({ error: "admin_required" });
    const params = z.object({ id: z.string() }).parse(req.params);
    if (params.id === me.id) return reply.code(400).send({ error: "cannot_delete_self" });
    await prisma.profile.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
