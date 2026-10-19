/// <reference path="../src/types/express.d.ts" />
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/middlewares/authenticate.js", () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

const service = vi.hoisted(() => ({
  getPlatformSettings: vi.fn(),
  saveVenue: vi.fn(),
  saveCategoryScope: vi.fn(),
}));
vi.mock("../src/modules/platform-settings/platform-settings.service.js", () => service);

import { adminPlatformSettingsRouter } from "../src/modules/platform-settings/platform-settings.routes.js";

const app = express();
app.use(express.json());
app.use("/admin/platform-settings", adminPlatformSettingsRouter);
app.use((err: { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.statusCode ?? 500).json({ code: err.code });
});

const venue = { name: "Hall", address: "1 Street", city: "City", capacity: 500 };
const settings = { venue, categoryScope: "music_only", outOfSyncEventCount: 0, updatedAt: null, updatedBy: null };

beforeEach(() => {
  vi.resetAllMocks();
  service.getPlatformSettings.mockResolvedValue(settings);
  service.saveVenue.mockResolvedValue(settings);
  service.saveCategoryScope.mockResolvedValue(settings);
});

describe("Admin platform settings access control", () => {
  it.each([
    ["get", "/admin/platform-settings"],
    ["put", "/admin/platform-settings/venue"],
    ["put", "/admin/platform-settings/category-scope"],
  ] as const)("rejects an anonymous %s %s with 401 and a Staff caller with 403", async (method, path) => {
    expect((await request(app)[method](path).send({})).status).toBe(401);
    expect((await request(app)[method](path).set("Authorization", "staff").send({})).status).toBe(403);
    expect(service.getPlatformSettings).not.toHaveBeenCalled();
    expect(service.saveVenue).not.toHaveBeenCalled();
    expect(service.saveCategoryScope).not.toHaveBeenCalled();
  });

  it("lets an Admin read the settings", async () => {
    const response = await request(app).get("/admin/platform-settings").set("Authorization", "admin");
    expect(response.status).toBe(200);
    expect(response.body.data.categoryScope).toBe("music_only");
  });
});

describe("Admin venue validation", () => {
  it("saves a valid venue under the authenticated Admin id, never a client-supplied one", async () => {
    const response = await request(app).put("/admin/platform-settings/venue")
      .set("Authorization", "admin").send(venue);
    expect(response.status).toBe(200);
    expect(service.saveVenue).toHaveBeenCalledWith(7, venue);
  });

  it.each([
    ["blank name", { ...venue, name: "   " }],
    ["missing city", { name: venue.name, address: venue.address, capacity: 500 }],
    ["zero capacity", { ...venue, capacity: 0 }],
    ["fractional capacity", { ...venue, capacity: 10.5 }],
    ["capacity as text", { ...venue, capacity: "500" }],
    ["unknown field", { ...venue, updatedBy: 99 }],
  ])("rejects %s with 400", async (_label, body) => {
    const response = await request(app).put("/admin/platform-settings/venue")
      .set("Authorization", "admin").send(body);
    expect(response.status).toBe(400);
    expect(service.saveVenue).not.toHaveBeenCalled();
  });
});

describe("Admin category scope validation", () => {
  it.each(["music_only", "all"])("accepts %s", async (scope) => {
    const response = await request(app).put("/admin/platform-settings/category-scope")
      .set("Authorization", "admin").send({ scope });
    expect(response.status).toBe(200);
    expect(service.saveCategoryScope).toHaveBeenCalledWith(7, { scope });
  });

  it.each([{ scope: "everything" }, {}, { scope: "all", extra: true }])("rejects %j with 400", async (body) => {
    const response = await request(app).put("/admin/platform-settings/category-scope")
      .set("Authorization", "admin").send(body);
    expect(response.status).toBe(400);
    expect(service.saveCategoryScope).not.toHaveBeenCalled();
  });
});
