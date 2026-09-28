# TicketBoxQR — Luồng nghiệp vụ và phạm vi hiện tại

Ngày đối chiếu: **27/09/2026**. Nguồn: mã nguồn đang có trong `C:/React/ticketbox/ticketbox-QR`, schema, cấu hình, lockfile và các test đã chạy trong lần rà soát này. HEAD là `1146eca`; working tree còn các sửa đổi P0/P1 chưa commit. Tài liệu mô tả cả các sửa đổi đó, không chỉ nội dung commit.

Đây là tài liệu giải thích và rà soát; không phải xác nhận toàn bộ hệ thống đã nghiệm thu. Các kết luận từ đọc code và kết quả chạy test được phân biệt ở phần cuối.

## 1. Phạm vi đã chốt

Theo yêu cầu ngày 27/09/2026, dự án tập trung hoàn thiện các luồng đang có:

| Thành viên | Trách nhiệm nghiệp vụ | Phần dùng chung cần phối hợp |
|---|---|---|
| Bửu | Danh mục, Event, Ticket Type, Staff; nền tảng đăng nhập, phân quyền, database, Dashboard và ảnh Event dùng Cloudinary để lưu hình ảnh | Điều kiện mở bán, tồn vé, hủy Event, lịch và quyền check-in |
| Tài | Public Event, xem chi tiết sự kiện, Checkout, xác minh email, Order, Payment mô phỏng, QR, gửi Email, tìm lại vé, Admin Orders và Refund mô phỏng đã có | Giá/tồn vé từ Bửu; QR và trạng thái vé giao cho Khôi |
| Khôi | Chọn Event được phân công, Scanner, check-in, nhật ký, Reports và xuất Excel | Quyền Staff từ Bửu; Order confirmed và QR Ticket hợp lệ từ Tài |

Hướng công việc tiếp theo trong phạm vi này là sửa lỗi, kiểm thử, đối chiếu số liệu và chuẩn bị demo. Các ghi chú cũ về notification center Admin hoặc mở rộng báo cáo không còn được xem là yêu cầu phát triển mới. Tài liệu này ghi nhận quyết định phạm vi; README và Trello chưa được sửa trong lần rà soát này.

Khách mua vé bằng email, không cần tài khoản. Chỉ có hai vai trò tài khoản trong database: `admin` và `staff`. Người mua không phải một vai trò đăng nhập thứ ba.

Payment và Refund là **mô phỏng cho đồ án**. Chức năng đang có không chuyển tiền qua ngân hàng hoặc cổng thanh toán.

## 2. Toàn bộ dự án nối với nhau như thế nào?

1. Bửu tạo danh mục, Event nháp, các hạng vé và phân công Staff.
2. Admin công bố Event đã đủ điều kiện; Public đọc thông tin và khả năng bán từ API.
3. Khách chọn hạng/số lượng, nhập thông tin và xác minh email bằng OTP.
4. Tài tạo Order, giữ số lượng vé trong 10 phút.
5. Khách xác nhận thanh toán mô phỏng hoặc nhận vé miễn phí qua cùng endpoint thanh toán.
6. Hệ thống xác nhận Order, ghi Payment, chuyển vé giữ sang vé đã bán, phát hành từng Ticket và tạo công việc gửi email.
7. Worker gửi email có QR. Khi cần, khách tìm lại vé qua email hoặc Admin xếp lịch gửi lại QR gốc.
8. Staff đã được phân công chọn Event và quét QR/nhập mã vé. Backend của Khôi quyết định cho vào hay từ chối.
9. Admin xem lịch sử, số vé, lượt vào và số tiền mô phỏng; xuất Excel theo bộ lọc.

Nhánh ngoại lệ xuyên cả ba phần là **hủy Event**: dừng bán, giải phóng giữ chỗ, vô hiệu hóa vé, thu hồi phân công, ghi Refund mô phỏng và xếp lịch email thông báo, đồng thời giữ lịch sử giao dịch/check-in.

## 3. Bửu — Danh mục

Màn hình: `/admin/categories`. Public đọc danh mục qua `/api/categories`.

| Thao tác | Hành vi hiện tại và điều kiện |
|---|---|
| Tạo | Nhập tên, slug, mô tả, icon, trạng thái và thứ tự hiển thị; kiểm tra trùng tên/slug |
| Sửa | Cập nhật nội dung; slug đã có Event tham chiếu không được đổi |
| Bật/tắt | Danh mục tắt không dùng để chọn mới cho Event; Event cũ giữ quan hệ lịch sử |
| Xóa | Chỉ khi không có Event tham chiếu; nếu đã dùng thì vô hiệu hóa |
| Lọc | Tổng danh mục/đang hoạt động/đã vô hiệu hóa và tìm kiếm; số Event liên kết giúp nhận biết danh mục đã được dùng |
| Public | Chỉ liệt kê danh mục active; Public lọc Event bằng slug, database liên kết bằng ID |

Điểm cần hiểu: tắt danh mục không đồng nghĩa hủy các Event thuộc danh mục đó. Event có lifecycle và visibility riêng.

Nguồn: [service Danh mục](../../server/src/modules/categories/admin-categories.service.ts), [màn hình](../../client/src/pages/admin/AdminCategoriesPage.tsx).

## 4. Bửu — Event

Màn hình: `/admin/events`. Event có hai thuộc tính khác nhau: `status` là giai đoạn nghiệp vụ; `visibility` là hiển thị Public.

| Bước/nhánh | Quy tắc trong code |
|---|---|
| Tạo bản nháp | Chọn danh mục đang hoạt động; nhập tên, mô tả, địa điểm, thành phố, sức chứa, ảnh, lịch sự kiện, lịch bán và cửa sổ check-in |
| Tải ảnh | Admin lấy chữ ký upload từ Backend; trình duyệt gửi ảnh trực tiếp tới Cloudinary; Event lưu URL và public ID |
| Chuẩn bị hạng vé | Tạo ít nhất một hạng active hợp lệ; tổng sức chứa hạng vé không vượt sức chứa địa điểm |
| Kiểm tra sẵn sàng | Kiểm tra ảnh, địa điểm, sức chứa, thời gian tương lai, lịch bán/check-in và hạng vé hợp lệ trước khi publish |
| Công bố ngay | Chỉ Event draft, đủ readiness mới chuyển sang published |
| Hẹn công bố | Lịch phải nằm trong tương lai và trước giờ bắt đầu Event; job 30 giây kiểm tra lại readiness, ghi lý do nếu thất bại |
| Tự chuyển trạng thái | Backend đồng bộ lúc khởi động và mỗi giây: published → ongoing khi bắt đầu; ongoing → completed khi kết thúc |
| Thông báo thay đổi | Sau commit, WebSocket `/ws/events` phát tín hiệu để Admin/Public tải lại REST; đây là đồng bộ trạng thái Event |
| Ẩn/hiện | Ẩn cần lý do; không xóa giao dịch hoặc tự hủy vé; hiện Event đang mở yêu cầu còn hạng active hợp lệ |
| Sửa | Completed/cancelled chỉ đọc; sức chứa sau publish chỉ được tăng; sửa lịch khi đã bán vé bị chặn bằng `SCHEDULE_NOTIFICATION_REQUIRED` |
| Sửa lịch đã có Staff | Schema chặn thay đổi lịch khi còn phân công active; cần giải quyết các phân công trong quy trình hiện tại |
| Xóa | Chỉ bản nháp chưa có Order; repository kiểm tra quan hệ trước khi xóa |
| Giao diện | Có dạng thẻ/danh sách, bộ lọc theo status/category/search; lựa chọn dạng xem là trạng thái giao diện |

Lifecycle chính: `draft → published → ongoing → completed`; `published` hoặc `ongoing` có thể chuyển thành `cancelled`. Completed và cancelled là trạng thái kết thúc.

Check-in bắt đầu cùng ngày Việt Nam với ngày bắt đầu Event, sớm hơn ít nhất 30 phút; giờ kết thúc check-in phải sau giờ bắt đầu check-in và không muộn hơn giờ kết thúc Event. Nếu Event bắt đầu ngay sau nửa đêm, tổ hợp “cùng ngày” và “sớm hơn 30 phút” có thể không thỏa được; đây là giới hạn của quy tắc hiện có.

Public vẫn có thể xem Event completed đang visible như lịch sử, nhưng trạng thái bán phải là closed. Event cancelled bị ẩn. Có `SCHEDULE_NOTIFICATION_REQUIRED` không có nghĩa hệ thống đã có đầy đủ chức năng gửi email đổi lịch; hiện code dùng nó để chặn thao tác chưa hỗ trợ.

Nguồn: [service Event Admin](../../server/src/modules/events/admin-events.service.ts), [repository Event](../../server/src/modules/events/admin-events.repository.ts), [Public Event](../../server/src/modules/events/events.service.ts).

## 5. Bửu — Ticket Type

Màn hình: `/admin/ticket-types`, thao tác trong Event được chọn.

**Ticket Type là hạng vé**, ví dụ VIP/Standard. **Ticket là một vé cụ thể** có mã và QR sau khi một Order được xác nhận. Bửu quản lý hạng; Tài phát hành vé; Khôi sử dụng vé để check-in.

| Thao tác | Quy tắc hiện tại |
|---|---|
| Tạo hạng | Tên, mô tả, giá, sức chứa, tối đa mỗi đơn, lịch bán tùy chọn, trạng thái active; không trùng tên trong cùng Event |
| Event đã publish | Hạng mới mặc định inactive để Admin chủ động mở bán |
| Event đã đóng | Không thêm hạng; completed/cancelled khóa chỉnh sửa tồn vé |
| Điều chỉnh capacity | Không dưới reserved + sold; sau publish không được giảm; tổng capacity không vượt venue capacity |
| Đổi giá | Với Event không còn draft: đã có reserved/sold thì khóa giá; nếu chưa có giao dịch phải tạm dừng hạng trước khi đổi |
| Tạm dừng/mở lại | Chỉ published/ongoing; hết vé/hết giờ bán không mở lại; hạng cuối cùng active của Event visible được bảo vệ |
| Xóa | Không xóa hạng đã có Order tham chiếu; hạng active sau publish phải dừng trước; ràng buộc giữ ít nhất một hạng hợp lệ vẫn áp dụng |

Công thức tồn vé: **còn bán được = capacity − reserved_quantity − sold_quantity**.

Ví dụ capacity 100, đang giữ 5, đã bán 20 thì còn 75. Thanh toán 5 vé đang giữ chuyển reserved từ 5 xuống 0, sold từ 20 lên 25; số còn bán vẫn 75. Nếu 5 vé giữ hết hạn, reserved về 0 và số còn bán tăng lên 80.

`isActive=true` không tự đồng nghĩa “mua được”: còn phải thỏa status/visibility của Event, giờ bán và tồn kho. Các nhãn draft/published/ongoing thuộc Event, không phải trạng thái riêng của Ticket Type.

Nguồn: [service Hạng vé](../../server/src/modules/ticket-types/admin-ticket-types.service.ts), [màn hình](../../client/src/pages/admin/AdminTicketTypesPage.tsx).

## 6. Bửu — Staff và xác thực dùng chung

Màn hình đăng nhập `/login`; quản lý Staff `/admin/staff`; vận hành cổng `/staff`.

1. Người mới đăng nhập bằng Google. Frontend nhận Google ID token; Backend xác minh token, audience, danh tính Google `sub` và email đã xác minh.
2. Lần đầu tạo Staff `pending`, inactive; chưa cấp phiên TicketBox để dùng cổng.
3. Admin duyệt hoặc từ chối. Duyệt kích hoạt tài khoản nhưng chưa tự gán Event.
4. Admin sửa tên, chọn Event để phân công. Một người dùng cùng tài khoản cho nhiều Event không trùng giờ; một Event có nhiều Staff.
5. Gán bị từ chối nếu Staff chưa duyệt/inactive, Event đóng/đã hết giờ, đã gán active hoặc lịch Event giao nhau.
6. Thu hồi một phân công giữ lịch sử. Vô hiệu hóa/từ chối Staff thu hồi các phân công active và các refresh session, giữ account và log.
7. Tái kích hoạt Staff đã duyệt không tự phục hồi toàn bộ phân công cũ; Admin quản lý phân công lại.

Ngoài Google Staff, tài khoản local/seed hiện có đăng nhập email + mật khẩu; không có form đăng ký mật khẩu Staff mở cho mọi người. Không tự ghép Google với tài khoản local chỉ vì email giống nhau.

Xác thực gồm access JWT (mặc định 15 phút) và refresh token trong cookie HttpOnly (mặc định 7 ngày). Refresh token được hash trong `auth_sessions` và thay token khi refresh. Access token giữ trong bộ nhớ client; khi tải lại trang, client dùng refresh để khôi phục phiên. Backend đọc lại user active ở request được bảo vệ và kiểm tra role; ẩn menu ở Frontend không thay thế kiểm tra này.

Giới hạn cần hiểu: logout thu hồi refresh session. Access JWT không gắn session ID để kiểm tra thu hồi theo từng session; không nên mô tả logout là vô hiệu ngay mọi access JWT đã phát hành. Vô hiệu hóa user có thêm kiểm tra user active ở Backend.

Nguồn: [Staff service](../../server/src/modules/admin-staff/admin-staff.service.ts), [Auth service](../../server/src/modules/auth/auth.service.ts), [authenticate](../../server/src/middlewares/authenticate.ts).

## 7. Tài — Public, OTP và tạo Order

Các trang Public: `/`, `/events`, `/events/:id`, `/checkout/:id`, `/orders/:id`.

### Public

Khách tìm Event theo từ khóa, danh mục, thành phố và cách sắp xếp, xem phân trang và chi tiết; chọn hạng vé/số lượng dựa trên dữ liệu API. Public chỉ đọc Event được phép hiển thị. Giá thanh toán được Backend đọc lại từ database, không lấy giá người dùng tự gửi lên.

### Xác minh email

| Thuộc tính | Giá trị/hành vi hiện có |
|---|---|
| reCAPTCHA | v3, action `checkout_email`; Backend xác minh action và score, ngưỡng mặc định 0,5; kiểm tra hostname khi có cấu hình |
| Giới hạn gửi | Khóa độc lập theo IP và email trong từng action/scope, cooldown 60 giây; HTTP 429 kèm thời gian chờ |
| Phiên Checkout | Header `X-Checkout-Session`, UUID, gắn xác minh với phiên |
| OTP | 6 chữ số, tồn tại 5 phút, chỉ lưu hash trong bộ nhớ NodeCache |
| Sai mã | Lần sai thứ 5 xóa OTP và trả `EMAIL_CODE_ATTEMPTS_EXCEEDED` |
| Đúng mã | Xóa OTP; cấp verification token dùng cho tạo Order, hiệu lực 15 phút |
| Ràng buộc | Token phải khớp email và phiên; tiêu thụ sau khi tạo Order mới thành công |
| Gửi OTP | Gọi dịch vụ email trong request; không dùng hàng đợi gửi vé |

Nhà cung cấp gửi email hiện được cấu hình qua Gmail trong Nodemailer. Điều đó không yêu cầu người mua phải dùng địa chỉ Gmail; form mua nhận email nói chung.

### Tạo Order và giữ chỗ

1. Client gửi buyer, Event, danh sách hạng/số lượng, verification token, session và `Idempotency-Key`.
2. Backend khóa Event; kiểm tra yêu cầu dùng lại key có khớp đơn cũ không. Yêu cầu khớp dùng lại đơn, không tạo thêm đơn/giữ chỗ; khác nội dung trả conflict.
3. Với đơn mới, kiểm tra email, Event visible/published hoặc ongoing, giờ bán Event và giờ kết thúc.
4. Khóa các hạng vé; kiểm tra thuộc đúng Event, active, lịch bán, maxPerOrder và số còn lại.
5. Tính tiền từ giá database; lưu Order pending_payment, Order Items với tên/giá tại lúc mua và tăng reserved trong cùng transaction.
6. Trả mã đơn và lookup token. Client giữ token theo tab trong sessionStorage/navigation state, gửi lookup bằng **POST JSON body**, không query string.
7. Giữ chỗ 10 phút. Job 30 giây dọn đơn hết hạn; đọc đơn hoặc thanh toán cũng kiểm tra hết hạn để nhả giữ chỗ kịp thời.

Một Order thuộc một Event, có thể có nhiều Order Items/hạng; quantity của một item tạo nhiều Ticket khi thanh toán. Không có giỏ mua nhiều Event chung một Order trong luồng hiện tại.

Nguồn: [Checkout service](../../server/src/modules/checkout/checkout.service.ts), [OTP](../../server/src/services/email-verification.service.ts), [chống lạm dụng email](../../server/src/services/public-email-security.service.ts), [client Order service](../../client/src/services/order.service.ts).

## 8. Tài — Payment, Ticket và QR

1. Khách mở trang Order bằng lookup token hợp lệ và xác nhận thanh toán.
2. Trong transaction, khóa Event rồi Order; kiểm tra token, trạng thái pending_payment và thời hạn.
3. Nếu hết hạn, chuyển expired và commit nhả tồn trước khi trả lỗi; không tiếp tục phát hành vé.
4. Nếu hợp lệ, Order thành confirmed; reserved giảm, sold tăng; tạo Payment success với method `free` khi bằng 0 hoặc `simulated` khi có tiền.
5. Tạo từng Ticket `issued`, mã `TKT-…`, ngẫu nhiên QR token và dữ liệu bảo vệ token.
6. Tạo `email_logs` loại `ticket_issued` pending trong transaction; commit rồi trả kết quả và hình QR cho người mua. Worker xử lý email riêng.

QR chứa `ticketbox:<raw-token>`. Database lưu SHA-256 của token để tra cứu khi quét, đồng thời lưu ciphertext AES-256-GCM để server khôi phục đúng QR khi gửi lại email. Ciphertext gắn với ticket code để chống tráo; không dùng ciphertext làm khóa check-in.

Phân biệt ba mã:

| Mã | Mục đích |
|---|---|
| Order code `TBQ-…` | Đối chiếu đơn mua |
| Order lookup token | Quyền đọc/thanh toán đơn của khách chưa đăng nhập |
| Ticket code `TKT-…` và QR token | Một vé cụ thể; Staff có thể nhập ticket code hoặc quét QR |

Nhấn thanh toán lại sau confirmed bị từ chối; code không tạo thêm Payment/Ticket. Hệ thống không có webhook đối soát ngân hàng trong luồng này. Các status Payment pending/failed/cancelled tồn tại trong schema không chứng minh giao diện có đầy đủ mọi kịch bản của cổng thanh toán thật.

## 9. Tài — Email, tìm lại vé và Admin Orders

### Ba nhóm email khác nhau

| Nhóm | Khi gửi | Cách xử lý |
|---|---|---|
| OTP | Khách yêu cầu xác minh email | Gửi trực tiếp trong request; mã 5 phút |
| `ticket_issued` / `ticket_resent` | Thanh toán xong / tra cứu / Admin gửi lại | Queue trong MySQL, worker 15 giây, mỗi batch tối đa 5 job; tối đa 5 attempt, retry lỗi tạm thời theo 1/5/15/60 phút |
| `order_cancelled` | Hủy Event | Worker riêng, chu kỳ 60 giây, batch tối đa 20; tối đa 3 attempt, retry lỗi tạm thời sau 5 phút |

Hai worker queue có claim bằng `FOR UPDATE SKIP LOCKED`, lease 5 phút và phục hồi job processing bị treo. SMTP chạy ngoài transaction; thất bại gửi thư không rollback việc mua/hủy Event. Ghi kết quả theo attempt/lease để worker cũ không ghi đè worker mới.

“Đã xếp lịch” khác “SMTP đã nhận”, và SMTP đã nhận vẫn không chứng minh thư đã vào inbox. Nếu SMTP nhận thư nhưng server mất kết nối trước khi lưu kết quả, retry có thể gửi lại; không nên hứa email exactly-once.

### Tìm lại vé

Khách nhập email trong `TicketRetrievalForm` → reCAPTCHA action `ticket_retrieval` → kiểm tra giới hạn IP/email → tìm Orders confirmed → xếp lịch `ticket_resent`. Phản hồi thành công dùng một thông báo chung, không trả danh sách đơn của email ra Public. Worker giải mã QR gốc và kiểm tra hash trước khi gửi, không đổi token.

Code gửi lại chọn Ticket `issued`, không chọn checked_in/cancelled. Vé legacy thiếu ciphertext không khôi phục được và trả lỗi có kiểm soát. Điểm kiểm tra context Event hết hạn còn thiếu được ghi trong phần phát hiện bên dưới.

### Admin Orders

Màn hình `/admin/orders` có danh sách phân trang, tìm theo email, chọn Event, lọc status bằng metric cards/dropdown, chi tiết Order Items/Tickets/Payments/Refund/Email Logs.

Admin có thể:

- Hủy trực tiếp **pending_payment** và nhả reservation. Đơn confirmed giữ lịch sử; không chuyển confirmed thành cancelled bằng nút hủy đơn.
- Xếp lịch gửi lại vé, hoặc tạo lượt gửi mới từ một email-log gửi vé failed; không dùng endpoint này để retry `order_cancelled`.
- Cập nhật Refund đã được tạo trong luồng hủy Event: pending → processing → completed hoặc failed; failed → processing để thử lại mô phỏng. Completed là kết thúc; amount/order không được đổi.

Schema còn có `not_required`: khi hủy Event có Order miễn phí, code tạo Refund amount 0 với trạng thái này; không cần hoàn tiền mô phỏng. Schema cho một số chuyển trạng thái rộng hơn API; phải phân biệt khả năng lưu của database với thao tác UI hiện cho phép.

Nguồn: [Admin Orders service](../../server/src/modules/orders/admin-orders.service.ts), [ticket-email repository](../../server/src/modules/tickets/ticket-email.repository.ts), [delivery service](../../server/src/services/ticket-email.service.ts).

## 10. Khôi — Scanner và check-in

1. Staff đăng nhập và gọi `/api/staff/events`. Danh sách chỉ có phân công active, Event published/ongoing và chưa qua end_time. Một Event trong danh sách vẫn có thể chưa tới cửa sổ check-in.
2. Staff chọn Event, bật camera hoặc nhập ticket code/nội dung QR.
3. Camera dùng `getUserMedia` + canvas + jsQR, thử đọc mỗi 250 ms, giảm khung hình tối đa 720 px theo cạnh lớn. Cần HTTPS hoặc localhost và quyền camera.
4. Khi đọc mã, camera dừng; giao diện khóa request và yêu cầu bấm “Vé tiếp theo”. Khi mất mạng, không tự gửi lại request nghiệp vụ; Staff kiểm tra lịch sử trước khi thử lại.
5. Backend xác thực active Staff/role, kiểm tra phân công, lifecycle và cửa sổ check-in bằng giờ database.
6. Với QR, bỏ tiền tố và hash token để tìm Ticket; với mã nhập tay, tìm ticket_code. Kiểm tra đúng Event, Order confirmed, Ticket chưa hủy/chưa check-in.
7. Khóa Event → Order → Ticket; cập nhật có điều kiện `issued → checked_in`, lưu người quét và thời gian; ghi log trong transaction.
8. Hiển thị kết quả; cho Staff xem 20 lần quét gần nhất của chính họ tại Event này.

| Kết quả | Ý nghĩa |
|---|---|
| `SUCCESS` | Vé hợp lệ và vừa được check-in |
| `INVALID` | Không tìm thấy hoặc QR sai định dạng |
| `WRONG_EVENT` | Vé thuộc Event khác |
| `STAFF_NOT_ASSIGNED` | Staff không có phân công active cho Event |
| `EVENT_NOT_AVAILABLE` | Lifecycle hoặc giờ check-in không cho phép |
| `CANCELLED` | Vé đã bị hủy |
| `UNPAID` | Order chưa confirmed |
| `ALREADY_CHECKED_IN` | Vé đã dùng |

Các từ chối nghiệp vụ được lưu log; lỗi trước khi vào nghiệp vụ như thiếu token, sai role hoặc payload không hợp lệ đi qua middleware nên không đồng nghĩa mọi HTTP error đều có checkin_logs. Log lưu hash/mã che, không lưu QR thô. Giới hạn quét hiện là 180 request/phút theo Staff.

Nguồn: [Scanner](../../client/src/components/checkin/CameraScanner.tsx), [Staff page](../../client/src/pages/staff/StaffHomePage.tsx), [Check-in service](../../server/src/modules/checkins/checkin.service.ts).

## 11. Khôi — Logs, Reports và Excel

Admin dùng `/admin/checkins` và `/admin/reports`; cả hai cùng dùng `AdminOperationsPage` với hai chế độ.

Logs lọc Event, từ ngày/đến ngày, Staff và mã kết quả; phân trang 20 dòng ở UI; xuất tối đa 10.000 dòng theo bộ lọc. API xuất giới hạn 5 request/phút theo tài khoản Admin.

Reports tổng hợp từng nguồn riêng trong transaction chỉ đọc với consistent snapshot, tránh việc join Payments × Tickets × Logs làm nhân tiền/số lượng.

| Chỉ số | Cách tính trong code | Mốc thời gian khi lọc |
|---|---|---|
| Đơn xác nhận | Đếm Orders confirmed | `confirmed_at` |
| Vé đã bán | Tổng quantity của Orders confirmed | `confirmed_at` |
| Vé phát hành | Đếm Tickets đã tạo, kể cả vé sau đó đổi trạng thái | `issued_at` |
| Vé đã vào cổng | Số ticket_id khác nhau có log SUCCESS | `checked_at` |
| Tổng lần quét | Tất cả checkin_logs thuộc bộ lọc | `checked_at` |
| Lần quét từ chối | Logs không phải SUCCESS | `checked_at` |
| Đã thu mô phỏng | Tổng Payments success | `paid_at` |
| Đã hoàn mô phỏng | Tổng Refunds completed | `completed_at` |
| Thu ròng mô phỏng | Đã thu − đã hoàn trong kỳ | Theo hai mốc riêng ở trên |

Ví dụ kỳ này chỉ có khoản hoàn cho đơn mua từ kỳ trước thì thu ròng kỳ này có thể âm. Một Ticket từng SUCCESS rồi bị hủy Event vẫn nằm trong số lượt vào lịch sử. “Vé đã phát hành” không có cùng nghĩa với “vé hiện còn issued”.

ExcelJS tạo `.xlsx` với sheet bộ lọc và sheet dữ liệu, tiêu đề, định dạng số tiền, bộ lọc và cố định hàng đầu. Đây là xuất số liệu dạng bảng; code Reports hiện không render biểu đồ Recharts.

Nguồn: [Report repository](../../server/src/modules/reports/report.repository.ts), [Excel export](../../server/src/modules/reports/report.export.ts), [màn hình Reports/Logs](../../client/src/pages/admin/AdminOperationsPage.tsx).

## 12. Hủy Event — điểm giao giữa ba thành viên

Trong một transaction, repository khóa Event và Orders, ẩn Event, tạo email thông báo, giải phóng holds, hủy pending payments/orders, ghi Refund cho confirmed Orders, hủy Tickets issued/checked_in, thu hồi phân công Staff, dừng hạng vé rồi chuyển Event cancelled.

| Dữ liệu trước hủy | Sau hủy |
|---|---|
| Event published/ongoing | cancelled, hidden |
| Order pending_payment | cancelled, reserved được giải phóng |
| Order confirmed | Vẫn confirmed để giữ lịch sử |
| Payment success | Vẫn success |
| Ticket issued/checked_in | cancelled; QR không còn được check-in |
| Order confirmed có tiền | Một Refund pending mô phỏng |
| Order confirmed miễn phí | Refund not_required, amount 0 |
| Staff assignment active | Bị thu hồi, giữ dòng lịch sử |
| Email thông báo | Xếp lịch order_cancelled; gửi ngoài transaction |
| Logs/Reports | Giữ bằng chứng; chỉ trừ tiền khi Refund completed |

Ẩn Event và hủy Event là hai thao tác nghiệp vụ khác nhau. Hủy một đơn đang giữ chỗ cũng khác hủy toàn bộ Event.

## 13. Kết quả rà soát: những điểm cần hiểu hoặc sửa trong luồng hiện có

Đây là phát hiện của đợt đọc code, không phải danh sách chức năng mới. Năm điểm ưu tiên đã được sửa trong source ngày 27/09/2026; các giới hạn vận hành còn lại được giữ nguyên vì nằm ngoài phạm vi đề tài.

| Mức độ | Điểm quan sát được | Ảnh hưởng và hướng xử lý trong phạm vi hiện tại |
|---|---|---|
| Đã sửa | Public và Checkout dùng cùng quy tắc: lịch hạng vé chỉ được thu hẹp lịch Event; thời điểm hiệu lực là mở muộn hơn và đóng sớm hơn giữa hai lịch. | Public không còn quảng bá on-sale khi Checkout sẽ từ chối do lịch Event. Helper dùng chung nằm ở `event-sales.ts`; SQL list áp dụng cùng giao hai khoảng thời gian. |
| Đã sửa | Gửi lại vé kiểm tra Event ở cả lúc enqueue và lúc worker chuẩn bị email; Ticket Retrieval chỉ chọn Order confirmed có Ticket issued của Event published/ongoing chưa kết thúc. | Event completed/cancelled hoặc đã qua `end_time` không tạo job gửi lại mới; job cũ cũng không thể gửi trễ. QR gốc và lịch sử Email Log không bị thay đổi. |
| Đã sửa | Email vé, Public Payment, Reports UI/Excel và các nhãn quản trị liên quan ghi rõ Payment/Refund là mô phỏng. | Không còn diễn đạt các số tiền như giao dịch ngân hàng/cổng thanh toán thật. |
| Đã sửa | Admin Orders stats nhận `eventId`; metric card giữ Event filter và chỉ reset email/status không tương thích. | Count và danh sách cùng dùng phạm vi Event ổn định; email search không được trình bày như tổng toàn cục. |
| Đã sửa | `listAdminEvents()` đọc toàn bộ các trang 50 bản ghi với thứ tự phân trang ổn định. | Admin Events, bộ chọn Event của Ticket Types và Staff không còn thiếu dữ liệu khi có hơn 50 Event. |
| Đã sửa kiểm thử | Test harness Ticket Retrieval đã mock `useId` giống hook component đang dùng. | Hai test form trước đây lỗi do harness nay chạy pass; đây vẫn là test mô phỏng, không thay thế browser UAT reCAPTCHA thật. |
| Giới hạn vận hành hiện tại | OTP/rate-limit trong NodeCache; WebSocket broadcast trong bộ nhớ một tiến trình. | Dùng/giới thiệu dự án với một server process. Restart làm mất OTP đang chờ; chưa có bảo đảm đồng bộ nhiều instance. Không cần mở thêm hạ tầng để đáp ứng mục tiêu đồ án hiện tại. |
| Cách hiểu Dashboard | `totalRevenue` cộng Orders confirmed; Reports net trừ Refund completed. Dashboard `totalIssuedTickets` chỉ đếm status issued, Reports issuedTickets đếm vé đã tạo. | Không đối chiếu hai số khác định nghĩa như cùng một chỉ số. Đây là khác biệt cách tính có thể giải thích khi demo. |
| Chênh tài liệu/cấu trúc | README còn task notification center; AGENTS còn ghi GET lookup cần sửa dù source đã POST; AGENTS nhắc `.gitattributes` nhưng file này không có tại root hiện tại. | Nên đồng bộ tài liệu với phạm vi và source khi thực hiện đợt chỉnh tài liệu tiếp theo; không suy ra tính năng từ checklist cũ. |

Về kiến trúc, mẫu Route → Controller → Service → Repository là định hướng chính, nhưng chưa tuyệt đối: `admin-staff.service.ts` còn thực thi SQL trực tiếp trong transaction; `auth.service.ts` tự điều phối transaction; route upload chứa logic ký Cloudinary. Đây là mô tả cấu trúc thực tế, không phải đề xuất refactor diện rộng.

## 14. Bằng chứng kiểm tra ngày 27/09/2026

| Kiểm tra | Kết quả |
|---|---|
| Đọc module nghiệp vụ, route, schema, UI/service, manifest và lockfile | Đã thực hiện cho ba nhóm trách nhiệm và các phần dùng chung |
| Backend tests không cần MySQL thật | **30 file / 146 test pass**, gồm test hồi quy lịch bán, Event hết hạn khi gửi vé, stats theo Event và nội dung mô phỏng; loại rõ hai file integration khỏi lệnh |
| Client reCAPTCHA/form test | **7/7 pass**; test harness đã bổ sung mock `useId` mà component Ticket Retrieval đang dùng |
| MySQL integration/clean install/concurrency | Lệnh toàn bộ suite đã chạy nhưng hai file integration tự từ chối vì `DB_NAME` không phải database dùng một lần `ticketboxqr_test_*`; không xem hai file này là pass |
| Browser UAT Google/reCAPTCHA/SMTP/camera/Excel | Chưa thực hiện trong đợt này |
| Lint/build/typecheck | Client ESLint, TypeScript/Vite production build; Server typecheck, test typecheck và build đều pass khi gọi package cục bộ bằng Node |

Lệnh Backend đã chạy từ `server`: `node node_modules/vitest/vitest.mjs run --exclude tests/checkout.integration.test.ts --exclude tests/ticket-credential.integration.test.ts`.

Lệnh Frontend đã chạy từ `client`: `node --test tests/recaptcha.test.cjs`.

Lệnh `npm` trong phiên shell rà soát đang trỏ đến `npm-cli.js` không tồn tại dưới thư mục người dùng. Đã chạy test trực tiếp bằng Node và package có sẵn; không thay đổi cài đặt máy. Node quan sát được: v24.14.1. Không dùng lỗi launcher này để kết luận code dự án lỗi.

Lần 25/09 đã ghi nhận user MySQL thiếu quyền tạo database test. Chưa kiểm tra lại quyền đó ngày 27/09; không khẳng định nó vẫn thiếu chỉ dựa trên lịch sử.

## 15. Các tình huống nghiệm thu đủ cho luồng đã chốt

| Người phụ trách | Tình huống cần chứng minh |
|---|---|
| Bửu | Danh mục đang được dùng không xóa được; Event thiếu hạng/ảnh không publish; ẩn khác hủy; không tắt hạng cuối; không vượt capacity; Staff pending/inactive không vận hành; gán trùng giờ bị chặn |
| Tài | OTP sai lần 5/hết hạn; retry tạo Order không trùng; tranh vé không oversell; hết 10 phút nhả vé; thanh toán lại không phát hành trùng; gửi lại giữ QR gốc; email lỗi không mất Order; Refund mô phỏng giữ lịch sử |
| Khôi | Đúng vé/nhầm Event/vé hủy/chưa thanh toán/quét trùng/ngoài giờ/thu hồi quyền; hai Staff cùng quét chỉ một SUCCESS; camera và nhập tay; Logs/API/Excel khớp |
| Cả nhóm | Hủy Event trong lúc có đơn pending, confirmed và vé đã check-in; kiểm tra inventory, QR, Refund, email và Reports sau hủy |

## 16. Đọc tiếp để hiểu mã nguồn

- [02 — Cấu trúc Backend/Frontend, dữ liệu và API](02-cau-truc-va-du-lieu.md).
- [03 — Công cụ, toàn bộ package trực tiếp và mục đích](03-cong-cu-va-thu-vien.md).
- [04 — Danh mục package đã khóa, gồm phụ thuộc gián tiếp](04-package-lock-inventory.md).

Thứ tự đọc code dễ nhất: `client/src/routes/AppRoutes.tsx` → trang mình phụ trách → `client/src/services` → route Backend tương ứng → controller → service → repository → bảng/trigger trong schema → test của module.
