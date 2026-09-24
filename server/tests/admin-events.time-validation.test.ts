import { describe, expect, it } from "vitest";

import { validateEventTimes } from "../src/modules/events/admin-events.service.js";

const baseTimes = {
  startTime: "2026-10-12T12:00:00.000Z", // 19:00 tại Việt Nam
  endTime: "2026-10-12T15:00:00.000Z",
  salesStartAt: "2026-09-12T01:00:00.000Z",
  salesEndAt: "2026-10-12T11:00:00.000Z",
  checkinStartAt: "2026-10-12T11:00:00.000Z", // 18:00 cùng ngày
  checkinEndAt: "2026-10-12T14:30:00.000Z",
};

describe("admin event check-in time validation", () => {
  it("accepts a check-in window that starts early on the event start day", () => {
    expect(() => validateEventTimes(baseTimes)).not.toThrow();
  });

  it("rejects a check-in start on the calendar day before the event in Vietnam", () => {
    expect(() => validateEventTimes({
      ...baseTimes,
      checkinStartAt: "2026-10-11T16:59:59.000Z", // 23:59:59 ngày 11/10 tại Việt Nam
    })).toThrowError(expect.objectContaining({ code: "CHECKIN_START_WRONG_DAY" }));
  });

  it("rejects a check-in start after the event has ended", () => {
    expect(() => validateEventTimes({
      ...baseTimes,
      checkinStartAt: "2026-10-12T15:30:00.000Z",
      checkinEndAt: "2026-10-12T16:00:00.000Z",
    })).toThrowError(expect.objectContaining({ code: "CHECKIN_START_AFTER_EVENT_END" }));
  });

  it("keeps the existing requirement to open check-in at least 30 minutes early", () => {
    expect(() => validateEventTimes({
      ...baseTimes,
      checkinStartAt: "2026-10-12T11:45:00.000Z",
    })).toThrowError(expect.objectContaining({ code: "CHECKIN_TOO_LATE" }));
  });
});
