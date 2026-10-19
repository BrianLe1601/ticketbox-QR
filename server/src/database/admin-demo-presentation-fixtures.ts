// Relative legacy fixtures may straddle midnight when subtracting two hours.
// Keep future/history starts at 02:00 when necessary; an ongoing fixture must
// instead start on the previous evening so it remains ongoing at seed time.
export function alignDemoCheckinDay(start: Date, checkinStart: Date, ongoing = false) {
  const offset = 7 * 3_600_000;
  const localStart = new Date(start.getTime() + offset);
  const localCheckin = new Date(checkinStart.getTime() + offset);
  if (localStart.toISOString().slice(0, 10) === localCheckin.toISOString().slice(0, 10)) {
    return { start, checkinStart };
  }
  const midnight = Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth(), localStart.getUTCDate()) - offset;
  const alignedStart = new Date(midnight + (ongoing ? -1 : 2) * 3_600_000);
  return { start: alignedStart, checkinStart: new Date(alignedStart.getTime() - 2 * 3_600_000) };
}

const VIETNAM_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Midnight (UTC+7) of the Vietnam calendar day that contains `reference`. */
export function vietnamMidnight(reference: Date) {
  const local = new Date(reference.getTime() + VIETNAM_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VIETNAM_OFFSET_MS;
}

// TicketBox has one venue, so these concerts cannot be simultaneous: concert N
// takes its own Vietnam-local day, starting tomorrow (15:00-17:00, check-in
// 13:00-16:30). Dates are relative to `reference` so the sales window is open
// when the seed runs; pass a fixed reference in tests.
export function createPresentationFixtures(reference: Date = new Date()) {
  const concerts = [
    { name: "Concert Pop sinh viên", categoryKey: "music" },
    { name: "Đêm nhạc Acoustic", categoryKey: "acoustic" },
    { name: "Rock Live Concert", categoryKey: "technology" },
    { name: "EDM Campus Concert", categoryKey: "community" },
    { name: "Acoustic Sunset", categoryKey: "acoustic" },
    { name: "Pop Hits Live", categoryKey: "music" },
    { name: "Indie Rock Concert", categoryKey: "technology" },
    { name: "EDM Summer Live", categoryKey: "community" },
    { name: "Sân khấu Pop", categoryKey: "music" },
    { name: "Acoustic Unplugged", categoryKey: "acoustic" },
  ];
  // Retain existing internal keys for Pop/Rock/EDM; assign genres explicitly,
  // not by index modulo (which put Pop concerts into EDM and Acoustic into Rock).
  const today = vietnamMidnight(reference);

  return concerts.map(({ name, categoryKey }, index) => {
    const number = String(index + 1).padStart(2, "0");
    const key = `presentation-${number}`;
    const day = today + (index + 1) * DAY_MS;
    return {
      event: {
        key,
        categoryKey,
        name: `[DEMO] ${number} — ${name}`,
        slug: `demo-admin-${key}`,
        capacity: 100,
        start: new Date(day + 15 * HOUR_MS),
        end: new Date(day + 17 * HOUR_MS),
        salesStart: new Date(today),
        salesEnd: new Date(day + 16.5 * HOUR_MS),
        checkinStart: new Date(day + 13 * HOUR_MS),
        checkinEnd: new Date(day + 16.5 * HOUR_MS),
        cover: true,
      },
      staff: {
        key,
        fullName: `[DEMO] Nhân viên cổng ${number}`,
        email: `demo.staff.presentation.${number}@ticketbox.local`,
        googleSub: null,
        approvalStatus: "approved" as const,
        finalActive: true,
        createdDaysAgo: 1,
      },
      ticketTypes: [
        { eventKey: key, name: "Vé trải nghiệm miễn phí", description: "Demo mua vé và check-in theo ngày diễn ra.", price: 0, capacity: 60, maxPerOrder: 5 },
        { eventKey: key, name: "Vé tiêu chuẩn", description: "Demo thanh toán mô phỏng và check-in theo ngày diễn ra.", price: 50_000 + index * 10_000, capacity: 40, maxPerOrder: 3 },
      ],
    };
  });
}
