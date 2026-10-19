# Báo cáo cập nhật concert và giao diện Admin — 06/10/2026

## 1. Phạm vi nghiệp vụ đã xác nhận

Làm trực tiếp tại `C:\React\ticketbox\ticketbox-QR`, nhánh `buu-events`; working tree ban đầu sạch. Không chuyển nhánh, commit/push/merge/PR, sửa Trello, chạy seed, migration hoặc thay schema. Không coi code chưa commit là đã bàn giao lên develop/main.

React/TypeScript/Vite, Express/TypeScript/MySQL là stack hiện có. Concert âm nhạc là định hướng cho nội dung mới; Categories là thể loại Pop/Rock/EDM/Acoustic. Vẫn có bán vé và check-in, không thu hẹp thành ứng dụng chỉ quét vé. Không bổ sung nghệ sĩ, sơ đồ ghế, đơn vị tổ chức hoặc thanh toán thật. Lịch sử ngoài âm nhạc được giữ.

Các invariant giữ nguyên: khách mua bằng email; OTP/reCAPTCHA/rate limit; số điện thoại hợp lệ; giới hạn mỗi đơn; reserve tại bước Tiếp tục mua vé sau thông tin người mua; giữ chỗ 10 phút/expiry/idempotency; payment/refund mô phỏng; Ticket/QR/email/Retrieval; Staff cá nhân được duyệt và phân công theo khung check-in; check-in atomic và RBAC. Không thay authentication JWT access + refresh session, quyền Admin/Staff hoặc cơ chế QR của Tài.

## 2. Thay đổi thực tế và danh sách file

Đường dẫn dưới đây tương đối so với repository. Màu sáng áp dụng qua CSS dùng chung nên nhiều trang nhận thay đổi mà không sửa nghiệp vụ từng trang.

| File | Mục đích |
|---|---|
| `AGENTS.md` | Concert/ownership, phạm vi sửa, quy chuẩn UI, font cục bộ, quy tắc dữ liệu và các phần chờ xác nhận |
| `README.md` | Phạm vi và trạng thái mới; sửa mô tả lifecycle/assignment/refund cũ; ghi test và giới hạn |
| `.agents/skills/ticketbox-admin-ui/SKILL.md` | Hướng dẫn UI Admin/Login theo trang, không cho phép đổi backend |
| `.agents/skills/ticketbox-music-workflows/SKILL.md` | Chọn và truy vết một workflow concert cụ thể |
| `.agents/skills/ticketbox-music-workflows/references/catalogue-purchase.md` | Tham chiếu catalogue, mua vé, giữ chỗ, QR/email và invariant |
| `.agents/skills/ticketbox-music-workflows/references/gate-reporting.md` | Tham chiếu duyệt Staff, phân công, check-in và reporting |
| `client/src/styles/admin-light.css` (nay `styles/admin/theme.css`; xem [07](07-venue-reports-theme.md)) | Token sáng, font/spacing/control, contrast, bảng/modal/chart và responsive scoped Admin/Login |
| `client/src/index.css` | Import lớp style mới sau style cũ |
| `client/src/lib/admin-appearance.ts` | Danh sách font/size, đọc/lưu cục bộ an toàn |
| `client/src/layouts/AdminLayout.tsx` | Bỏ nền trang trí, dùng logo sáng, áp dụng preference và scope portal, cleanup khi rời Admin |
| `client/src/pages/auth/LoginPage.tsx` | Bỏ ảnh nền/overlay; nền sáng, nội dung concert; giữ Login/Google |
| `client/src/pages/admin/AdminSettingsPage.tsx` | Font/cỡ chữ, xem trước, khôi phục, thông báo lưu; không đổi profile/password API |
| `client/src/pages/admin/AdminCategoriesPage.tsx` | Chuyển danh mục từ card sang bảng; giữ CRUD/filter, thêm focus trap/return modal |
| `client/src/pages/admin/AdminStaffPage.tsx` | Focus trap/return cho drawer và confirmation; giữ API phân công/duyệt |
| `client/src/pages/admin/AdminOperationsPage.tsx` | Thêm tên sự kiện từ `log.eventName` vào bảng nhật ký; chưa mở rộng API |
| `client/src/pages/admin/AdminTicketTypesPage.tsx` | Làm rõ giá trị vé bán là mô phỏng, không đổi phép tính |
| `client/src/pages/public/HomePage.tsx` | Đổi lời giới thiệu sang concert, chưa gỡ các khối cũ |
| `client/tests/admin-appearance.test.cjs` | 4 test preference: mặc định, cách ly tài khoản/reset, dữ liệu lỗi, storage bị chặn |
| `client/tests/recaptcha.test.cjs` | Bổ sung saleStatus/available/maxPerOrder cho fixture Checkout hiện có; giữ toàn bộ assertion OTP |
| `server/src/database/admin-demo-presentation-fixtures.ts` | Đổi nội dung 10 sự kiện ngày 07/10 sang concert, giữ thời gian |
| `server/src/database/seed-admin-demo.ts` | Đổi tên/slugs/mô tả demo sang thể loại âm nhạc/concert, không đổi thuật toán seed |
| `server/tests/admin-demo-presentation-fixtures.test.ts` | Kiểm tra tên concert và thời gian fixture |
| `docs/project-guide/05-concert-ui-review.md` | Báo cáo này, minh chứng và giới hạn nghiệm thu |

Nguồn seed hiện có 4 danh mục demo, 18 concert, 16 Staff, 30 hạng vé; 10 concert ngày 07/10/2026 có Event 15:00–17:00, check-in 13:00–16:30, bán tới 16:30 giờ Việt Nam. Đây là dữ liệu dự kiến của script, không phải chứng nhận dữ liệu DB hiện tại. Script có cleanup/reset demo nên chưa chạy. Các seed khác và lịch sử vẫn có tên/danh mục cũ, không tự chuyển đổi.

## 3. Hai skill và cách sử dụng

Skill nằm trong repository, không cài thành hệ thống toàn máy. Khi làm UI Admin/Login/font, đọc `ticketbox-admin-ui/SKILL.md`; khi làm một nghiệp vụ concert, đọc `ticketbox-music-workflows/SKILL.md` và reference tương ứng. Phần tồn vé/lifecycle dùng thêm skill `ticketbox-event-safety`; trước bàn giao dùng `ticketbox-verify` hiện có. Không đọc reference rồi tự mở rộng task sang tất cả module.

Đã kiểm tra frontmatter/name/description, liên kết và nội dung thủ công; kiểm tra cơ bản bằng Node đạt. Script `quick_validate.py` của skill-creator chưa chạy được vì Python có sẵn thiếu PyYAML; không tự cài dependency để vượt qua. Không tuyên bố đã đạt trình kiểm định chính thức đó.

## 4. Nền tảng chung và bố cục riêng

Chung: nền sáng, chữ tối, khoảng cách nội dung 24px/16px mobile, bo nền 12px, control khoảng 40px, body 15px, focus rõ, select sáng dễ đọc, modal giới hạn theo viewport. Không dùng CSS zoom. Không xóa ảnh bìa/logo/QR. Chưa có nút đổi sáng/tối.

Riêng: Tổng quan vẫn biểu đồ; Sự kiện vẫn hai chế độ thẻ/danh sách; Hạng vé vẫn chọn Event + quản lý tồn; Danh mục là bảng; Nhân viên là trạng thái/bảng hoặc danh sách mobile + drawer phân công; Đơn hàng là bảng/detail; Nhật ký là bảng theo lượt quét; Báo cáo là số liệu/biểu đồ; Cài đặt chia nhóm. Các khung thống kê là filter chỉ khi có predicate và hành vi thực sự, không ép mọi số liệu thành filter.

CSS scope `.admin-room` và portal thông qua `body[data-admin-appearance="light"]`. Login có scope riêng; Public/Staff không đổi theme. Các ảnh nền cũ còn có thể xuất hiện trong bundle do style/asset dùng chung, nhưng không được render làm nền Admin/Login mới. Không xóa asset có thể được Staff dùng.

## 5. Rà soát luồng khách mua vé

| Phần hiện có | Kết luận trong lần sửa này |
|---|---|
| Home: `HomePage.tsx` | Đã đổi lời giới thiệu; đề xuất bỏ ba preview Music/Conference/Food cố định để giảm nội dung lặp, đang chờ xác nhận |
| Danh sách/chi tiết: `EventListPage.tsx`, `EventDetailPage.tsx` | Giữ search/filter/chọn hạng vé; không loại bỏ lịch sử hoặc quy tắc mua |
| OTP/thông tin mua: `CheckoutPlaceholder.tsx` | Giữ bước xác thực và điện thoại, không gộp bỏ để làm giao diện ngắn hơn |
| Thanh toán mô phỏng: `OrderPaymentPage.tsx` | Giữ bước xác nhận sau khi đã reserve; không chuyển lock về thanh toán |
| Ticket Retrieval và email vé | Giữ chức năng của Tài và kiểm soát spam/QR gốc; không xóa vì đổi phạm vi concert |

Chưa đơn giản hóa các bước nghiệp vụ của khách. Không tuyên bố đã gỡ chức năng thừa; đề xuất trình bày Home chưa được thực thi. Không tự thêm đăng nhập/đăng ký khách.

## 6. Font Settings

Vào Cài đặt → Giao diện: Hệ thống/Arial/Georgia, Nhỏ/Mặc định/Lớn = 14/15/17px; áp dụng ngay, xem trước, khôi phục. Lưu JSON tại `ticketbox:admin-appearance:<accountId>` trong localStorage của origin/trình duyệt. Tài khoản khác có key khác; không sync qua server/thiết bị. Storage lỗi/bị chặn dùng mặc định hoặc báo chỉ áp dụng trong phiên. Chưa browser-test hai tài khoản thật; cách ly key có unit test.

Đã browser-test Arial/Lớn, reload giữ preference, chuyển trang, khôi phục mặc định và rời Admin sang Public không giữ scope/font. Không đổi tên, email hoặc mật khẩu trong quá trình thử.

## 7. Nhật ký và Báo cáo: giới hạn còn tồn tại

Chưa triển khai yêu cầu mặc định toàn bộ Event vì cần mở rộng API của Khôi đang bắt buộc `eventId`. Giữ chọn Event rồi Áp dụng; không dựng tổng hệ thống giả từ một Event. Thêm cột tên Event trong nhật ký bằng trường API đã có; không thêm raw token hoặc phương thức quét chưa lưu.

Event completed/cancelled vẫn tra cứu được trong bộ chọn Admin. Tìm kiếm Event hiện giới hạn 100 bản ghi; chưa có phân trang đầy đủ nên không chứng nhận danh sách đủ khi vượt 100. Browser hiện có 27 Event, không đủ để thử giới hạn này. Sau khi được duyệt, cần eventId optional tương thích ngược, tổng hợp độc lập đúng công thức, phân trang lựa chọn Event và Excel cùng phạm vi; Staff endpoints/quyền giữ nguyên.

Test client hiện xác nhận report export dùng bộ lọc đã áp dụng, không lẫn Staff/result, không giới hạn trang bảng. Không thử download/mở Excel thực tế trong lần này; Excel toàn hệ thống chưa có. Không đổi công thức doanh thu, hoàn tiền, lấp đầy/tham dự.

## 8. Kết quả kiểm tra và lỗi

| Kiểm tra | Kết quả/giới hạn |
|---|---|
| Skill verify `-Scope all` | Server typecheck/build và client lint/build đạt ở bản cuối |
| Server Vitest, loại 2 integration dùng MySQL | 35 file, 206 test đạt; không chứng minh concurrency MySQL thật |
| Client appearance/recaptcha/report-service | 16 test đạt, gồm 4 test mới preference |
| `git diff --check` | Đạt; warning LF→CRLF không phải conflict/lỗi build |
| Browser 1440×900, 768×1024, 390×844 | Đã kiểm tra các trang chính, contrast và bố cục; không phải full regression mọi tổ hợp filter/mutation |
| Danh mục | Bảng, tổng/active/inactive, modal trên mobile và focus trap/Escape đạt |
| Sự kiện | Cancelled filter, chuyển thẻ/danh sách giữ filter, mobile danh sách đạt |
| Nhân viên | Disabled filter 3 dòng, mobile không tràn, modal gọn/focus trap/Escape/return đạt; không gửi thay đổi quyền |
| Settings/Public | Lưu/reload/reset, font lớn và scope không rò sang Public đạt |
| Báo cáo Event đã hủy | Tra cứu được; dữ liệu hiển thị gross 600.000, refund 600.000, net 0, sold 2/capacity 100 = 2%, attendance 0 ở DB đang dùng |

Lỗi có sẵn khi chạy client test: fixture Checkout thiếu trạng thái bán/tồn/giới hạn, khiến 2 test reCAPTCHA không đi tới request OTP. Đã sửa fixture theo validation hiện tại, không sửa production Checkout hoặc giảm assertion.

Lỗi phát sinh trong lần sửa: cột Event tham chiếu `eventId` không có trong type log → bỏ tham chiếu, chỉ dùng `eventName`; grid Nhân viên bị min-content đẩy rộng mobile → minmax(0,1fr)/min-width và select; chữ/nút portal còn màu tối cũ → contrast scoped. Đã kiểm tra lại sau sửa; bản cuối build không lỗi.

Chưa kiểm tra: Google sign-in thật/SMTP/email gửi thật/camera QR; OTP và giữ chỗ end-to-end; MySQL race condition; mutation cập nhật thống kê; các trang với mọi tổ hợp preference; Excel nội dung thực tế và nhiều hơn 100 Event. Không chạy destructive integration/seed trên DB đang sử dụng. Không có bằng chứng mới để tick Trello hoàn tất.

## 9. Tự kiểm tra và chụp minh chứng

Từ thư mục repo, cả Windows PowerShell và macOS Terminal dùng các lệnh sau (macOS dùng đường dẫn clone của bạn thay cho ổ C):

```text
cd server
npm run typecheck
npm run build
npm test -- --exclude tests/checkout.integration.test.ts --exclude tests/ticket-credential.integration.test.ts
cd ../client
npm run lint
npm run build
node --test tests/admin-appearance.test.cjs tests/recaptcha.test.cjs tests/report-service.test.cjs
```

Lệnh test trên chỉ chọn bộ không cần integration MySQL hiện tại; không thay thế kiểm thử DB thật. Không chạy `001_initial_schema.sql`, seed hay integration trên DB có dữ liệu cần giữ. Chỉ dùng database dùng thử riêng khi nghiệm thu nghiệp vụ giữ chỗ/check-in concurrency.

Nếu server/client chưa chạy, mở hai terminal và dùng `npm run dev` trong mỗi thư mục. Server khởi động các job lifecycle/publish/expiry hiện có; chỉ chạy khi bạn chấp nhận job xử lý dữ liệu tới hạn. Trong lần kiểm tra này server là tiến trình bạn đã chạy sẵn.

Ảnh cần chụp:

1. Login và Tổng quan nền sáng; logo/covers còn, không có nền trang trí.
2. Danh mục ở Tổng/Đang hoạt động/Đã vô hiệu hóa, chụp số đếm và dòng kết quả; lọc kết hợp tên rồi xóa lọc.
3. Sự kiện cùng một bộ lọc ở thẻ và danh sách; Hạng vé đúng Event đang chọn.
4. Nhân viên: Chờ duyệt/Hoạt động/Ngưng quyền/Tổng; mở modal rồi **Hủy**, không kích hoạt/khóa tài khoản thật chỉ để chụp.
5. Cài đặt Arial/Lớn và preview; reload còn lựa chọn; sang modal kiểm tra font; Khôi phục; rời Admin kiểm tra Public/Staff không đổi.
6. DevTools responsive 1440/768/390px; bảng chỉ cuộn trong panel, toolbar/nhân viên/modal không tràn. Dùng Tab/Shift+Tab/Escape; focus quay về nút mở.
7. Nhật ký chọn Event có lượt quét, chụp thời gian/nhân viên/mã vé/hạng vé/tên Event/kết quả. Mã không tìm thấy phải có trạng thái rỗng rõ, không raw QR.
8. Báo cáo chọn Event và khoảng ngày, Áp dụng rồi chụp chỉ số/biểu đồ; xuất Excel và tự so sánh Event/date/groupBy, doanh thu/hoàn/thuần, vé bán, sức chứa, tham dự. Thay filter chưa Áp dụng phải không xuất dữ liệu lệch. Không chụp thành “Tất cả sự kiện” khi API chưa hỗ trợ.
9. Chụp terminal build/test đạt; ghi rõ integration/SMTP/camera chưa chạy, không dùng unit mock làm bằng chứng giao dịch thật.

Kiểm tra đầy đủ các segment/mutation trên database dùng thử có dữ liệu hỗn hợp; không tự biến đổi dữ liệu thật để tạo ảnh. Hình minh chứng chưa được lưu thành file trong repo ở lần này; các bước trên dành cho bạn tự chụp.

## 10. Quyết định cần xác nhận

1. Cho phép mở rộng API Logs/Reports của Khôi để bỏ trống `eventId` = toàn hệ thống, giữ tương thích Event riêng; xử lý danh sách Event >100/phân trang và Excel đúng scope. Đây là thay đổi contract, chưa làm.
2. Cho phép gỡ ba preview danh mục cố định Music/Conference/Food tại Home của Tài, giữ trang danh sách/bộ lọc/Retrieval. Công cụ bảo vệ đã từ chối thao tác gỡ trước khi có xác nhận; không bỏ qua hạn chế đó.

Không cần sửa schema để thay theme/font hay đổi nội dung demo. Chuyển dữ liệu cũ, chạy seed lại hoặc ép chỉ chấp nhận concert ở API là quyết định riêng chưa được thực hiện.
