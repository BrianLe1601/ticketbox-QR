/**
 * "Bắt đầu với TicketBox": the first-run checklist shown to an Admin. Every step is derived from
 * API data the Admin can already read (platform settings, Categories, Events); nothing is stored on
 * the server and nothing here is a permission check (the backend still enforces every rule).
 */
import { formatNumber } from "./admin-format";

export type SetupStepId = "venue" | "categories" | "event" | "tickets" | "publish" | "staff";

export interface SetupInput {
  venueConfigured: boolean;
  categoryScope: "music_only" | "all";
  categories: ReadonlyArray<{ kind: string; isActive: boolean }>;
  events: ReadonlyArray<{
    id: number;
    status: string;
    validTicketTypeCount: number;
    activeStaffCount: number;
    checkinEndAt: string;
    readiness?: { ready: boolean } | null;
  }>;
  /** Google sign-ins waiting for approval (dashboard summary). */
  pendingStaff: number;
}

export interface SetupStep {
  id: SetupStepId;
  title: string;
  /** Why the step exists, in one sentence. */
  why: string;
  done: boolean;
  /** Current state in words ("2 thể loại chọn được…"). */
  status: string;
  to: string;
  action: string;
  /** Set when an earlier step must be finished first (the action is disabled with this reason). */
  lockedReason: string | null;
}

export interface SetupProgress {
  steps: SetupStep[];
  completed: number;
  total: number;
  /** First unfinished step, or null when everything is done. */
  current: SetupStepId | null;
}

const PUBLISHED = new Set(["published", "ongoing", "completed"]);

/** Categories a new Event may use under the platform scope (same rule as Settings and the server). */
export function selectableCategoryCount(input: Pick<SetupInput, "categoryScope" | "categories">): number {
  const active = input.categories.filter((item) => item.isActive);
  return input.categoryScope === "all" ? active.length : active.filter((item) => item.kind === "music").length;
}

export function buildSetupProgress(input: SetupInput, now: Date = new Date()): SetupProgress {
  const t = now.getTime();
  const selectable = selectableCategoryCount(input);
  const live = input.events.filter((event) => event.status !== "cancelled");
  const drafts = live.filter((event) => event.status === "draft");
  const published = input.events.filter((event) => PUBLISHED.has(event.status));
  const draftWithoutTiers = drafts.find((event) => event.validTicketTypeCount === 0);
  const readyDraft = drafts.find((event) => event.readiness?.ready) ?? drafts.find((event) => event.validTicketTypeCount > 0);
  const unstaffed = input.events.filter((event) => (event.status === "published" || event.status === "ongoing")
    && Date.parse(event.checkinEndAt) > t && event.activeStaffCount === 0);

  const venue = input.venueConfigured;
  const categories = selectable > 0;
  const event = input.events.length > 0;
  const publish = published.length > 0;
  const tickets = publish || live.some((item) => item.validTicketTypeCount > 0);
  // Setup is about the first gate team; day-to-day gaps stay in the task bell ("Chưa có nhân viên trực cổng").
  const staff = publish && (published.some((item) => item.activeStaffCount > 0) || unstaffed.length === 0);

  const pendingNote = input.pendingStaff > 0 ? ` · ${formatNumber(input.pendingStaff)} tài khoản chờ duyệt` : "";
  const steps: SetupStep[] = [
    {
      id: "venue", title: "Cấu hình địa điểm tổ chức", done: venue,
      why: "Khai báo tên, địa chỉ và sức chứa nơi tổ chức; mọi sự kiện mới sẽ dùng thông tin này.",
      status: venue ? "Đã cấu hình" : "Chưa cấu hình — chưa thể tạo sự kiện",
      to: "/admin/settings", action: venue ? "Xem lại" : "Cấu hình địa điểm", lockedReason: null,
    },
    {
      id: "categories", title: input.categoryScope === "all" ? "Chuẩn bị danh mục" : "Chuẩn bị thể loại âm nhạc", done: categories,
      why: input.categoryScope === "all"
        ? "Mỗi sự kiện thuộc một danh mục; tạo sẵn ít nhất một danh mục đang hoạt động."
        : "Mỗi sự kiện thuộc một thể loại nhạc (Pop, Rock, EDM…); tạo sẵn ít nhất một thể loại đang hoạt động.",
      status: (() => {
        const noun = input.categoryScope === "all" ? "danh mục" : "thể loại";
        return categories ? `${formatNumber(selectable)} ${noun} sẵn sàng cho sự kiện mới` : `Chưa có ${noun} nào đang hoạt động`;
      })(),
      to: "/admin/categories", action: categories ? "Xem lại" : "Thêm thể loại", lockedReason: null,
    },
    {
      id: "event", title: "Tạo sự kiện (bản nháp)", done: event,
      why: "Nhập tên buổi diễn, lịch diễn, thời gian bán vé và giờ mở cổng; bản nháp chưa hiện với khách.",
      status: event ? `${formatNumber(input.events.length)} sự kiện` : "Chưa có sự kiện nào",
      to: event ? "/admin/events" : "/admin/events?create=1", action: event ? "Xem sự kiện" : "Tạo sự kiện",
      lockedReason: event ? null : !venue ? "Cần cấu hình địa điểm (bước 1) trước" : !categories ? "Cần ít nhất một thể loại đang hoạt động (bước 2)" : null,
    },
    {
      id: "tickets", title: "Thêm hạng vé", done: tickets,
      why: "Đặt tên, giá và số lượng cho từng hạng vé (VIP, Thường…); tổng số vé không vượt sức chứa nơi tổ chức.",
      status: tickets ? "Đã có hạng vé đang bán" : drafts.length > 0 ? "Sự kiện chưa có hạng vé đang bán" : "Chưa có hạng vé",
      to: draftWithoutTiers && !tickets ? `/admin/ticket-types?eventId=${draftWithoutTiers.id}&setup=1` : "/admin/ticket-types",
      action: tickets ? "Xem hạng vé" : "Thêm hạng vé",
      lockedReason: tickets || event ? null : "Cần tạo sự kiện (bước 3) trước",
    },
    {
      id: "publish", title: "Công bố sự kiện", done: publish,
      why: "Xem lại mục \"Sẵn sàng công bố\" rồi công bố ngay hoặc hẹn giờ; sau đó khách có thể xem và mua vé.",
      status: publish ? `${formatNumber(published.length)} sự kiện đã công bố` : "Chưa công bố sự kiện nào",
      to: !publish && readyDraft ? `/admin/events?focus=${readyDraft.id}` : "/admin/events",
      action: publish ? "Xem sự kiện" : "Kiểm tra và công bố",
      lockedReason: publish || tickets ? null : "Cần thêm hạng vé (bước 4) trước",
    },
    {
      id: "staff", title: "Duyệt và phân công nhân viên cổng", done: staff,
      why: "Nhân viên soát vé đăng nhập bằng Google; bạn duyệt tài khoản rồi phân công vào từng sự kiện để họ soát vé tại cổng.",
      status: (unstaffed.length > 0 ? `${formatNumber(unstaffed.length)} sự kiện đang bán chưa có nhân viên` : publish ? "Mọi sự kiện đang bán đã có nhân viên" : "Chưa có sự kiện cần phân công") + pendingNote,
      to: unstaffed[0] ? `/admin/staff?assignEvent=${unstaffed[0].id}` : input.pendingStaff > 0 ? "/admin/staff?tab=pending" : "/admin/staff",
      action: unstaffed.length > 0 ? "Phân công" : input.pendingStaff > 0 ? "Duyệt tài khoản" : "Xem nhân viên",
      lockedReason: null,
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, total: steps.length, current: steps.find((step) => !step.done)?.id ?? null };
}

/** Auto-open once per session, only while setup is unfinished, never over a deep link (bell, Ctrl+K). */
export function shouldAutoOpenGuide(options: { complete: boolean; dismissed: boolean; seenThisSession: boolean; hasDeepLink: boolean }): boolean {
  return !options.complete && !options.dismissed && !options.seenThisSession && !options.hasDeepLink;
}
