import { beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ verifyGoogleIdentity: vi.fn() }));
const repository = vi.hoisted(() => ({
  findActiveUserById: vi.fn(), findUserByEmail: vi.fn(),
  findGoogleStaffBySub: vi.fn(), registerPendingGoogleStaff: vi.fn(),
}));
const sessions = vi.hoisted(() => ({
  createSession: vi.fn(), lockSession: vi.fn(), replaceSession: vi.fn(),
  revokeSession: vi.fn(), pool: { getConnection: vi.fn() },
}));
vi.mock("../src/modules/auth/google-identity.service.js", () => identity);
vi.mock("../src/modules/auth/auth.repository.js", () => repository);
vi.mock("../src/modules/auth/auth-session.repository.js", () => sessions);

import { loginWithGoogle } from "../src/modules/auth/auth.service.js";

const metadata = { userAgent: "test", ip: "127.0.0.1" };
const identityData = { sub: "google-123", email: "staff@example.com", name: "Staff Test" };
const account = {
  id: 10, full_name: "Staff Test", email: "staff@example.com", role: "staff",
  password_hash: null, google_sub: "google-123", is_active: 0,
  staff_approval_status: "pending",
};

beforeEach(() => {
  vi.resetAllMocks();
  identity.verifyGoogleIdentity.mockResolvedValue(identityData);
  repository.findGoogleStaffBySub.mockResolvedValue(null);
  repository.registerPendingGoogleStaff.mockResolvedValue(account);
  sessions.createSession.mockResolvedValue(undefined);
});

it("registers a verified Google identity as pending without an app session", async () => {
  const result = await loginWithGoogle("valid-id-token", metadata);
  expect(result).toEqual({ status: "pending" });
  expect(repository.registerPendingGoogleStaff).toHaveBeenCalledWith(identityData);
  expect(sessions.createSession).not.toHaveBeenCalled();
});

it("keeps a pending account pending on repeat Google sign-in", async () => {
  repository.findGoogleStaffBySub.mockResolvedValue(account);
  const result = await loginWithGoogle("valid-id-token", metadata);
  expect(result.status).toBe("pending");
  expect(repository.registerPendingGoogleStaff).not.toHaveBeenCalled();
});

it("issues a Staff session only after Admin approval and activation", async () => {
  repository.findGoogleStaffBySub.mockResolvedValue({
    ...account, is_active: 1, staff_approval_status: "approved",
  });
  const result = await loginWithGoogle("valid-id-token", metadata);
  expect(result.status).toBe("approved");
  expect(sessions.createSession).toHaveBeenCalledOnce();
  if (result.status === "approved") expect(result.session.user.role).toBe("staff");
});

it.each([
  ["rejected", 0, "STAFF_NOT_APPROVED"],
  ["approved", 0, "ACCOUNT_DISABLED"],
] as const)("does not issue a session for %s/inactive=%s", async (status, active, code) => {
  repository.findGoogleStaffBySub.mockResolvedValue({
    ...account, is_active: active, staff_approval_status: status,
  });
  await expect(loginWithGoogle("valid-id-token", metadata)).rejects.toMatchObject({ code });
  expect(sessions.createSession).not.toHaveBeenCalled();
});

it("does not automatically link a Google identity to an existing email account", async () => {
  repository.registerPendingGoogleStaff.mockResolvedValue(null);
  await expect(loginWithGoogle("valid-id-token", metadata)).rejects.toMatchObject({
    code: "GOOGLE_EMAIL_CONFLICT",
  });
  expect(sessions.createSession).not.toHaveBeenCalled();
});

it("rejects an invalid Google token before touching local accounts", async () => {
  identity.verifyGoogleIdentity.mockRejectedValue(new Error("invalid token"));
  await expect(loginWithGoogle("invalid", metadata)).rejects.toThrow("invalid token");
  expect(repository.findGoogleStaffBySub).not.toHaveBeenCalled();
});
