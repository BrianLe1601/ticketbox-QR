import { describe, expect, it } from "vitest";

import { isSelectableForNewEvent } from "../src/modules/categories/admin-categories.service.js";
import { updateCategorySchema } from "../src/modules/categories/admin-categories.schema.js";
import { createAdminEventSchema, updateAdminEventSchema } from "../src/modules/events/admin-events.schema.js";

describe("Category update schema (fixed genre catalogue)", () => {
  it("accepts only the on/off switch and the display order", () => {
    expect(updateCategorySchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(updateCategorySchema.parse({ sortOrder: 30 })).toEqual({ sortOrder: 30 });
  });

  it("never fills defaults, so reordering cannot switch a genre back on", () => {
    expect(updateCategorySchema.parse({ sortOrder: 10 })).not.toHaveProperty("isActive");
  });

  it.each([
    ["rename", { name: "Renamed" }], ["new slug", { slug: "renamed" }], ["description", { description: "x" }],
    ["icon", { icon: "music" }], ["reclassify", { kind: "other" }], ["unknown field", { role: "admin" }], ["empty body", {}],
  ])("rejects %s", (_label, body) => {
    expect(() => updateCategorySchema.parse(body)).toThrow();
  });
});

describe("Categories a new Event may use", () => {
  const genre = { is_active: 1, kind: "music" as const };
  const legacy = { is_active: 1, kind: "other" as const };

  it("offers only switched-on catalogue genres", () => {
    expect(isSelectableForNewEvent(genre)).toBe(true);
    expect(isSelectableForNewEvent({ ...genre, is_active: 0 })).toBe(false);
  });

  it("never offers a legacy Category, even while it is still on", () => {
    expect(isSelectableForNewEvent(legacy)).toBe(false);
  });
});

describe("Admin Event schemas no longer accept typed venue fields", () => {
  const base = {
    name: "Concert", category: "pop",
    startTime: "2027-01-10T08:30:00+07:00", endTime: "2027-01-10T10:00:00+07:00",
    salesStartAt: "2027-01-09T00:00:00+07:00", salesEndAt: "2027-01-10T09:30:00+07:00",
    checkinStartAt: "2027-01-10T06:00:00+07:00", checkinEndAt: "2027-01-10T09:30:00+07:00",
  };

  it("accepts a create body without venue data", () => {
    expect(createAdminEventSchema.parse(base).name).toBe("Concert");
  });

  it.each(["venue", "address", "city", "venueCapacity"])("rejects a client-supplied %s", (field) => {
    expect(() => createAdminEventSchema.parse({ ...base, [field]: field === "venueCapacity" ? 100 : "x" })).toThrow();
    expect(() => updateAdminEventSchema.parse({ [field]: field === "venueCapacity" ? 100 : "x" })).toThrow();
  });

  it("allows only boolean venue sync flags on update", () => {
    expect(updateAdminEventSchema.parse({ syncVenue: true, confirmPublicVenueChange: true }))
      .toEqual({ syncVenue: true, confirmPublicVenueChange: true });
    expect(() => updateAdminEventSchema.parse({ syncVenue: "yes" })).toThrow();
  });
});
