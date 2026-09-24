/// <reference path="../src/types/express.d.ts" />
import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../src/middlewares/authenticate.js", () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) { res.status(401).json({ success: false }); return; }
    req.authUser = { id: 7, fullName: "Test", email: "admin@example.com",
      role: req.headers.authorization === "admin" ? "admin" : "staff" };
    next();
  },
}));
vi.mock("../src/middlewares/require-staff-schema.js", () => ({
  requireStaffSchema: (_req: express.Request, _res: express.Response,
    next: express.NextFunction) => next(),
}));
const service = vi.hoisted(() => ({
  listAdminStaff: vi.fn(), changeStaffStatus: vi.fn(), updateStaffProfile: vi.fn(),
  assignStaff: vi.fn(), revokeStaffAssignment: vi.fn(),
}));
vi.mock("../src/modules/admin-staff/admin-staff.service.js", () => service);

import { adminStaffRouter } from "../src/modules/admin-staff/admin-staff.routes.js";

const app = express();
app.use(express.json());
app.use("/api/admin/staff", adminStaffRouter);
app.use((error: { statusCode?: number }, _req: express.Request,
  res: express.Response, _next: express.NextFunction) => {
  res.status(error.statusCode ?? 500).json({ success: false });
});

beforeEach(() => {
  vi.resetAllMocks();
  service.listAdminStaff.mockResolvedValue([]);
  service.changeStaffStatus.mockResolvedValue({ staffId: 3 });
  service.assignStaff.mockResolvedValue({ assignmentId: 5 });
});

it("requires Admin authentication for Staff management", async () => {
  expect((await request(app).get("/api/admin/staff")).status).toBe(401);
  expect((await request(app).get("/api/admin/staff").set("Authorization", "staff")).status).toBe(403);
  expect(service.listAdminStaff).not.toHaveBeenCalled();
});

it("allows Admin to view the approval queue", async () => {
  expect((await request(app).get("/api/admin/staff").set("Authorization", "admin")).status).toBe(200);
  expect(service.listAdminStaff).toHaveBeenCalledOnce();
});

it("uses authenticated Admin ID to approve Staff", async () => {
  const response = await request(app).patch("/api/admin/staff/3/status")
    .set("Authorization", "admin").send({ action: "approve" });
  expect(response.status).toBe(200);
  expect(service.changeStaffStatus).toHaveBeenCalledWith(3, 7, "approve");
});

it("rejects invalid status actions and Event IDs", async () => {
  expect((await request(app).patch("/api/admin/staff/3/status")
    .set("Authorization", "admin").send({ action: "make_admin" })).status).toBe(400);
  expect((await request(app).post("/api/admin/staff/3/assignments")
    .set("Authorization", "admin").send({ eventId: -1 })).status).toBe(400);
  expect(service.changeStaffStatus).not.toHaveBeenCalled();
  expect(service.assignStaff).not.toHaveBeenCalled();
});

it("assigns only from an Admin session and validated Event ID", async () => {
  expect((await request(app).post("/api/admin/staff/3/assignments")
    .set("Authorization", "staff").send({ eventId: 9 })).status).toBe(403);
  const response = await request(app).post("/api/admin/staff/3/assignments")
    .set("Authorization", "admin").send({ eventId: 9 });
  expect(response.status).toBe(201);
  expect(service.assignStaff).toHaveBeenCalledWith(3, 9, 7);
});
