import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("file:./prisma/dev.db"),
  SESSION_SECRET: z.string().default("dev-secret-change-me"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  /** comma-separated allowed origins for CORS in addition to WEB_ORIGIN */
  EXTRA_ORIGINS: z.string().default(""),
  /** PIN required to access the admin endpoints when no admin profile exists yet */
  ADMIN_BOOTSTRAP_PIN: z.string().regex(/^\d{4}$/).default("0000"),
  TIMEZONE: z.string().default("Europe/Budapest"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = Env.parse(process.env);

export const allowedOrigins = [env.WEB_ORIGIN, ...env.EXTRA_ORIGINS.split(",").filter(Boolean)];
