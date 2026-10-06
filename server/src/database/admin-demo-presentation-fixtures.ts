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

// Fixed Vietnam-local dates: these fixtures are for the 7 October 2026 demo,
// not relative to the machine clock or its operating-system timezone.
export function createPresentationFixtures() {
  const names = [
    "Ngày hội TicketBoxQR", "Giao lưu âm nhạc sinh viên",
    "Workshop công nghệ", "Hội nghị quản lý dự án",
    "Triển lãm sáng tạo", "Ngày hội cộng đồng",
    "Giao lưu câu lạc bộ", "Trải nghiệm khởi nghiệp",
    "Sân khấu sinh viên", "Chia sẻ thiết kế hệ thống",
  ];
  const categoryKeys = ["community", "music", "technology"];

  return names.map((name, index) => {
    const number = String(index + 1).padStart(2, "0");
    const key = `presentation-20261007-${number}`;
    return {
      event: {
        key,
        categoryKey: categoryKeys[index % categoryKeys.length]!,
        name: `[DEMO 07/10] ${number} — ${name}`,
        slug: `demo-admin-${key}`,
        capacity: 100,
        start: new Date("2026-10-07T15:00:00+07:00"),
        end: new Date("2026-10-07T17:00:00+07:00"),
        salesStart: new Date("2026-10-06T00:00:00+07:00"),
        salesEnd: new Date("2026-10-07T16:30:00+07:00"),
        checkinStart: new Date("2026-10-07T13:00:00+07:00"),
        checkinEnd: new Date("2026-10-07T16:30:00+07:00"),
        cover: true,
      },
      staff: {
        key,
        fullName: `[DEMO 07/10] Nhân viên cổng ${number}`,
        email: `demo.staff.presentation.${number}@ticketbox.local`,
        googleSub: null,
        approvalStatus: "approved" as const,
        finalActive: true,
        createdDaysAgo: 1,
      },
      ticketTypes: [
        { eventKey: key, name: "Vé trải nghiệm miễn phí", description: "Demo mua vé và check-in ngày 07/10/2026.", price: 0, capacity: 60, maxPerOrder: 5 },
        { eventKey: key, name: "Vé tiêu chuẩn", description: "Demo thanh toán mô phỏng và check-in ngày 07/10/2026.", price: 50_000 + index * 10_000, capacity: 40, maxPerOrder: 3 },
      ],
    };
  });
}
