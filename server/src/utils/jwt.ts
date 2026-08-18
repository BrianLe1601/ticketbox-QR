import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env.js";

const tokenPayloadSchema = z.object({
  userId: z.number().int().positive(),
  email: z.string().email(),
  role: z.enum(["admin", "staff"]),
});

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;

export function signAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as JwtExpiresIn,
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  return tokenPayloadSchema.parse(decoded);
}