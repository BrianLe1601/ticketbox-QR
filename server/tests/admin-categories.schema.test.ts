import { describe, expect, it } from "vitest";

import { isSelectableForNewEvent } from "../src/modules/categories/admin-categories.service.js";
import { createCategorySchema, updateCategorySchema } from "../src/modules/categories/admin-categories.schema.js";
import { createAdminEventSchema, updateAdminEventSchema } from "../src/modules/events/admin-events.schema.js";

describe("Category schemas", () => {
  it("defaults a new Category to kind 'other', active, sort order 0", () => {
    expect(createCategorySchema.parse({ name: "Jazz", slug: "jazz" }))
      .toMatchObject({ kind: "other", isActive: true, sortOrder: 0 });
  });

  it("does not reset untouched fields when only the name changes", () => {
    // Zod 4 applies defaults inside .partial(); a PATCH {name} must not reactivate
    // a Category or turn a music genre back into 'other'.
    expect(updateCategorySchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
  });

  it("rejects an unknown kind and unknown fields", () => {
    expect(() => updateCategorySchema.parse({ kind: "sports" })).toThrow();
    expect(() => updateCategorySchema.parse({ role: "admin" })).toThrow();
  });
});

describe("Category scope for new Events", () => {
  const music = { is_active: 1, kind: "music" as const };
  const other = { is_active: 1, kind: "other" as const };

  it("offers only active music genres in music_only mode", () => {
    expect(isSelectableForNewEvent(music, "music_only")).toBe(true);
    expect(isSelectableForNewEvent(other, "music_only")).toBe(false);
    expect(isSelectableForNewEvent({ ...music, is_active: 0 }, "music_only")).toBe(false);
  });

  it("offers every active Category in 'all' mode but never an inactive one", () => {
    expect(isSelectableForNewEvent(other, "all")).toBe(true);
    expect(isSelectableForNewEvent({ ...other, is_active: 0 }, "all")).toBe(false);
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
