/// <reference path="../src/types/express.d.ts" />
import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../src/middlewares/authenticate.js", () => ({
  authenticate: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!req.headers.authorization) {
      res.status(401).end();
      return;
    }
    req.authUser = {
      id: 7,
      fullName: "Test Admin",
      email: "admin@example.com",
      role: req.headers.authorization === "admin" ? "admin" : "staff",
    };
    next();
  },
}));

const mockService = vi.hoisted(() => ({
  getAdminDashboardSummary: vi.fn(),
}));

vi.mock(
  "../src/modules/dashboard/admin-dashboard.service.js",
  () => mockService,
);

import { adminDashboardRouter } from "../src/modules/dashboard/admin-dashboard.routes.js";

const app = express();
app.use("/admin/dashboard", adminDashboardRouter);
app.use(
  (
    err: { statusCode?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(err.statusCode ?? 500).end();
  },
);

beforeEach(() => {
  vi.resetAllMocks();
  mockService.getAdminDashboardSummary.mockResolvedValue({
    events: { active: 3, draft: 1, scheduled: 0, hidden: 0, failedScheduled: 0 },
    tickets: { issued: 15 },
    checkins: { todaySuccess: 8 },
    staff: { activeOnDuty: 4, pendingApproval: 2 },
    orders: { confirmed: 10, pending: 2, totalRevenue: 1500000 },
    refunds: { pendingCount: 1, pendingAmount: 150000 },
    alerts: { unstaffedUpcomingEvents: [], scheduledPublishFailedEvents: [] },
  });
});

it("requires authentication for /summary", async () => {
  const res = await request(app).get("/admin/dashboard/summary");
  expect(res.status).toBe(401);
});

it("blocks staff from accessing /summary", async () => {
  const res = await request(app)
    .get("/admin/dashboard/summary")
    .set("Authorization", "staff");
  expect(res.status).toBe(403);
});

it("returns dashboard summary for admin with no-store caching", async () => {
  const res = await request(app)
    .get("/admin/dashboard/summary")
    .set("Authorization", "admin");

  expect(res.status).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.body.success).toBe(true);
  expect(res.body.data.events.active).toBe(3);
  expect(res.body.data.orders.totalRevenue).toBe(1500000);
  expect(mockService.getAdminDashboardSummary).toHaveBeenCalledTimes(1);
});

