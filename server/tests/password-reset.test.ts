import express from "express";
import request from "supertest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  findActiveUserById: vi.fn(), findUserByEmail: vi.fn(), findGoogleStaffBySub: vi.fn(), registerPendingGoogleStaff: vi.fn(),
  lockActiveAdmin: vi.fn(), replacePasswordAndRevokeSessions: vi.fn(), updateAdminFullName: vi.fn(),
  transaction: vi.fn(async (work: (connection: unknown) => Promise<unknown>) => work({ connection: true })),
}));
const mail = vi.hoisted(() => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("../src/modules/auth/auth.repository.js", () => repository);
vi.mock("../src/modules/auth/auth-session.repository.js", () => ({ createSession: vi.fn(), lockSession: vi.fn(), replaceSession: vi.fn(), revokeSession: vi.fn(), pool: {} }));
vi.mock("../src/services/mail.service.js", () => mail);

import bcrypt from "bcrypt";

import { authRouter } from "../src/modules/auth/auth.routes.js";
import { confirmPasswordReset, requestPasswordReset } from "../src/modules/auth/auth.service.js";
import { RESET_TTL_MINUTES, createResetToken, parseResetToken, verifyResetToken } from "../src/modules/auth/password-reset-token.js";
import { errorHandler } from "../src/middlewares/error-handler.js";

const HASH = "$2b$04$abcdefghijklmnopqrstuuS2b0M3nYdQm4m3z6JcO6qQe1r8m0u1y"; // opaque stored hash
const admin = { id: 7, full_name: "Admin", email: "admin@example.com", role: "admin", is_active: 1, password_hash: HASH };
const flush = () => new Promise((resolve) => setImmediate(resolve));
let ipCounter = 0;
const nextIp = () => `10.0.0.${++ipCounter}`;

beforeEach(() => {
  vi.clearAllMocks();
  mail.sendPasswordResetEmail.mockResolvedValue(undefined);
  repository.replacePasswordAndRevokeSessions.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

it("tokens are bound to the account, its current password hash and a 30-minute expiry", () => {
  const now = new Date("2026-10-19T03:00:00Z");
  const { token, expiresAt } = createResetToken(7, HASH, now);
  expect(expiresAt.getTime() - now.getTime()).toBe(RESET_TTL_MINUTES * 60_000);
  const parsed = parseResetToken(token)!;
  expect(parsed.userId).toBe(7);
  expect(verifyResetToken(parsed, HASH, now)).toBe(true);
  expect(verifyResetToken(parsed, `${HASH}x`, now)).toBe(false); // password changed -> single use
  expect(verifyResetToken(parsed, HASH, expiresAt)).toBe(false); // expired
  expect(verifyResetToken({ ...parsed, userId: 8 }, HASH, now)).toBe(false); // another account
  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  expect(verifyResetToken(parseResetToken(tampered)!, HASH, now)).toBe(false);
  for (const bad of ["", "7.123.abc", "0.1760000000.x", `7.1760000000.${"a".repeat(42)}`, `${token}.extra`]) expect(parseResetToken(bad)).toBeNull();
});

it("mails a link with the token in the #fragment only to an active Admin with a password", async () => {
  repository.findUserByEmail.mockResolvedValue(admin);
  await requestPasswordReset({ email: "admin@example.com" }, nextIp());
  await flush();
  expect(mail.sendPasswordResetEmail).toHaveBeenCalledOnce();
  const { link, recipient, ttlMinutes } = mail.sendPasswordResetEmail.mock.calls[0]![0];
  expect(recipient).toBe("admin@example.com");
  expect(ttlMinutes).toBe(30);
  const url = new URL(link);
  expect(url.pathname).toBe("/reset-password");
  expect(url.search).toBe("");
  const token = decodeURIComponent(url.hash.replace("#token=", ""));
  expect(verifyResetToken(parseResetToken(token)!, HASH)).toBe(true);
});

it.each([
  ["unknown email", null],
  ["Staff account", { ...admin, role: "staff" }],
  ["disabled Admin", { ...admin, is_active: 0 }],
  ["Admin without a local password", { ...admin, password_hash: null }],
])("sends nothing for %s (and does not say so)", async (_label, user) => {
  repository.findUserByEmail.mockResolvedValue(user);
  await expect(requestPasswordReset({ email: `x${ipCounter}@example.com` }, nextIp())).resolves.toBeUndefined();
  await flush();
  expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
});

it("a repeat request inside the email cooldown sends no second mail and still answers neutrally", async () => {
  repository.findUserByEmail.mockResolvedValue(admin);
  await requestPasswordReset({ email: "cooldown@example.com" }, nextIp());
  await requestPasswordReset({ email: "cooldown@example.com" }, nextIp());
  await flush();
  expect(mail.sendPasswordResetEmail).toHaveBeenCalledOnce();
});

it("a mail failure is logged without the address or the link", async () => {
  repository.findUserByEmail.mockResolvedValue(admin);
  mail.sendPasswordResetEmail.mockRejectedValue(new Error("SMTP refused admin@example.com"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await requestPasswordReset({ email: "fail@example.com" }, nextIp());
  await flush(); await flush();
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/example\.com|reset-password|token/);
  log.mockRestore();
});

it("confirm sets the new password and revokes sessions; the same link then fails", async () => {
  const realHash = await bcrypt.hash("old-pass-1!", 4);
  const { token } = createResetToken(7, realHash);
  repository.lockActiveAdmin.mockResolvedValue({ ...admin, password_hash: realHash });
  await confirmPasswordReset({ token, newPassword: "new-pass-2@" });
  expect(repository.lockActiveAdmin).toHaveBeenCalledWith(expect.anything(), 7);
  const [, userId, nextHash] = repository.replacePasswordAndRevokeSessions.mock.calls[0]!;
  expect(userId).toBe(7);
  expect(await bcrypt.compare("new-pass-2@", nextHash)).toBe(true);
  repository.lockActiveAdmin.mockResolvedValue({ ...admin, password_hash: nextHash });
  await expect(confirmPasswordReset({ token, newPassword: "another-3#" })).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
});

it("confirm refuses expired, foreign, Staff/disabled and same-password resets", async () => {
  const realHash = await bcrypt.hash("old-pass-1!", 4);
  repository.lockActiveAdmin.mockResolvedValue({ ...admin, password_hash: realHash });
  const expired = createResetToken(7, realHash, new Date(Date.now() - 31 * 60_000)).token;
  await expect(confirmPasswordReset({ token: expired, newPassword: "new-pass-2@" })).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
  await expect(confirmPasswordReset({ token: "garbage-token-value-123", newPassword: "new-pass-2@" })).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
  await expect(confirmPasswordReset({ token: createResetToken(7, realHash).token, newPassword: "old-pass-1!" })).rejects.toMatchObject({ code: "PASSWORD_REUSED" });
  repository.lockActiveAdmin.mockResolvedValue(null); // Staff id or disabled Admin: lockActiveAdmin finds no active Admin
  await expect(confirmPasswordReset({ token: createResetToken(9, realHash).token, newPassword: "new-pass-2@" })).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
  expect(repository.replacePasswordAndRevokeSessions).not.toHaveBeenCalled();
});

it("routes: identical answer for known and unknown emails, validation and password rules on confirm", async () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.use(errorHandler);
  repository.findUserByEmail.mockResolvedValueOnce(admin).mockResolvedValueOnce(null);
  const known = await request(app).post("/auth/password-reset/request").send({ email: "route-known@example.com" });
  const unknown = await request(app).post("/auth/password-reset/request").send({ email: "route-unknown@example.com" });
  expect(known.status).toBe(202);
  expect(unknown.status).toBe(202);
  expect(unknown.body).toEqual(known.body);
  expect((await request(app).post("/auth/password-reset/request").send({ email: "nope" })).status).toBe(400);
  expect((await request(app).post("/auth/password-reset/confirm").send({ token: "x".repeat(30), newPassword: "short" })).status).toBe(400);
  const realHash = await bcrypt.hash("old-pass-1!", 4);
  repository.lockActiveAdmin.mockResolvedValue({ ...admin, password_hash: realHash });
  const ok = await request(app).post("/auth/password-reset/confirm").send({ token: createResetToken(7, realHash).token, newPassword: "new-pass-2@" });
  expect(ok.status).toBe(200);
  expect(String(ok.headers["set-cookie"] ?? "")).toMatch(/ticketbox_refresh=;/);
});
