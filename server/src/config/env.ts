import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters"),

  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  AUTH_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_SESSION_CLEANUP_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  AUTH_SESSION_CLEANUP_BATCH_SIZE: z.coerce.number().int().min(10).max(5000).default(500),

  MAIL_USER: z.string().email().optional(),
  MAIL_APP_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM_NAME: z.string().default("TicketBox QR"),

  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_EVENT_FOLDER: z.string().min(1).default("ticketbox/events"),

  SEED_ADMIN_NAME: z.string().min(1).default("Admin"),
  SEED_ADMIN_EMAIL: z.string().email().default("admin@ticketbox.local"),
  SEED_STAFF_NAME: z.string().min(1).default("Staff"),
  SEED_STAFF_EMAIL: z.string().email().default("staff@ticketbox.local"),
  SEED_DEFAULT_PASSWORD: z.string().min(8).default("ticketbox@123"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    "Invalid environment variables:",
    result.error.flatten().fieldErrors,
  );

  throw new Error("Environment configuration is invalid");
}

export const env = result.data;
