/// <reference path="../src/types/express.d.ts" />
import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../src/middlewares/authenticate.js", () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) { res.status(401).end(); return; }
    req.authUser = { id: Number(req.headers["x-test-user-id"] ?? 7), fullName: "Admin", email: "admin@example.com", role: req.headers.authorization === "admin" ? "admin" : "staff" };
    next();
  },
}));
const service = vi.hoisted(() => ({
  login: vi.fn(), loginWithGoogle: vi.fn(), getCurrentUser: vi.fn(), refreshSession: vi.fn(), logoutSession: vi.fn(),
  updateAdminProfile: vi.fn(), changeAdminPassword: vi.fn(),
}));
vi.mock("../src/modules/auth/auth.service.js", () => service);
import { authRouter } from "../src/modules/auth/auth.routes.js";

const app = express();
app.use(express.json());
app.use("/auth", authRouter);
app.use((error: { statusCode?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.statusCode ?? 500).json({ success: false, message: error.message }));

beforeEach(() => {
  vi.resetAllMocks();
  service.updateAdminProfile.mockResolvedValue({ id: 7, fullName: "Tên mới", email: "admin@example.com", role: "admin" });
  service.changeAdminPassword.mockResolvedValue(undefined);
});

it.each(["/auth/admin/profile", "/auth/admin/password"])("requires authentication for %s", async (path) => {
  expect((await request(app).patch(path).send({})).status).toBe(401);
});

it.each(["/auth/admin/profile", "/auth/admin/password"])("blocks Staff from %s", async (path) => {
  expect((await request(app).patch(path).set("Authorization", "staff").send({})).status).toBe(403);
});

it("updates only the authenticated Admin profile", async () => {
  const response = await request(app).patch("/auth/admin/profile").set("Authorization", "admin").send({ fullName: "  Tên mới  " });
  expect(response.status).toBe(200);
  expect(service.updateAdminProfile).toHaveBeenCalledWith(7, { fullName: "Tên mới" });
});

it.each([{ fullName: "" }, { fullName: "A" }, { fullName: "Admin", role: "staff" }])("rejects invalid profile payload %j", async (body) => {
  expect((await request(app).patch("/auth/admin/profile").set("Authorization", "admin").send(body)).status).toBe(400);
  expect(service.updateAdminProfile).not.toHaveBeenCalled();
});

it("validates and changes an Admin password", async () => {
  const body = { currentPassword: "OldPassword1", newPassword: "newpassword@2" };
  const response = await request(app).patch("/auth/admin/password").set("Authorization", "admin").set("X-Test-User-Id", "8").send(body);
  expect(response.status).toBe(200);
  expect(service.changeAdminPassword).toHaveBeenCalledWith(8, body);
});

it.each([
  { currentPassword: "OldPassword1", newPassword: "short" },
  { currentPassword: "OldPassword1", newPassword: "alllowercase" },
  { currentPassword: "OldPassword1", newPassword: "12345678" },
  { currentPassword: "OldPassword1", newPassword: "NoNumberHere" },
  { currentPassword: "OldPassword1", newPassword: "lowercase1" },
  { currentPassword: "OldPassword1", newPassword: "OldPassword1" },
])("rejects unsafe password payload %j", async (body) => {
  expect((await request(app).patch("/auth/admin/password").set("Authorization", "admin").set("X-Test-User-Id", "9").send(body)).status).toBe(400);
  expect(service.changeAdminPassword).not.toHaveBeenCalled();
});

it("allows only one successful password change per Admin account in 15 minutes", async () => {
  const body = { currentPassword: "OldPassword1", newPassword: "newpassword@2" };
  const first = await request(app).patch("/auth/admin/password").set("Authorization", "admin").set("X-Test-User-Id", "10").send(body);
  const second = await request(app).patch("/auth/admin/password").set("Authorization", "admin").set("X-Test-User-Id", "10").send(body);
  expect(first.status).toBe(200);
  expect(second.status).toBe(429);
  expect(second.body.code).toBe("PASSWORD_CHANGE_RATE_LIMIT");
});
