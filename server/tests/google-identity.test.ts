import { beforeEach, expect, it, vi } from "vitest";

const verifyIdToken = vi.hoisted(() => vi.fn());
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));
vi.mock("../src/config/env.js", () => ({
  env: { GOOGLE_CLIENT_ID: "test-web-client.apps.googleusercontent.com" },
}));

import { verifyGoogleIdentity } from "../src/modules/auth/google-identity.service.js";

beforeEach(() => {
  vi.resetAllMocks();
  verifyIdToken.mockResolvedValue({ getPayload: () => ({
    sub: "stable-google-sub", email: "Staff@Example.com", email_verified: true,
    name: "  Nguyen Van A  ",
  }) });
});

it("verifies the ID token for the server-configured Google client and uses sub", async () => {
  expect(await verifyGoogleIdentity("id-token")).toEqual({
    sub: "stable-google-sub", email: "staff@example.com", name: "Nguyen Van A",
  });
  expect(verifyIdToken).toHaveBeenCalledWith({
    idToken: "id-token", audience: "test-web-client.apps.googleusercontent.com",
  });
});

it.each([
  { sub: "stable-google-sub", email: "staff@example.com", email_verified: false },
  { sub: "", email: "staff@example.com", email_verified: true },
  { sub: "stable-google-sub", email: "", email_verified: true },
])("rejects an incomplete or unverified Google identity", async (payload) => {
  verifyIdToken.mockResolvedValue({ getPayload: () => payload });
  await expect(verifyGoogleIdentity("id-token")).rejects.toMatchObject({
    code: "INVALID_GOOGLE_TOKEN",
  });
});

it("maps Google verification failures to a safe authentication error", async () => {
  verifyIdToken.mockRejectedValue(new Error("sensitive verifier details"));
  await expect(verifyGoogleIdentity("bad-token")).rejects.toMatchObject({
    code: "INVALID_GOOGLE_TOKEN",
  });
});
