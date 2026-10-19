/// <reference path="../src/types/express.d.ts" />
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/middlewares/authenticate.js", () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) { res.status(401).end(); return; }
    req.authUser = { id: 7, fullName: "Test Admin", email: "admin@example.com", role: req.headers.authorization === "admin" ? "admin" : "staff" };
    next();
  },
}));

const repository = vi.hoisted(() => ({
  listCategories: vi.fn(),
  findCategory: vi.fn(),
  findCategoryBySlug: vi.fn(),
  updateCategoryRecord: vi.fn(),
}));
vi.mock("../src/modules/categories/admin-categories.repository.js", () => repository);

import { adminCategoriesRouter } from "../src/modules/categories/admin-categories.routes.js";

const app = express();
app.use(express.json());
app.use("/admin/categories", adminCategoriesRouter);
app.use((err: { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.statusCode ?? 500).json({ code: err.code });
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 3, name: "Jazz", slug: "jazz", description: null, icon: "music", kind: "music", is_active: 1, sort_order: 100, event_count: 0, ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  repository.listCategories.mockResolvedValue([row(), row({ id: 30, name: "Conferences", slug: "conference", kind: "other", is_active: 0 })]);
  repository.findCategory.mockResolvedValue(row());
});

describe("Admin genre catalogue", () => {
  it("lists genres with the catalogue flag and the new-Event decision", async () => {
    const response = await request(app).get("/admin/categories?includeInactive=true").set("Authorization", "admin");
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ slug: "jazz", catalog: true, selectableForNewEvent: true });
    expect(response.body.data[1]).toMatchObject({ slug: "conference", catalog: false, selectableForNewEvent: false });
  });

  it.each([["post", "/admin/categories"], ["delete", "/admin/categories/3"]] as const)(
    "refuses %s %s with 409 CATEGORY_CATALOG_FIXED", async (method, path) => {
      const response = await request(app)[method](path).set("Authorization", "admin").send({ name: "Hội thảo", slug: "hoi-thao" });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("CATEGORY_CATALOG_FIXED");
      expect(repository.updateCategoryRecord).not.toHaveBeenCalled();
    },
  );

  it("refuses anonymous and Staff callers before anything else", async () => {
    expect((await request(app).post("/admin/categories").send({})).status).toBe(401);
    expect((await request(app).post("/admin/categories").set("Authorization", "staff").send({})).status).toBe(403);
  });

  it("switches a genre off and reorders it", async () => {
    const response = await request(app).patch("/admin/categories/3").set("Authorization", "admin").send({ isActive: false, sortOrder: 20 });
    expect(response.status).toBe(200);
    expect(repository.updateCategoryRecord).toHaveBeenCalledWith(3, { isActive: false, sortOrder: 20 });
  });

  it("rejects a rename with 400 and writes nothing", async () => {
    const response = await request(app).patch("/admin/categories/3").set("Authorization", "admin").send({ name: "Hội thảo AI" });
    expect(response.status).toBe(400);
    expect(repository.updateCategoryRecord).not.toHaveBeenCalled();
  });

  it("never switches a legacy Category back on", async () => {
    repository.findCategory.mockResolvedValue(row({ id: 30, slug: "conference", kind: "other", is_active: 0 }));
    const response = await request(app).patch("/admin/categories/30").set("Authorization", "admin").send({ isActive: true });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CATEGORY_LEGACY_READ_ONLY");
    expect(repository.updateCategoryRecord).not.toHaveBeenCalled();
  });

  it("still lets a legacy Category be switched off", async () => {
    repository.findCategory.mockResolvedValue(row({ id: 31, slug: "qa-workflow", kind: "other", is_active: 1 }));
    const response = await request(app).patch("/admin/categories/31").set("Authorization", "admin").send({ isActive: false });
    expect(response.status).toBe(200);
    expect(repository.updateCategoryRecord).toHaveBeenCalledWith(31, { isActive: false });
  });
});
