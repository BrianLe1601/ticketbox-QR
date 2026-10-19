# Đối chiếu tổng redesign TicketBoxQR — 15/10/2026

> **Cập nhật 17/10/2026:** báo cáo này là lịch sử. Các mục "đã duyệt, chưa triển khai" (Nhật ký/Báo cáo mặc định tất cả sự kiện, phân trang Event, snapshot Excel, nút sáng/tối, redesign Dashboard/Staff/Login) đã được triển khai; xem [07 — Địa điểm, Báo cáo, giao diện](07-venue-reports-theme.md). Tên file CSS nhắc ở đây đã đổi (`admin-light.css` → `styles/admin/theme.css`, v.v.; bảng ở mục 7 của 07).

## Phạm vi và kết luận

Rà soát working tree tại `C:\React\ticketbox\ticketbox-QR`, nhánh `buu-events`, theo hướng đã duyệt: nền sáng, gọn, hiện đại; foundation và Danh mục làm mẫu trước; bố cục riêng theo nghiệp vụ, không biến mọi trang thành cùng một hero/card. Working tree đã có thay đổi trước lần rà soát này; không reset hoặc ghi đè công việc đó. Không chuyển nhánh, commit/push/merge/PR, sửa Trello, thay schema hoặc chạy seed trên database đang dùng.

**Chưa hoàn thành toàn bộ kế hoạch redesign.** Foundation/Danh mục đã được nối vào trang thật và sửa lỗi; các sửa an toàn liên quan ở shell, Dashboard, Hạng vé và Admin Nhân viên đã được kiểm tra. Các file CSS/component tồn tại nhưng chưa dùng không được tính là giao diện hoàn thành. Các bằng chứng ở `05-concert-ui-review.md` là lịch sử ngày 06/10; báo cáo này bổ sung kết quả mới, không sửa lại lịch sử đó.

## 1. Đối chiếu kế hoạch với code

| Hạng mục | Hiện trạng xác nhận | Bằng chứng / phần còn lại |
|---|---|---|
| Foundation Admin | Đã có nền sáng, font cục bộ, sidebar gọn và component dùng chung; đã nối vào Danh mục | `AdminLayout.tsx`, `admin-light.css`, `admin-foundations.css`, `components/admin`, `admin-appearance.ts` |
| Danh mục làm trang mẫu | Đã triển khai bảng, một bộ lọc tổng hợp, tìm kiếm, trạng thái tải/lỗi/rỗng và modal | `AdminCategoriesPage.tsx`, `admin-category-view.ts`, `admin-categories.css`; CRUD ghi dữ liệu chưa UAT trên DB riêng |
| Tổng quan | Đã sửa nhãn/phạm vi số liệu và cảnh báo hoàn tiền; chưa triển khai toàn bộ bố cục mới | `AdminDashboardPage.tsx`; `admin-dashboard.css` mới chưa được import |
| Sự kiện | Hai chế độ thẻ/danh sách vẫn hoạt động; chưa có redesign bố cục riêng mới | `AdminEventsPage.tsx`; `admin-events.css` là scaffold rỗng |
| Hạng vé | Đã sửa lỗi dữ liệu phản hồi cũ khi đổi Event và thêm lỗi tải có retry; chưa có redesign hoàn chỉnh | `AdminTicketTypesPage.tsx`; `admin-tickets.css` rỗng; preset/chuỗi tiếng Anh cũ cần xử lý trong đợt giao diện này |
| Admin Nhân viên | Đã sửa an toàn thao tác và focus/nền của drawer + confirmation; vẫn còn card trạng thái và tab trùng chức năng | `AdminStaffPage.tsx`, `useDialogFocus.ts`; `admin-staff.css` rỗng |
| Đơn hàng | Giao diện đang dùng nhận theme chung; bố cục mới chưa được nối | `AdminOrdersPage.tsx`; `admin-orders.css` chưa import. Tìm mã đơn là task riêng của Tài |
| Cài đặt | Đã có font/cỡ chữ, xem trước/reset và lưu theo tài khoản trong trình duyệt | `AdminSettingsPage.tsx`, `admin-appearance.ts`; không có đồng bộ nhiều thiết bị |
| Nhật ký / Báo cáo | Hiện chọn một Event rồi áp dụng, Excel cùng bộ lọc nhưng đọc dữ liệu mới khi tải file | `AdminOperationsPage.tsx`, `report.service.ts`, server `modules/reports`; `admin-operations.css` chưa import |
| Tất cả Event / phân trang / snapshot Excel | **Đã được duyệt, chưa triển khai** | `report.schema.ts` vẫn bắt buộc `eventId`; chưa có snapshot ngắn hạn gắn Admin để màn hình và file dùng cùng thời điểm |
| Login | Đã có nền sáng/bỏ nền trang trí từ thay đổi trước; sửa fallback tải và câu mô tả số liệu | `LoginPage.tsx`, `AppRoutes.tsx`; bố cục tổng redesign riêng chưa hoàn tất |
| Giao diện Staff vận hành | **Chưa redesign sáng**; không nhầm với trang Admin Nhân viên | `StaffLayout.tsx`, `pages/staff`; không bị restyle ngoài phạm vi của lần sửa Admin |
| Nội dung concert | Nguồn admin-demo dùng concert và thể loại phù hợp; database hiện còn dữ liệu lịch sử ngoài âm nhạc | Fixture/seed source đã sửa, **chưa chạy seed hoặc chuyển dữ liệu cũ**; API không được quảng cáo là đã ép chỉ concert |

## 2. Lỗi phát hiện và cách sửa theo thứ tự

1. **Foundation chưa được dùng:** nối PageHeader/SummaryFilterBar/FilterToolbar/DataState vào Danh mục; bổ sung stylesheet thật và import. Nút chưa có handler phải disabled; số liệu thông tin không giả làm filter.
2. **Danh mục trùng bộ lọc và sai ngữ cảnh:** bỏ bộ tab lặp; dùng cùng predicate cho số đếm và dòng. Chọn Tổng/Hoạt động/Vô hiệu hóa xóa search để đúng số đã công bố; search sau đó kết hợp trạng thái. Hiển thị số kết quả và phân biệt zero-results với lỗi API.
3. **CSS rò sang Nhân viên:** bỏ nhóm `.staff-confirm-*` khỏi CSS Danh mục, scope style trang và portal; không sửa modal Staff bằng CSS của trang khác.
4. **Modal Danh mục chưa an toàn:** dùng Dialog/AlertDialog Radix đang có, title/description, khóa đóng và gửi trùng khi pending; lỗi xóa nằm trong dialog; giữ validation/contract CRUD.
5. **Sidebar mobile chưa khóa nền/focus:** ẩn khỏi keyboard khi đóng, inert nền khi mở, Escape/đổi breakpoint đóng và trả focus về opener. Bỏ trạng thái sức khỏe/chuông thông báo giả chưa có dữ liệu.
6. **Drawer/confirmation Nhân viên:** lưu riêng opener từng lớp, khóa nền và lớp thấp hơn, trap không chọn control ẩn/disabled; Escape không đóng khi request pending, serialize thao tác mutation. Giữ API/quyền/thu hồi phân công như cũ.
7. **Hạng vé đổi Event:** bỏ qua response của request cũ, chỉ hiển thị tier thuộc Event đang chọn, đánh dấu ngữ cảnh tải và lỗi/retry; không tính sức chứa Event mới bằng tier Event cũ. Khi bộ lọc Event không có kết quả, giải thích ngữ cảnh đang giữ.
8. **Dashboard gây hiểu nhầm:** nhãn `issued` là vé chưa check-in, active assignment không gọi là nhân viên đang trực, giá trị Order xác nhận không gọi là tổng Payment. Bỏ liên kết metric tới danh sách khác phạm vi; hiển thị cảnh báo khi chỉ có Refund pending. Không đổi công thức backend. Bỏ lời khẳng định realtime không có cơ chế hỗ trợ ở Dashboard/Logs/Login.
9. **Genre seed gán luân phiên:** chuyển fixture sang map concert → thể loại rõ ràng; thêm Acoustic active bên cạnh trường hợp Acoustic inactive. Chỉ đổi source/test, không đụng DB.
10. **Test scheduled publish không ổn định:** các `Date.now()` liên tiếp có thể lệch mili giây ở ranh giới 2 giờ; chạy theo giờ máy còn có thể rơi sang ngày Việt Nam khác. Cố định Date của fixture và khôi phục sau test. Không nới luật mở cổng của production.
11. **Tài liệu/skill có trạng thái cũ:** ghi All Events/snapshot là đã duyệt nhưng chưa làm; giữ order-code search riêng; phân biệt Staff light pending và scope Admin font. Sửa mô tả Staff scan choices theo khung cổng đang mở, tách trang phân công/lịch sử đã có.

## 3. File tác động trong lần rà soát này

Các đường dẫn dưới đây tương đối so với repository. Các file đã sửa trước đó nhưng không tiếp tục sửa (ví dụ Home, Settings, recaptcha test, music-workflows skill) được giữ nguyên, không nhận là công việc mới của lần rà soát.

| File | Mục đích |
|---|---|
| `client/src/components/admin/SummaryFilterBar.tsx` | Handler/disabled/pressed/icon semantics; được dùng thật ở Danh mục |
| `client/src/styles/admin-foundations.css` | Style chung header, summary, toolbar, data state, button và responsive |
| `client/src/styles/admin-light.css` | Import foundation; shell/sidebar/responsive/fallback light; metric tĩnh |
| `client/src/layouts/AdminLayout.tsx` | Sidebar keyboard/inert/focus; bỏ chỉ báo giả, giảm header |
| `client/src/routes/AppRoutes.tsx` | Lazy fallback sáng cho Admin/Login, không đổi Public/Staff |
| `client/src/hooks/useDialogFocus.ts` | Focus/scroll cho nested drawer, confirmation và mobile navigation |
| `client/src/lib/admin-category-view.ts` | Predicate, summary, search/sort bất biến cho Danh mục |
| `client/src/pages/admin/AdminCategoriesPage.tsx` | Kết nối foundation, bộ lọc đúng số đếm và modal/request guards |
| `client/src/styles/admin-categories.css` | CSS gọn, bảng/modal và scope, bỏ style Staff bị rò |
| `client/src/components/ui/dialog.tsx` | Thêm tùy chọn khóa nút đóng và label; default giữ tương thích trang khác |
| `client/src/pages/admin/AdminStaffPage.tsx` | Mutation guard, Escape/backdrop guard và nested focus/inert |
| `client/src/pages/admin/AdminTicketTypesPage.tsx` | Scope tier theo Event, response guard/error/retry và giải thích filter |
| `client/src/pages/admin/AdminDashboardPage.tsx` | Nhãn đúng dữ liệu, metric không giả lọc và cảnh báo Refund-only |
| `client/src/pages/admin/AdminOperationsPage.tsx` | Giữ cột Event đã có; sửa mô tả realtime của log |
| `client/src/pages/auth/LoginPage.tsx` | Mô tả theo dõi số liệu, không hứa realtime chưa có |
| `client/tests/admin-ui.test.cjs` | 6 regression test component/filter/dashboard/focus |
| `server/src/database/admin-demo-presentation-fixtures.ts` | Genre mapping rõ cho concert |
| `server/src/database/seed-admin-demo.ts` | Acoustic active cho fixture hợp lệ, giữ inactive negative case |
| `server/tests/admin-demo-presentation-fixtures.test.ts` | Assertion concert/genre bên cạnh thời gian đã có |
| `server/tests/scheduled-publish.job.test.ts` | Đồng hồ deterministic, không sửa job/service production |
| `.agents/skills/ticketbox-admin-ui/SKILL.md` | Source map và quy tắc đúng scope, connected UI, request/focus và trạng thái duyệt |
| `AGENTS.md`, `README.md` | Quy tắc thực thi và trạng thái code/phase/invariant, liên kết báo cáo này |
| `docs/project-guide/06-redesign-review.md` | Đối chiếu, kết quả/giới hạn và hướng dẫn tự kiểm tra |

Skill được cập nhật là skill repository đã tồn tại, không cài thêm toàn máy. Frontmatter/name/description và đường dẫn được kiểm tra thủ công. `quick_validate.py` không chạy được do Python có sẵn thiếu PyYAML; không tự cài dependency hay nhận là đã đạt validator đó.

## 4. Workflow và dữ liệu được giữ nguyên

- React/TypeScript/Vite + Express/TypeScript/MySQL, framework test hiện có; không thêm hạ tầng/ORM/test framework.
- Khách mua bằng email, OTP/reCAPTCHA/rate limit, điện thoại, `maxPerOrder`; reserve tại Tiếp tục mua vé sau thông tin hợp lệ, không chuyển lock về bước thanh toán. Giữ chỗ 10 phút, expiry/idempotency, thanh toán/Refund mô phỏng.
- Ticket Retrieval và email redelivery của Tài vẫn trong phạm vi, dùng QR gốc; không sửa token/hash/encryption hoặc email workflow.
- Staff cá nhân, Google pending chưa được cấp session; active/approved và assignment mới cho check-in. Ca gán tính theo `[checkin_start_at, checkin_end_at]`, kể cả chạm biên; mở cổng cùng ngày Việt Nam và sớm ít nhất 2 giờ.
- Giữ RBAC, JWT access + refresh session có thể thu hồi, transaction/atomic check-in và audit; Admin UI không tự cấp quyền backend.
- Font là preference theo tài khoản trên origin trình duyệt, không sync server/đa thiết bị. Đã khôi phục preference mặc định sau kiểm tra.
- Source admin-demo dự kiến **5 Categories (4 active genres + 1 inactive), 18 Events, 16 Staff, 30 tiers**. 10 concert cố định ngày 07/10/2026 là lịch sử ở lần rà soát 15/10; không gọi chúng là cổng đang mở hiện tại. DB chưa reseed nên tên/danh mục cũ trên màn hình là dữ liệu đang tồn tại, không phải source seed chưa sửa.

## 5. Kết quả kiểm tra và giới hạn

| Kiểm tra | Kết quả |
|---|---|
| Client lint + production build | Đạt ở bản cuối; lỗi preserve-manual-memoization của tier array phát hiện giữa chừng đã sửa bằng `useMemo`, không tắt rule |
| Server typecheck + build | Đạt |
| `node --test tests/*.test.cjs` trong client | **22/22 đạt**; có 6 test UI mới, giữ test appearance/reCAPTCHA/export scope |
| Server Vitest loại `**/*.integration.test.ts` | **35 file, 206/206 đạt** sau sửa fixture thời gian |
| `scripts/verify.ps1 -Scope all` | **Exit 1**: hai suite tích hợp từ chối DB thường; 206 test đạt, 14 test tích hợp skipped. Không được báo full verification pass |
| Helper DB dùng thử `node scripts/verify-ticket-email.mjs` | Không tạo được DB dùng thử do `ticketbox_app` thiếu quyền CREATE DATABASE; không đổi quyền hay chạy integration/seed trên DB thật |
| CSS parse | 10 file Admin CSS parse được; file rỗng vẫn không tính là implementation |
| `git diff --check` | Đạt; LF → CRLF warning không phải conflict |
| Runtime mặc định | Backend health xác nhận TicketBoxQR tại `localhost:3000`; browser dùng `localhost:5173` |

Browser đã kiểm tra:

- Danh mục desktop 1440px, tablet 768px, mobile 390px; thử font 17px, bảng cuộn trong panel không tràn trang. Dữ liệu hiện tại 10 tổng, 9 active, 1 inactive; status/search/reset/zero-results đúng. Modal mở/hủy, nhập trường số và Tab/Shift+Tab/Escape/focus return; không submit CRUD vào DB đang sử dụng.
- Sidebar mobile: nền không tương tác khi mở, Escape trả focus về nút menu, scroll được khôi phục; đóng sidebar không để link ngoài màn hình nhận focus.
- Admin Nhân viên: mở drawer → mở xác nhận Gỡ phân công → Escape → focus về Gỡ phân công → Escape → focus về Xem chi tiết; nền inert được khôi phục, không thu hồi phân công thật.
- Hạng vé: Event đang bán có 3 tiers; đổi sang Draft chưa có tier trả đúng 0, không giữ tier cũ. Chặn create khi dữ liệu chưa sẵn sàng/lỗi vẫn nằm ở UI guard; chưa mô phỏng mọi thứ tự mạng bằng browser.
- Sự kiện: chuyển qua lại thẻ/danh sách còn hoạt động; không gửi publish/hủy/xóa thật.
- Báo cáo một Event đã hủy: tải API thành công; gross 600.000đ, refund completed 600.000đ, net 0đ, sold 2/100, attendance 0/2 ở DB này. Nút Excel có và thông báo rõ dữ liệu lúc xuất có thể mới hơn màn hình. Chưa download/đối chiếu nội dung file Excel trực tiếp trong lần này.
- Đăng nhập Admin/Staff bằng account mẫu người dùng cung cấp thành công; tài khoản Staff đi vào `/staff`, truy cập `/admin` bị trả về `/staff`. Khi rời Admin không còn `data-admin-appearance`, `.admin-room` hoặc scroll lock. Đây là kiểm tra route UI, không thay thế test RBAC API.

Chưa nghiệm thu: mutation/refetch trên DB disposable, full MySQL race/rollback, OTP/SMTP thật, Google identity thật, camera/QR thiết bị, toàn bộ tổ hợp filter và tất cả page ở mọi cỡ/font. Không dùng kết quả mock để kết luận các phần này đã xong. Không bypass bảo vệ DB hoặc CAPTCHA.

## 6. Phần tiếp theo theo kế hoạch, chưa tự triển khai

1. Duyệt hình thức trang mẫu Danh mục hiện tại, rồi nối foundation và bố cục riêng cho Events/Ticket Types/Admin Staff/Orders/Dashboard/Settings. Giữ thẻ/danh sách Event; không đổi công thức tồn/doanh thu để khớp UI.
2. Đợt API/UI Logs/Reports **đã được duyệt**: mặc định tất cả Event, optional eventId tương thích cũ, phân trang lựa chọn và dữ liệu, giữ zero-activity/terminal Events; snapshot ngắn hạn gắn Admin và bộ lọc để màn hình/Excel cùng thời điểm. Chỉ triển khai trong task riêng đúng ownership, không thay Staff endpoints/quyền.
3. Redesign Staff theo tác vụ cổng vào (chọn ca/quét/manual/kết quả/lịch sử), Login gọn; preserve camera lifecycle, chống gửi trùng POST và auth/approval. Không copy nguyên bảng Admin vào Staff.
4. Tìm mã đơn riêng của Tài; không lẫn với đợt foundation. Các đơn giản hóa Home hoặc chuyển dữ liệu cũ/seed chạy lại là quyết định riêng, không tự thực hiện.

## 7. Tự kiểm tra / chụp bằng chứng

Không cần cài thêm dependency hoặc chạy seed/migration cho các sửa UI này. Khởi chạy server/client hiện có ở các cổng mặc định khi bạn chấp nhận các job publish/lifecycle/expiry hoạt động bình thường.

Từ thư mục `client`, Windows PowerShell hoặc macOS Terminal:

```text
npm run lint
npm run build
node --test tests/*.test.cjs
```

Từ thư mục `server`:

```text
npm run typecheck
npm run build
npm test -- --exclude '**/*.integration.test.ts'
```

Không diễn giải lệnh loại integration là nghiệm thu DB đầy đủ. Dùng helper `verify-ticket-email.mjs` với tài khoản/DB disposable được cấu hình phù hợp khi cần nghiệm thu tích hợp; không cấp thêm quyền DB tự động hoặc đổi guard để chạy trên `ticketboxqr`.

Ảnh nên chụp: Danh mục 3 segment + search/zero-results; form tạo/sửa và xác nhận xóa nhưng Hủy; mobile 390px/font lớn và menu; Event hai chế độ cùng bộ lọc; tiers đúng Event; Staff drawer/confirmation; Reports ghi rõ scope một Event hiện tại; terminal kết quả test và giới hạn integration. Không submit thao tác quyền/xóa/Refund chỉ để tạo ảnh.

Ảnh đã lưu ngoài repo tại workspace `TicketBoxQR 2\artifacts\redesign-review`: `categories-desktop.jpg`, `categories-mobile-large.jpg`. Không thêm ảnh mật khẩu/token hoặc dùng screenshot làm bằng chứng mutation chưa chạy.
