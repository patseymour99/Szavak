import bcrypt from "bcryptjs";
import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db/prisma.js";

const SESSION_COOKIE = "szavak_session";

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 8);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function setSessionCookie(reply: FastifyReply, profileId: string) {
  reply.setCookie(SESSION_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    signed: true,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getCurrentProfile(req: FastifyRequest) {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;
  return prisma.profile.findUnique({ where: { id: unsigned.value } });
}

export async function requireProfile(req: FastifyRequest, reply: FastifyReply) {
  const profile = await getCurrentProfile(req);
  if (!profile) {
    reply.code(401).send({ error: "not_authenticated" });
    return null;
  }
  return profile;
}
