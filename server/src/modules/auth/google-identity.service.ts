import { OAuth2Client } from "google-auth-library";

import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

export async function verifyGoogleIdentity(idToken: string): Promise<VerifiedGoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "Đăng nhập Google chưa được cấu hình", "GOOGLE_NOT_CONFIGURED");
  }

  try {
    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error("Missing verified Google identity");
    }
    const email = payload.email.trim().toLowerCase();
    if (email.length > 150 || payload.sub.length > 255) {
      throw new Error("Google identity exceeds database limits");
    }
    return {
      sub: payload.sub,
      email,
      name: (payload.name?.trim() || email.split("@")[0] || "Staff").slice(0, 100),
    };
  } catch {
    throw new AppError(401, "Không xác minh được tài khoản Google", "INVALID_GOOGLE_TOKEN");
  }
}
