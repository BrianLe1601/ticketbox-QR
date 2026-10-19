# 07 — Địa điểm duy nhất, Nhật ký/Báo cáo toàn hệ thống và giao diện TicketBox

Cập nhật 17/10/2026, nhánh `buu-events`, **chưa commit/merge**. Tài liệu này là nguồn chuẩn cho các thay đổi dưới đây; README, AGENTS và skill chỉ tóm tắt và liên kết tới đây. Các báo cáo [05](05-concert-ui-review.md) và [06](06-redesign-review.md) là lịch sử; các mục "chưa triển khai" trong đó đã được xử lý ở đây trừ khi mục 9 nói khác.

## 1. Kiến trúc đã xác nhận (không đổi)

React 19 + Vite + TypeScript + Tailwind v4 (`client`); Express 5 + TypeScript + MySQL2 + Zod (`server`); một file schema `database/migrations/001_initial_schema.sql`. Luồng `route → validate → controller → service → repository → MySQL`. Quyền được quyết định ở `authenticate` + `authorize` của từng router, không ở giao diện.

## 2. Địa điểm duy nhất, sức chứa, chống trùng lịch

**Nguồn dữ liệu địa điểm.** Trước đây không có nguồn chung: mỗi Event tự nhập `venue/address/city/venue_capacity`. Nay có bảng một dòng `platform_settings` (`id = 1`) do Admin nhập tại **Cài đặt → Địa điểm tổ chức**. Không có địa điểm mặc định nào được bịa: khi chưa cấu hình, tạo Event trả `409 VENUE_NOT_CONFIGURED`.

| Quy tắc | Thực thi |
|---|---|
| Event mới **sao chép** địa điểm hiện tại vào các cột cũ của `events` (snapshot). Form và API tạo/sửa Event không còn nhận `venue/address/city/venueCapacity` (gửi thì `400`) | `admin-events.schema.ts`, `admin-events.service.ts` |
| Địa điểm bận trong khoảng đóng `[checkin_start_at, end_time]`; chạm biên cũng trùng; chỉ Event `cancelled` giải phóng địa điểm | service (đọc có khóa) + trigger `trg_events_creator_admin_bi/bu` |
| Nhiều Admin đồng thời: khóa dòng `platform_settings` trước khi khóa Event; trigger tự khóa lại cùng dòng | `platform-settings.repository.ts#lockSettings`, trigger |
| Chỉ kiểm tra lại khi đổi `start_time`, `end_time` hoặc `checkin_start_at`; cập nhật vòng đời/ẩn hiện của dữ liệu cũ không bị chặn | trigger `BEFORE UPDATE` |
| Tổng vé các hạng ≤ `events.venue_capacity` (snapshot) | trigger `ticket_types` hiện có |
| Đổi địa điểm hệ thống **không** đổi Event cũ. Event nháp hoặc đã công bố mà chưa có đơn `pending_payment/confirmed` hoặc vé phát hành được chọn "Áp dụng địa điểm hiện tại" khi sửa (`syncVenue`); Event đã công bố cần thêm `confirmPublicVenueChange`; Event đã bán/đang diễn ra/kết thúc/hủy bị khóa | `updateAdminEvent` |

Thứ tự khóa mới: `platform_settings → Event → Order (id tăng) → Ticket Type → Ticket`. Chỉ các thao tác Admin đổi lịch/địa điểm lấy khóa đầu; Check-in, Checkout, Payment không bao giờ khóa nó nên không tạo vòng đợi.

Mã lỗi (HTTP): `VENUE_NOT_CONFIGURED`, `VENUE_SCHEDULE_CONFLICT`, `VENUE_CHANGE_CONFIRMATION_REQUIRED`, `VENUE_LOCKED_BY_SALES`, `VENUE_LOCKED_BY_STATUS`, `VENUE_CAPACITY_BELOW_ALLOCATION` (đều 409); `PLATFORM_SCHEMA_UPGRADE_REQUIRED` (503, database cũ chưa có bảng/cột mới; không crash).

API: `GET /api/admin/platform-settings`; `PUT /api/admin/platform-settings/venue` `{ name, address, city, capacity }`. Mọi route cần Admin. (Route `category-scope` đã bỏ ngày 20/10/2026, xem mục 3.) `GET` trả thêm `outOfSyncEventCount` (số Event nháp/đã công bố còn địa điểm cũ) và người/thời điểm sửa gần nhất.

**Seed.** Hai seed tạo Event trực tiếp nên phải theo cùng quy tắc. `seed:admin-demo` và `seed:workflows` đều dùng địa điểm hệ thống (chỉ ghi địa điểm mẫu "TicketBox Demo Center"/"TicketBox QA Hall" khi chưa có cấu hình; không bao giờ ghi đè địa điểm đã nhập). 10 concert demo nay xếp **mỗi ngày một concert từ ngày mai** (15:00–17:00, check-in 13:00–16:30, giờ Việt Nam) thay vì cùng giờ ngày 07/10. Vì cả hai bộ seed đều có Event "đang diễn ra" mà địa điểm chỉ chứa một, **không chạy cả hai trên cùng một database**; seed thứ hai dừng với thông báo rõ.

## 3. Danh mục: danh sách thể loại nhạc cố định (cập nhật 20/10/2026)

**Vấn đề của bản 17/10:** "thể loại âm nhạc" chỉ là nhãn `kind` do Admin tự chọn khi tạo danh mục, nên một danh mục tên bất kỳ (ví dụ "Hội thảo") vẫn được đánh dấu là âm nhạc; công tắc phạm vi `all` còn mở cửa cho danh mục không phải nhạc.

**Quyết định (Bửu):** danh mục là dữ liệu của sản phẩm, không phải của người vận hành.

- Schema cài **19 thể loại** `kind='music'`, tất cả đang bật: Pop, Ballad, Rock, Metal, Indie, Rap / Hip-hop, R&B / Soul, EDM / Điện tử, Acoustic, Jazz, Blues, Folk / Đồng quê, Bolero / Nhạc vàng, Nhạc dân tộc / Truyền thống, Cổ điển, K-Pop / J-Pop, Latin / Reggae, Nhạc kịch / Nhạc phim, **Thể loại nhạc khác** (`the-loai-khac`). Đường dẫn `pop`, `rock`, `edm`, `acoustic` giữ như cũ để link và bộ lọc Public không đổi. "Thể loại nhạc khác" là một thể loại bình thường (Báo cáo tính như mọi thể loại); thể loại mới được thêm vào schema ở bản sau.
- Admin chỉ **bật/tắt và sắp xếp**: `PATCH /api/admin/categories/:id` nhận đúng `{ isActive?, sortOrder? }` (strict; tên, đường dẫn, mô tả, biểu tượng, `kind` → 400). `POST`/`DELETE` → `409 CATEGORY_CATALOG_FIXED`.
- Event mới hoặc Event đổi thể loại chỉ dùng được thể loại đang bật trong danh sách (`409 CATEGORY_NOT_MUSIC`); sửa Event giữ nguyên thể loại không bị chặn.
- **Danh mục ngoài danh sách** (`kind='other'`): bản cài mới không còn 5 danh mục tổng quát cũ (bỏ ngày 20/10/2026); bảng, giá trị và nhóm "Danh mục cũ" được giữ để mở rộng sau, hiện chỉ danh mục kiểm thử `qa-workflow` dùng. Không xóa, không đổi loại, không chọn được cho Event mới; tắt được nhưng không bật lại (`409 CATEGORY_LEGACY_READ_ONLY`). Trang Admin chỉ hiện chúng khi còn Event hoặc còn bật.
- Bỏ `platform_settings.category_scope` và `PUT /api/admin/platform-settings/category-scope`; thẻ "Phạm vi danh mục" ở Cài đặt thay bằng thẻ tóm tắt "Thể loại nhạc".
- `GET /api/admin/categories` trả `catalog` và `selectableForNewEvent` (thay `kind`); API Public `/api/categories` giữ nguyên hình dạng.
- `seed:admin-demo` dùng Pop/Rock/EDM/Acoustic của danh sách (không tạo danh mục `[DEMO]`), tắt Metal để minh họa thể loại đã tắt. `db:verify` kiểm tra đủ 19 thể loại và schema không cài danh mục nào ngoài danh sách.
- Vẫn giữ: Zod 4 áp mặc định cả trong `.partial()`, nên schema `PATCH` không có giá trị mặc định nào.

## 4. Nhật ký check-in và Báo cáo "Tất cả sự kiện"

`eventId` nay **tùy chọn**; bỏ trống = tất cả Event. Client cũ gửi `eventId` vẫn chạy.

| Endpoint (Admin, `no-store`) | Ghi chú |
|---|---|
| `GET /api/admin/reports/events?q&page&limit` | Mọi Event không phải Bản nháp, kể cả đã kết thúc/hủy và chưa có hoạt động; có `meta.total` (không còn cắt 100) |
| `GET /api/admin/reports?eventId?&from?&to?&groupBy&page&limit&snapshotId?` | Tổng hợp + chi tiết từng Event (phân trang 20/lần, lấy từ snapshot) |
| `GET /api/admin/checkins?eventId?&from?&to?&staffId?&result?&page&limit&snapshotId?` | Phân trang phía server; giữ lượt thành công và bị từ chối |
| `GET .../export?...&snapshotId?` | Excel từ đúng snapshot đang xem |

**Snapshot gắn Admin** (`report.snapshot.ts`): id ngẫu nhiên 24 byte, TTL 15 phút, tối đa 20/Admin, lưu trong bộ nhớ tiến trình (mất khi restart; nhiều instance cần kho dùng chung). Admin khác, id lạ hoặc hết hạn đều trả `410 SNAPSHOT_EXPIRED` giống nhau, không lộ sự tồn tại. Gửi bộ lọc khác với snapshot → `409 SNAPSHOT_FILTER_MISMATCH`. Báo cáo lưu kết quả đã tính; nhật ký (bảng chỉ thêm) lưu bộ lọc + mốc `checkin_logs.id` cao nhất nên xuất lại đúng các dòng đã xem. Mã khác: `REPORT_SCOPE_TOO_LARGE` (>2.000 Event), `EXPORT_TOO_LARGE` (>10.000 dòng), `VIEW_RATE_LIMIT` (120/phút/Admin), `EXPORT_RATE_LIMIT` (5/phút/Admin). Không có `snapshotId` thì export tự chụp mới (tương thích cũ).

**Định nghĩa số liệu** (giữ nguyên công thức và thời điểm cũ; tổng hợp đúng cho nhiều Event): mỗi nguồn được cộng độc lập (đơn xác nhận/`confirmed_at`, vé phát hành/`issued_at`, vé đã vào = vé khác nhau có log SUCCESS/`checked_at`, đã thu/`paid_at`, đã hoàn/`completed_at`). **Tỷ lệ luôn tính từ tổng tử số / tổng mẫu số**: lấp đầy = Σ vé bán / Σ sức chứa hạng vé (mẫu số không lọc ngày); tham dự = Σ vé vào / Σ vé bán (có thể >100% khi lọc ngày). Không lấy trung bình phần trăm giữa các Event; ví dụ kiểm thử: 50% (5/10) và 1% (10/1000) cho 15/1010 = 1,49%, không phải 25,5%. Giao diện hiển thị `N / M` dưới mỗi tỷ lệ.

**Excel báo cáo** (viết lại 18/10/2026, `reportWorkbook`): sheet đầu "Tổng quan" (phạm vi bằng chữ, **thời điểm chụp** theo giờ Việt Nam — không phải lúc tải, bảng chỉ số chính kèm cột "Cách tính", tỷ lệ là công thức trên các ô tổng, cách đọc file); "Theo sự kiện" (ngày diễn ra là ô ngày thật, trạng thái tiếng Việt, tiền định dạng ₫ và số âm màu đỏ, tỷ lệ là phần trăm thật; phạm vi tất cả sự kiện có hàng tổng `SUM` và `IF(F>0,E/F,0)` — tổng tử số ÷ tổng mẫu số — nằm ngoài vùng lọc); "Doanh thu theo kỳ" (kỳ là ô ngày/tháng/năm thật để sắp xếp, thu ròng là công thức, hàng tổng). `fullCalcOnLoad` để Excel tính lại công thức khi mở; chuỗi bắt đầu bằng `=` vẫn là văn bản; tiền luôn ghi "mô phỏng"; không xuất QR/hash.

**Excel nhật ký check-in** (viết lại 18/10/2026, `logsWorkbook`): sheet đầu "Tổng quan" (phạm vi bằng chữ, thời điểm chụp theo giờ Việt Nam, bảng số lượt theo từng kết quả kèm tỷ lệ là công thức, ý nghĩa từng kết quả, cách đọc file); "Lịch sử check-in" (dòng tiêu đề ở hàng 1, mỗi dòng một lượt quét, kết quả và trạng thái vé bằng tiếng Việt, thời điểm là ô ngày thật theo giờ Việt Nam để sắp xếp/lọc, tô màu theo kết quả); "Theo sự kiện" (chỉ khi phạm vi tất cả sự kiện) và "Theo nhân viên" có hàng tổng `SUM` nằm ngoài vùng lọc. Mọi con số tính từ chính các dòng được xuất của bản chụp; `fullCalcOnLoad` để Excel tính lại công thức khi mở. Không có mã QR gốc hay hash.

## 5. Giao diện: token, theme, bản sắc

- **Token dùng chung**: `client/src/styles/ticketbox-tokens.css` (`--tb-*`: nền giấy ấm, mực xanh chàm theo logo, hổ phách "cuống vé", hồng "live" cho sự kiện đang diễn ra, trạng thái success/warning/danger). Phạm vi: `.admin-room`, `.staff-portal-room`, `.login-page` (thuộc tính `data-theme`) và `body[data-admin-appearance]` / `body[data-staff-appearance]` (giá trị `light|dark`) để portal Radix thừa hưởng. Không có token nào đọc được từ Public.
- **Sáng mặc định, tối tùy chọn**: `lib/ticketbox-theme.ts` (`useTheme(scope, accountId)`), lưu localStorage theo scope+tài khoản, dùng `useSyncExternalStore`, có dự phòng bộ nhớ khi storage bị chặn; nút `components/shared/ThemeToggle.tsx` là `role="switch"`. Tối là cùng hệ màu, đã đo tương phản ≥ 4,5:1.
- **Chuyển đổi màu hàng loạt**: các file CSS Admin/Staff được chuyển từ mã hex cứng sang token (script theo ngữ cảnh thuộc tính). Bảng màu Tailwind (slate/blue/rose/amber/emerald…) được ánh xạ sang token trong phạm vi Staff (`styles/staff/theme.css`) và các bậc "neon" trong phạm vi Admin (`styles/admin/theme.css`), vì Tailwind v4 biên dịch utility thành `var(--color-*)`; không cần sửa từng component.
- **Chữ**: sàn 12px cho Admin (hơn 230 khai báo 7–11px trong `admin/legacy.css` được nâng); Staff tăng bậc `text-xs/sm/base` và nút ≥ 48px.
- **Dashboard** viết lại: việc cần xử lý lên trước; bốn chỉ số dạng vé có đường đục lỗ; biểu đồ dùng token; không còn style inline màu.
- **Staff**: khung Event + khung giờ mở cổng luôn hiện; kết quả quét có **chữ phán quyết** (CHO VÀO / VÉ ĐÃ DÙNG / MÃ KHÔNG HỢP LỆ…, `scan-verdict.ts`) cùng biểu đồ và nút "Vé tiếp theo" 56px; nhập mã thủ công vẫn luôn có; khung camera luôn tối ở cả hai theme. Hợp đồng check-in và QR **không đổi**.
- **Login**: một thẻ, hai lối vào rõ (Quản trị viên / Nhân viên cổng, điều hướng bàn phím mũi tên), Staff dùng Google làm chính. Đã **bỏ nút "Điền nhanh Admin mẫu"** vì nó chứa mật khẩu mẫu trong code client, trái quy tắc AGENTS.
- **Thiết kế riêng**: đường đục lỗ + khuyết vé ở thẻ chỉ số, tiêu đề Đăng nhập; chấm "live" hồng chỉ cho trạng thái đang diễn ra; không ảnh nền, glow hay animation liên tục.

## 6. Ma trận quyền

| Vai trò | Được phép | Không được phép | Bằng chứng |
|---|---|---|---|
| Admin | Toàn bộ `/api/admin/*`: Event, hạng vé, danh mục, nhân viên, đơn/hoàn tiền mô phỏng, Dashboard, **Báo cáo/Nhật ký/Xuất**, **Cài đặt nền tảng**, upload | `/api/staff/*` (check-in) → 403 | mọi router admin có `authenticate, authorize("admin")`; `checkin.routes.ts` có `authorize("staff")` |
| Staff (đã duyệt, active) | `/api/staff/events|overview|assignments|events/:id/checkins` cho Event **được phân công đang trong khung check-in**; xem log của chính mình | Mọi `/api/admin/*` (403), tự phân công, sửa Event/vé, xem log người khác | `report.integration.test.ts` (Staff 403 trên 5 endpoint tổng hợp), `checkin.*.test.ts`, `hasAssignment` + `staff_id` trong truy vấn log |
| Staff Google chờ duyệt / bị vô hiệu | Không có phiên TicketBox | Mọi API có xác thực | `authenticate` đọc lại tài khoản active mỗi request; Google `pending` trả 202 không kèm token |
| Khách | Public Events, Checkout, Ticket Retrieval (OTP, reCAPTCHA, giới hạn) | Mọi thứ còn lại | không đổi |

Check-in vẫn xác minh ở backend: Staff active, phân công hợp lệ, đúng Event, trong khung check-in, Ticket/Order hợp lệ, cập nhật Ticket và log trong một transaction (`checkin.service.ts`); nhập mã thủ công là phương án dự phòng QR.

## 7. Cấu trúc trước/sau

- Server: module mới `modules/platform-settings/`; `modules/reports/` thêm `report.metrics.ts` (toán thuần), `report.snapshot.ts`; `database/seed-venue.ts` dùng chung cho seed.
- Client: `pages/admin/AdminCheckinLogsPage.tsx` + `components/admin/checkins/` (nhật ký), `pages/admin/AdminReportsPage.tsx` (báo cáo), `components/admin/EventScopeSelect.tsx` (chọn sự kiện), `components/admin/settings/` (cài đặt), `components/shared/ThemeToggle.tsx`, `lib/ticketbox-theme.ts`, `components/checkin/scan-verdict.ts`.
- CSS gom nhóm: `styles/admin-tech.css → styles/admin/legacy.css`, `admin-light.css → admin/theme.css`, `admin-*.css → admin/*.css`, `staff.css → staff/portal.css`, `staff-theme.css → staff/theme.css`, `auth-login.css → auth/login.css`. Xóa hai file rỗng `admin-staff.css`, `admin-tickets.css` (không được import ở đâu); gỡ 145 selector đăng nhập legacy (`auth-*`, `tech-*`) đã kiểm tra không còn dùng. `admin/orders.css` (đã chuyển token) vẫn chưa được import; Đơn hàng thuộc Tài.

## 8. Kiểm thử đã chạy

Chạy trên Windows 11, Node 24, MySQL **9.5** (instance riêng ở thư mục tạm, cổng 3399, đã tắt sau khi xong; không động tới database của bạn).

| Lệnh | Kết quả |
|---|---|
| server `npm run typecheck`, `npm run build` | đạt |
| server Vitest bỏ `*.integration.test.ts` | 37 file, 286/286 |
| `node scripts/verify-ticket-email.mjs` (DB dùng một lần) | 39 file/308 test + 2 file/16 test (credential, báo cáo qua HTTP) đạt; `db:verify` 30/30 |
| client `npm run lint`, `npm run build` | đạt |
| client `node --test tests/*.test.cjs` | 40/40 |
| UI (Edge headless, tự động đo tương phản/chữ nhỏ/tràn ngang) | Admin 9 trang, Staff 4 trang × sáng/tối × 1440/768/390 (Admin đủ 3 cỡ; Staff 1440/390), hộp thoại Sự kiện/Danh mục/ngăn kéo Nhân viên, Login: 0 lỗi tương phản, 0 chữ <12px (trừ 12 nhãn 11px ở Staff đã sửa), không tràn ngang |
| Kịch bản thật trên UI | Báo cáo mặc định tất cả → chọn một Event chưa áp dụng thì khóa Excel → áp dụng → quay lại tất cả; lưu địa điểm và tải lại; bật/tắt phạm vi danh mục; tạo Event trùng lịch bị từ chối kèm tên Event trùng; Event hợp lệ tạo được; quét mã sai hiện phán quyết |

Phát hiện khi kiểm chứng: assertion "hủy Event → `EVENT_NOT_AVAILABLE`" trong `checkout.integration.test.ts` đã lỗi từ HEAD (xác nhận trên bản HEAD nguyên vẹn): hủy Event thu hồi phân công nên kết quả là `STAFF_NOT_ASSIGNED`. Đã sửa assertion cho khớp hành vi có chủ đích.

## 9. Chưa làm, rủi ro, cần quyết định

- **Chưa chạy trên database của bạn.** Database cũ chưa có `platform_settings`/`categories.kind`: các API mới trả 503 `PLATFORM_SCHEMA_UPGRADE_REQUIRED` (Danh mục vẫn đọc được, coi mọi mục là `other`). Cần clean-install trên database có thể xóa; không có migration tăng dần.
- Chưa nghiệm thu bằng dịch vụ thật: Google sign-in, SMTP, camera/QR trên thiết bị, MySQL 8.0.x (README đặt tối thiểu 8.0.16; chỉ chạy 9.5), macOS.
- Snapshot nằm trong bộ nhớ một tiến trình (như OTP/rate limit hiện có).
- `AdminStaffPage.tsx` (~1.700 dòng) và `AdminTicketTypesPage.tsx` (~1.200 dòng) vẫn là component đơn khối. Việc tách theo bảng / drawer / dialog / form đã được duyệt, sẽ làm trong đợt redesign Admin (`docs/admin-redesign-plan.md`), có test hành vi trước khi tách. Admin Đơn hàng (của Tài) chỉ nhận token/theme chung, chưa thiết kế lại.
- Đã gỡ các tệp không dùng: `StaffHomePage.tsx` (trang scanner cũ), `AdminPlaceholderPage.tsx`, `App.css`, `lib/cyber-audio.ts`, ảnh mẫu Vite/React, `assets/backgrounds/*`, `styles/admin/orders.css`, cùng 424 rule CSS chết (class không còn xuất hiện trong mã) ở `styles/admin|staff|auth`.
- Dữ liệu lịch sử: Event cũ trùng lịch (nếu có) vẫn được giữ; quy tắc chỉ áp dụng khi tạo/đổi lịch.
- Quyết định mở: có muốn trigger chặn trùng lịch cả với Event Nháp (hiện **có**, để tránh hứa lịch trùng khi lên kế hoạch)?
