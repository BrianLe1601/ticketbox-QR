# TicketBox QR

Hệ thống quản lý vé và check-in bằng mã QR cho sự kiện, được xây dựng bằng React, Node.js và MySQL.

Repository: https://github.com/BrianLe1601/ticketbox-QR

## 1. Mục tiêu dự án

TicketBox QR hỗ trợ toàn bộ quy trình quản lý vé sự kiện:

- Admin tạo và quản lý sự kiện.
- Tạo nhiều loại vé, giá bán và số lượng khác nhau.
- Khách đặt vé bằng email, không cần tài khoản khách hàng.
- Giữ vé tạm thời trong thời gian thanh toán.
- Phát hành mã QR riêng cho từng vé.
- Gửi vé qua email.
- Phân công nhân viên check-in cho từng sự kiện.
- Quét QR hoặc nhập mã vé tại cổng.
- Ngăn một vé check-in thành công nhiều lần.
- Thống kê vé bán, doanh thu và lượt tham dự.

## 2. Thành viên và phạm vi phụ trách

| Thành viên | Phạm vi chính | Module |
|---|---|---|
| Bửu | Leader, Platform, CSDL và quản trị | Backend Auth, Login, Admin Event, Admin Ticket Type, Admin Staff, Admin Category |
| Tài | Quy trình khách mua vé và quản trị đơn hàng | Public Event, Checkout, Order, Admin Orders, Payment, Ticket, QR, Email |
| Khôi | Vận hành và báo cáo tại sự kiện | Scanner, Check-in, Admin Check-in Logs, Admin Reports |

Luồng bàn giao chính:

```text
Bửu tạo Event và Ticket Type
              ↓
Tài xây dựng Order, Payment, Ticket, QR và Email
              ↓
Khôi xây dựng Scanner, Check-in Logs và Reporting
```

## 3. Công nghệ sử dụng

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- Fetch API (`client/src/services/api.ts`)
- React Hook Form
- Zod
- Lucide React
- ESLint

### Backend

- Node.js
- Express
- TypeScript
- MySQL2
- Zod
- JSON Web Token
- bcrypt
- Helmet
- CORS
- Morgan
- Express Rate Limit
- Nodemailer
- QRCode
- Vitest
- Supertest

### Database

- MySQL
- InnoDB
- Foreign Key và Unique Constraint
- Transaction và Row Lock
- Atomic Update
- Migration SQL

## 4. Trạng thái hiện tại

Đối chiếu ngày 22/09/2026: `main` và nhánh làm việc `buu-events` cùng bắt đầu ở commit `fd510c4`. Các thay đổi Google Staff/Admin Staff hiện là **working tree chưa commit**, không có trên `main`. Quy ước:

- `[x]`: đã có trên `main`, không chỉ tồn tại ở nhánh cá nhân.
- `[~]`: đã triển khai và kiểm chứng trên nhánh sở hữu, còn chờ review/merge.
- `[ ]`: chưa hoàn tất, chưa nghiệm thu hoặc còn chờ review/merge.
- Một chức năng chỉ được tick trên README và Trello khi đáp ứng Definition of Done ở mục 16.

Đã có trên `main`:

- [x] Repository React 19 + Vite + TypeScript và Node.js + Express + TypeScript.
- [x] Schema MySQL hợp nhất gồm 13 bảng, constraints, indexes và triggers (chưa tính cột Google Staff đang sửa ở working tree).
- [x] Kết nối MySQL, seed tài khoản và `/api/health`.
- [x] Authentication, refresh-session rotation/revoke và RBAC Admin/Staff.
- [x] Admin CRUD Categories, Events và Ticket Types.
- [x] Event lifecycle, publish readiness, visibility, cancellation và đồng bộ trạng thái qua WebSocket sau khi transaction commit.
- [x] Public Home, Event List, Event Detail, search/filter và chọn loại vé.
- [x] Luồng Checkout/Order/giữ chỗ/Payment mô phỏng/Ticket/QR/Email ở mức tích hợp cơ bản.
- [x] Assigned Events, camera/manual Scanner, atomic Check-in, Recent Logs, Admin Check-in Logs, Reports và xuất Excel của Khôi đã có trên `main`.

Đã có code ở working tree nhưng chưa được xem là nghiệm thu trên `main`:

- [ ] Google Staff sign-in, duyệt/vô hiệu hóa, Event Assignment UI/API/schema/test của Bửu: cần review, commit/merge và UAT Google thật; database local đã có các cột Google Staff, nhưng chưa kiểm chứng clean-install từ SQL mới.
- [ ] Điểm vào Login/Register của khách đã được bỏ khỏi Public Header trong working tree; `/login` vẫn dành cho Admin/Staff.

Còn thiếu hoặc cần hoàn thiện:

- [ ] Admin Orders: code list/filter/detail/pagination của Tài đã có trên `develop`; cần tích hợp với UI Admin mới, Việt hóa và nghiệm thu Order/Payment/Ticket/Refund.
- [ ] Chống spam OTP: code reCAPTCHA v3, giới hạn theo IP/email/action, HTTP 429 và countdown đã có trên `develop`; cần đồng bộ owner branch và chạy lại test tích hợp.
- [ ] Ticket Retrieval và hàng đợi email vé của Tài đã có trên `develop`; cần review schema mã hóa QR, secrets, rate limit, phản hồi trung tính và tương thích Check-in trước khi nghiệm thu chung.
- [ ] Nối dữ liệu thật cho Admin Dashboard; xây notification center realtime cho Admin theo thiết kế được duyệt — Bửu. Scheduled publish và WebSocket trạng thái Event đã có, nhưng chưa phải notification center.
- [ ] Lọc Event đã completed/cancelled trong màn Staff; UAT camera trên thiết bị thật — Khôi.
- [ ] Test tích hợp end-to-end, concurrency, responsive và accessibility — cả nhóm.
- [ ] Deploy staging, sửa blocker, deploy production và chuẩn bị demo — Bửu điều phối.

Khách mua vé bằng email và không tạo tài khoản. Nhóm đã thống nhất **đưa Ticket Retrieval và controlled ticket-email redelivery vào phạm vi đồ án**, do Tài sở hữu. Khách có thể yêu cầu gửi lại vé bằng email, nhưng API luôn trả phản hồi trung tính, có reCAPTCHA/rate limit và chỉ gửi dữ liệu của Order đã xác nhận. Gửi lại phải dùng đúng QR gốc, không xoay credential; email thông báo hủy Event vẫn là workflow `order_cancelled` riêng.

## 5. Cấu trúc repository hiện có

```text
ticketbox-QR/
├── AGENTS.md                       # Quy tắc phát triển/ownership
├── README.md                       # Mục tiêu, workflow, trạng thái và cách chạy
├── client/                         # React + Vite + TypeScript
├── server/                         # Express + TypeScript
├── database/migrations/
│   └── 001_initial_schema.sql      # Clean-install schema 13 bảng; DROP/CREATE
└── scripts/verify.ps1              # Kiểm tra client và server trên Windows/PowerShell
```

Các thư mục `database/seeds`, `client/src/hooks`, `client/src/schemas` và module backend `orders`, `payments`, `tickets`, `staff` riêng **chưa tồn tại** trong repository hiện tại. Seed thực tế nằm ở `server/src/database`.

## 6. Cấu trúc frontend hiện có

- `client/src/pages/public`: Home, Event List/Detail, Checkout và Order Payment/Result.
- `client/src/pages/auth`: Login Admin/Staff; Google Staff login đang ở working tree.
- `client/src/pages/admin`: Dashboard, Categories, Events, Ticket Types, Staff đang ở working tree, Check-in Logs/Reports; Orders vẫn là placeholder.
- `client/src/pages/staff` và `client/src/components/checkin`: Assigned Events, camera/manual Scanner, Result và Recent Logs.
- `client/src/components/layout/Header.tsx`: Public Header; không có nút Login/Register sau thay đổi hiện tại.
- `client/src/layouts`, `routes`, `services`, `context`, `types`, `styles`: layout, route protection, giao tiếp API, auth state, kiểu dữ liệu và giao diện. `event-realtime.service.ts` giữ một WebSocket dùng chung, tự reconnect và yêu cầu trang gọi lại REST khi trạng thái Event đổi.

Client hiện dùng `fetch` trong `client/src/services/api.ts`; không mô tả là Axios. Trang khách không có tài khoản, nên không có route đăng ký/đăng nhập khách. Route `/login` được giữ cho Admin/Staff.

## 7. Cấu trúc backend hiện có

- `server/src/config/env.ts`, `database/pool.ts`: biến môi trường và MySQL pool.
- `server/src/modules/auth`: password login, refresh session và Google Staff identity trong working tree.
- `server/src/modules/categories`, `events`, `ticket-types`: danh mục, Event công khai/quản trị và loại vé.
- `server/src/modules/admin-staff`: duyệt/quản lý Staff và Event assignment trong working tree.
- `server/src/modules/checkout`: xác minh email, giữ chỗ, Order, simulated Payment, phát hành Ticket/QR và email đầu tiên.
- `server/src/modules/checkins`: Staff Assigned Events, check-in và Recent Logs.
- `server/src/modules/reports`: Admin Check-in Logs, Reports và export Excel.
- `server/src/services`: OTP email, gửi mail và sinh QR.
- `server/src/jobs`: Order expiry, auth-session cleanup, email thông báo hủy Event, scheduled publish và Event lifecycle mỗi giây.
- `server/src/realtime/event-status.gateway.ts`: WebSocket `/ws/events`, heartbeat `ping/pong` và broadcast trạng thái Event sau commit; không truyền dữ liệu vé/đơn hàng hoặc secret.
- `server/src/database`: seed tài khoản, dữ liệu QA và workflow verifier; `server/tests`: test hiện có.

Backend theo Route → validation/auth middleware → Controller → Service → Repository → MySQL. Transaction và SQL nằm ở repository; service điều phối nghiệp vụ. Các chức năng chưa triển khai được ghi ở mục 4 và các task tuần 4–8.
## 8. Database

Database `ticketboxqr` có các bảng nghiệp vụ cốt lõi sau:

| Bảng | Chức năng |
|---|---|
| `users` | Tài khoản Admin và Staff |
| `auth_sessions` | Refresh session đã hash, rotation và thu hồi phiên đăng nhập |
| `categories` | Danh mục Event do Admin quản lý; Event tham chiếu bằng khóa ngoại |
| `events` | Thông tin và trạng thái sự kiện |
| `event_staff` | Phân công Staff vào Event |
| `ticket_types` | Loại vé, giá, sức chứa và thời gian bán |
| `orders` | Thông tin người mua, tổng tiền và thời hạn giữ vé |
| `order_items` | Mỗi loại vé và số lượng trong đơn |
| `tickets` | Từng vé độc lập cùng QR token |
| `payments` | Các lần thanh toán của đơn |
| `refunds` | Tiến trình hoàn tiền có lịch sử kiểm toán cho đơn đã xác nhận |
| `checkin_logs` | Lưu tất cả lần quét thành công hoặc thất bại |
| `email_logs` | Theo dõi trạng thái gửi email |

Quan hệ chính:

```text
Event
├── Category
├── Ticket Types
├── Orders
└── Event Staff

Order
├── Order Items
│   └── Tickets
├── Payments
├── Refund
└── Email Logs

Ticket
└── Check-in Logs
```

## 9. Luồng hoạt động

### Luồng quản trị

1. Admin đăng nhập.
2. Admin tạo Event.
3. Admin tạo Ticket Type cho Event.
4. Admin công khai Event.
5. Admin phân công Staff.
6. Admin theo dõi đơn hàng và báo cáo.

### Đồng bộ trạng thái Event real-time

1. Backend chạy lifecycle job mỗi giây và khóa các Event tới mốc thời gian trong cùng transaction: `published -> ongoing`, sau đó `ongoing -> completed`.
2. Chỉ sau khi transaction commit, server phát thông điệp `event.lifecycle.updated` tại `ws://<api-host>/ws/events`. Công bố/hủy thủ công và scheduled publish cũng phát cùng loại thông điệp.
3. Client giữ một kết nối WebSocket dùng chung cho các trang Admin/Public. Payload chỉ có `eventId`, trạng thái và thời điểm thông báo; khi nhận được, trang gọi lại REST API để lấy dữ liệu chuẩn thay vì tự sửa trạng thái từ payload.
4. Kết nối có heartbeat 30 giây, tự reconnect với backoff và polling dự phòng 60 giây. Nếu deploy nhiều Node instance, cần thêm broker dùng chung (ví dụ Redis Pub/Sub); broadcaster hiện tại chỉ đồng bộ client nối vào cùng một process.

### Mô hình tài khoản Staff cá nhân qua Google (phần việc Bửu)

**Mỗi nhân viên có một tài khoản Staff cá nhân dùng lâu dài.** Admin không tạo lại tài khoản khi đổi Event hay đợt làm việc: cùng một Staff có thể được gán nhiều Event không trùng lịch; một Event có thể có nhiều Staff. `checkin_logs.staff_id` vì thế truy được tài khoản người thực hiện. Tài khoản dùng chung theo Event không phải mô hình mặc định, vì không xác định được cá nhân quét vé và không thể thu hồi riêng quyền của một người.

**Flow cấp và quản lý tài khoản:**

1. Nhân viên mở `/login` và đăng nhập Google. Backend kiểm tra Google ID token, email đã xác minh và `sub` ổn định. Google không quyết định quyền TicketBox: tài khoản Google mới được ghi vào `users` với role `staff`, trạng thái `pending`, `is_active = FALSE`, **không nhận access/refresh token TicketBox**. Nếu email đã thuộc một tài khoản khác, không tự liên kết.
2. Admin mở `/admin/staff`, xem danh sách chờ duyệt và đối chiếu danh tính ngoài hệ thống. Admin duyệt hoặc từ chối. Sau khi duyệt, tài khoản active nhưng vẫn chưa có quyền check-in Event nào cho đến khi được phân công. Staff dùng Google để đăng nhập lại; mật khẩu do Google quản lý. Đăng nhập mật khẩu cũ của Admin và tài khoản seed development vẫn được giữ.
3. Khi nhân viên nghỉ việc, Admin thu hồi tất cả phân công đang active, vô hiệu hóa tài khoản và thu hồi phiên đăng nhập; giữ tài khoản cùng lịch sử assignment/check-in để kiểm toán. Nếu nhân viên quay lại, Admin có thể kích hoạt và gán lại chính tài khoản cũ thay vì xóa/tạo mới.

**Flow gán nhân viên cho Event:**

1. Admin chọn Staff đang active và một hoặc nhiều Event còn ở trạng thái `draft`, `published` hoặc `ongoing`, đồng thời chưa qua `end_time`. Màn gán không hiển thị Event đã kết thúc/completed/cancelled; backend vẫn kiểm tra lại điều kiện này trong transaction.
2. Backend từ chối phân công trùng Staff–Event đang active hoặc Event có thời gian tổ chức chồng lấn với Event khác mà Staff đó đang nhận; khi hợp lệ, lưu từng phân công trong `event_staff` cùng Admin thực hiện và thời điểm gán.
3. Staff đăng nhập và chỉ thấy Event được phân công còn hiệu lực, chọn đúng Event trước khi quét QR/nhập mã. Quyền check-in vẫn phải được backend kiểm tra theo trạng thái Staff, assignment và cửa sổ check-in; đăng nhập thành công không tự cấp quyền vào mọi Event.
4. Admin gỡ phân công bằng `is_active = FALSE` và `revoked_at`, không xóa hàng lịch sử. Khi đổi lịch Event, cần xử lý các phân công active trước rồi mới gán lại theo lịch mới. Staff không thể tự gán Event; chỉ Admin xem lịch sử tổng thể.

Working tree `buu-events` có API Google login và Admin Staff UI/API cho duyệt/từ chối, kích hoạt/vô hiệu hóa, sửa tên, gán/gỡ Event và xem lịch sử phân công. Schema thêm `google_sub`, `staff_approval_status` và metadata duyệt; `password_hash` nullable chỉ để hỗ trợ tài khoản Google không có mật khẩu TicketBox. Database local đã có các cột này, nhưng **chưa kiểm chứng clean-install từ SQL mới, chưa test Google thật và chưa merge**. Các trigger chặn Staff inactive, Event đã đóng và lịch chồng lấn; thu hồi phân công xảy ra trước khi vô hiệu hóa.

API Bửu dùng cho flow này: `POST /api/auth/google`; `GET /api/admin/staff`; `PATCH /api/admin/staff/:staffId`; `PATCH /api/admin/staff/:staffId/status`; `POST /api/admin/staff/:staffId/assignments`; `DELETE /api/admin/staff/:staffId/assignments/:assignmentId`. Các API `/api/admin/staff` chỉ dành cho Admin; request Google `pending` trả HTTP 202, không kèm phiên ứng dụng.

### Luồng đặt vé

1. Khách xem danh sách Event.
2. Khách chọn Ticket Type và số lượng.
3. Backend kiểm tra số vé còn lại.
4. Backend tạo Order có `expires_at`.
5. Vé được giữ trong một khoảng thời gian.
6. Khi thanh toán thành công, Order chuyển sang `confirmed`.
7. Backend tạo từng Ticket và QR token riêng.
8. Vé được gửi đến email khách hàng.
9. Nếu hết hạn, Order bị hủy và số vé được nhả ra.

### Luồng tìm lại vé qua email

1. Khách nhập email mua vé; frontend lấy reCAPTCHA token với action riêng cho Ticket Retrieval.
2. Backend xác minh token/action/hostname/score và giới hạn theo IP, email chuẩn hóa và action.
3. API luôn trả thông báo chung, không tiết lộ email hoặc vé có tồn tại.
4. Chỉ Order `confirmed` và Ticket hợp lệ được đưa vào hàng đợi email.
5. Email chứa Event, lịch, địa điểm, hạng vé, mã vé, trạng thái, QR gốc và hướng dẫn check-in.
6. QR vẫn dùng payload `ticketbox:<raw-token>` và Check-in vẫn tra bằng hash. Bản có thể khôi phục chỉ được lưu dưới dạng ciphertext xác thực phía server để phục vụ phát hành/gửi lại.

Phần việc tiếp theo của **Tài**:

- Public Header đã gỡ điểm vào Đăng nhập/Đăng ký trong working tree; route `/login` và RBAC Admin/Staff vẫn giữ nguyên.
- Bảo vệ gửi OTP bằng reCAPTCHA v3: frontend chỉ lấy token action `checkout_email`; Ticket Retrieval dùng action `ticket_retrieval`. Backend xác minh token, action, hostname và điểm số với secret từ environment. Giới hạn riêng theo IP, email chuẩn hóa và action; gửi lại trước 60 giây trả HTTP 429 kèm thời gian chờ, frontend khóa nút và đồng bộ countdown. Giữ quy tắc OTP hết hạn, giới hạn nhập sai, dùng một lần, hash và không ghi mã vào log.
- Hoàn thiện Admin Orders, hiển thị Payment/Ticket/Refund/email delivery; tích hợp Ticket Retrieval và controlled redelivery đã có trên `develop` mà không làm lộ email có tồn tại.
- QR dùng payload `ticketbox:<raw-token>` và Check-in chỉ tra cứu bằng hash. Nếu lưu bản có thể khôi phục để gửi email, bắt buộc dùng authenticated encryption với key từ environment, ciphertext bất biến và không trả raw token/ciphertext qua API hoặc log.

### Luồng check-in

1. Staff đăng nhập.
2. Staff chọn Event được phân công.
3. Staff quét QR hoặc nhập mã vé.
4. Backend kiểm tra QR, Event, trạng thái vé và quyền Staff.
5. Backend khóa bản ghi vé trong transaction.
6. Nếu hợp lệ, vé được chuyển sang `CHECKED_IN`.
7. Mọi lần quét đều được lưu vào `checkin_logs`.
8. Scanner hiển thị kết quả thành công hoặc lý do từ chối.

## 10. Quy ước API response

Thành công:

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {}
}
```

Danh sách phân trang:

```json
{
  "success": true,
  "message": "Data retrieved",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Thất bại:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

## 11. Cài đặt và chạy project

### Clone repository

```powershell
git clone https://github.com/BrianLe1601/ticketbox-QR.git
cd ticketbox-QR
```

### Khởi tạo database

Khi chủ động reset database local, mở và chạy duy nhất file sau trong MySQL Workbench. File này có `DROP DATABASE`, vì vậy không dùng trên production hoặc database có dữ liệu cần giữ:

```text
database/migrations/001_initial_schema.sql
```

Chọn toàn bộ nội dung file và chạy một lần. Sau đó kiểm tra:

```sql
USE ticketboxqr;
SHOW TABLES;
```

Nên chạy file schema bằng tài khoản MySQL quản trị. Sau đó tạo user riêng cho backend local; thay `your_local_password` bằng mật khẩu chỉ dùng trên máy phát triển:

```sql
CREATE USER IF NOT EXISTS 'ticketbox_app'@'localhost'
IDENTIFIED BY 'your_local_password';
ALTER USER 'ticketbox_app'@'localhost'
IDENTIFIED BY 'your_local_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketboxqr.*
TO 'ticketbox_app'@'localhost';
FLUSH PRIVILEGES;
```

Không đưa mật khẩu trên vào Git và không dùng tài khoản MySQL `root` để chạy backend.

Schema gồm Users/Auth Sessions, Categories, Events, Event Staff, Ticket Types, Orders, Order Items, Tickets, Payments, Refunds, Check-in Logs, Email Logs, indexes, constraints và triggers. Báo cáo hiện truy vấn trực tiếp từ bảng nghiệp vụ, không có reporting view trong SQL.

### Chạy backend

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Điền thông tin thật trong `server/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ticketboxqr
DB_USER=ticketbox_app
DB_PASSWORD=your_password
JWT_SECRET=replace_with_a_random_secret_of_at_least_32_characters
GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
SEED_ADMIN_NAME=Admin
SEED_ADMIN_EMAIL=admin@ticketbox.local
SEED_STAFF_NAME=Staff
SEED_STAFF_EMAIL=staff@ticketbox.local
SEED_DEFAULT_PASSWORD=ticketbox@123
```

`DB_PASSWORD` phải trùng với mật khẩu `ticketbox_app` vừa tạo. Đặt `NODE_ENV=development` để cho phép seed.

Để bật Staff Google sign-in, tạo OAuth Web Client ID trong Google Cloud, cấu hình origin của client (local: `http://localhost:5173`), đặt cùng Client ID trong `server/.env` (`GOOGLE_CLIENT_ID`) và `client/.env.local` (`VITE_GOOGLE_CLIENT_ID`). Khởi động lại Vite và server sau khi sửa `.env`. Client ID không phải secret; backend vẫn phải xác minh ID token trước khi tạo hồ sơ hoặc phiên TicketBox. Nếu database chưa có cột mới, API trả `STAFF_SCHEMA_UPGRADE_REQUIRED`; sau khi có schema mà chưa cấu hình Client ID, API trả `GOOGLE_NOT_CONFIGURED`. Admin vẫn đăng nhập bằng mật khẩu. Không commit `.env` hay dùng một Google Client ID chưa cấu hình origin cho môi trường triển khai.

WebSocket trạng thái Event mặc định được suy ra từ `VITE_API_BASE_URL`, vì vậy local không cần thêm biến môi trường. Chỉ đặt `VITE_EVENT_WS_URL=wss://your-api.example/ws/events` khi reverse proxy hoặc deployment dùng host riêng; trang HTTPS phải dùng `wss://`.

`database/migrations/001_initial_schema.sql` là script **DROP/CREATE toàn bộ database**. Database local đã có các cột Google/approval, nhưng clean-install lại từ SQL hiện tại chưa được nghiệm thu. Không chạy script này trên database đang có dữ liệu cần giữ; cần backup và kế hoạch migrate tăng dần trước khi dùng với dữ liệu thật.

Tạo hoặc cập nhật hai tài khoản test từ các biến `SEED_*`:

```powershell
npm run seed
```

Seed có thể chạy lại với **tài khoản demo local**: email đã tồn tại sẽ được cập nhật tên, role, mật khẩu và kích hoạt lại. Không đặt `SEED_*_EMAIL` trùng email Google Staff hay tài khoản người thật; seed không dùng cho production.

Tài khoản mặc định từ `.env.example`:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@ticketbox.local` | `ticketbox@123` |
| Staff | `staff@ticketbox.local` | `ticketbox@123` |

Sau khi seed thành công, khởi động backend:

```powershell
npm run dev
```

Kiểm tra backend:

```text
http://localhost:3000/api/health
```

### Chạy frontend

Mở terminal khác:

```powershell
cd client
npm install
Copy-Item .env.example .env.local
npm run dev
```

Trên macOS/Linux, dùng `cp .env.example .env.local` thay `Copy-Item`. Backend tương tự: `cp .env.example .env`. Mỗi thành viên tự điền biến môi trường local; không chia sẻ `.env` qua Git. Khi đã có `package-lock.json`, ưu tiên `npm ci` ở cả `server` và `client` để cài đúng phiên bản đã khóa; `npm install` chỉ dùng khi cần cập nhật dependency/lockfile.

Frontend:

```text
http://localhost:5173
```

## 12. Lệnh kiểm tra

### Frontend

```powershell
cd client
npm run lint
npm run build
```

### Backend

```powershell
cd server
npm run typecheck
npm run build
npm test
```

Trên Windows PowerShell, từ root có thể chạy `./scripts/verify.ps1 -Scope all` (hoặc `client`/`server`). Trên macOS/Linux dùng các lệnh `npm run` ở trên trong từng thư mục; không cần chạy PowerShell. Cả hai nền tảng cần MySQL tương thích schema, Node/npm, `.env` riêng và cùng API/Google Client ID cấu hình đúng origin. Test tự động không thay thế UAT Google, email thật, camera và staging.

### Database workflow và dữ liệu kiểm thử tích hợp

Sau khi chạy lại schema và `npm run seed`, tạo bộ dữ liệu QA riêng biệt:

```powershell
cd server
npm run seed:workflows
npm run db:verify
```

`seed:workflows` chỉ quản lý dữ liệu thuộc Category `qa-workflow`, không xóa Event của Admin ở Category khác. Có thể chạy lại để thay thế bộ fixture cũ. Lệnh bị chặn hoàn toàn khi `NODE_ENV=production`.

#### Dữ liệu mẫu cho giao diện Admin

Sau khi đã có tài khoản Admin từ `npm run seed`, chạy một lệnh sau trong thư mục `server`:

```powershell
npm run seed:admin-demo
```

Lệnh tạo **18 bản ghi demo chính**: 4 Categories, 8 Events và 6 Staff; đồng thời tạo 10 Ticket Types và 6 assignment để các màn Admin có dữ liệu liên kết. Các tình huống gồm Category active/inactive; Event draft thiếu dữ liệu, draft sẵn sàng, scheduled, published đang bán/sắp bán, hidden + paused, ongoing, completed và cancelled; Ticket miễn phí/trả phí/sales window riêng; Staff Google pending/rejected/approved active/approved inactive và Staff local active/inactive; assignment đang hoạt động và đã thu hồi.

Seed này có thể chạy lại: nó chỉ thay các Event có slug `demo-admin-*`, reset các tài khoản `demo.staff.*@ticketbox.local` và cập nhật bốn Category `[DEMO]`. Nó không đụng Event/Staff thông thường. Lệnh bị chặn khi `NODE_ENV=production`. Hai Staff local demo dùng cùng password hash với Admin seed; các hồ sơ Google dùng định danh giả chỉ để kiểm tra màn Admin, không dùng để đăng nhập Google thật.

| Event fixture | Trạng thái | Dữ liệu liên quan | Mục đích kiểm thử |
|---|---|---|---|
| `[QA] Draft — Missing Cover & Ticket` | Draft | Không ảnh, không tier | Readiness phải báo thiếu ảnh và Ticket Type |
| `[QA] Draft — Ready To Publish` | Draft | Một tier đủ sức chứa | Publish happy path |
| `[QA] Published — Coming Soon` | Published/Visible | Tier active, lịch bán tương lai | Public hiển thị `coming-soon`, không cho đặt vé sớm |
| `[QA] Published — On Sale With Orders` | Published/Visible | Tier đang bán, tier Last Minute, một Order pending và một confirmed | Giữ chỗ, tồn kho, thanh toán và lịch bán riêng |
| `[QA] Hidden — All Tiers Paused` | Published/Hidden | Tất cả tier paused | Show Event phải bị chặn cho tới khi kích hoạt tier hợp lệ |
| `[QA] Ongoing — Check-in Active` | Ongoing/Visible | Staff assignment, Order confirmed, Ticket checked-in, SUCCESS log | Scanner, chống check-in sai Staff/Event |
| `[QA] Completed — Read-only History` | Completed | Tier lịch sử | Trạng thái terminal không thể mở lại |
| `[QA] Cancelled — No Orders` | Cancelled/Hidden | Không Order/Refund/Email | Hủy sự kiện chưa có khách |
| `[QA] Cancelled — Orders & Refund` | Cancelled/Hidden | Pending Order đã hủy, confirmed Order, QR invalid, Refund pending, Email pending | Toàn bộ workflow hủy có khách |

Tài khoản `qa.staff@ticketbox.local` dùng cùng mật khẩu local với Admin đã seed. Đây chỉ là dữ liệu development.

`db:verify` kiểm tra cả happy path và các thao tác bắt buộc phải thất bại: xóa Category đang được dùng, phân Staff trùng lịch, Show Event không có tier active, vượt venue capacity, mở lại Completed Event, sửa snapshot Order Item và check-in bằng Staff chưa được phân công. Mọi phép thử lỗi đều chạy trong transaction rồi rollback.

### Hợp đồng transaction dùng chung

Mọi module phải khóa theo cùng thứ tự để tránh deadlock:

```text
Event -> Orders theo id tăng dần -> Ticket Types theo id tăng dần -> Ticket
```

- Checkout: khóa Event và Ticket Types, kiểm tra tồn kho rồi tăng `reserved_quantity` trong một transaction.
- Hết hạn Order: khóa Event và Order, giảm reservation rồi chuyển Order sang `expired`.
- Thanh toán: khóa Event và Order, chuyển reserved sang sold, xác nhận Order, ghi Payment và phát hành Ticket trong một transaction.
- Check-in: khóa Event và kiểm tra assignment, sau đó khóa Order/Ticket, đổi Ticket sang `checked_in` và ghi log trong một transaction.
- Cancel Event: khóa Event cùng toàn bộ Order, đóng bán, nhả giữ chỗ, hủy pending Order/Payment, vô hiệu QR, tạo Refund và queue Email Log trong một transaction. Gửi email/hoàn tiền qua provider được xử lý ngoài transaction.
- Lifecycle theo thời gian: server đồng bộ `published -> ongoing` khi đến `start_time` và `ongoing -> completed` khi qua `end_time` lúc khởi động, mỗi 10 giây và ngay sau seed demo/workflow. Admin/Public làm mới nền mỗi 10 giây; API vẫn suy ra trạng thái hiệu lực theo thời gian tại lúc trả dữ liệu để hai giao diện không lệch nhau.

### Quy tắc dữ liệu không được phá vỡ

- Category có Event không được xóa; hãy inactive Category.
- Event public phải có ít nhất một active Ticket Type hợp lệ.
- Thời gian bắt đầu check-in phải cùng ngày bắt đầu Event theo giờ Việt Nam và sớm ít nhất 30 phút; thời gian kết thúc check-in phải sau thời gian bắt đầu check-in và không vượt quá lúc Event kết thúc.
- Tổng capacity các tier không vượt venue capacity.
- Giá vé không đổi sau khi đã reserved/sold; mở tier mới nếu cần giá mới.
- Order Item là snapshot tên tier, đơn giá và số lượng tại lúc mua, không phải dữ liệu dư thừa.
- Order/Payment/Ticket/Refund/Email/Check-in là lịch sử kiểm toán, không hard-delete sau giao dịch.
- Public API là nguồn quyết định trạng thái `coming-soon`, `on-sale`, `sold-out`, `closed`; UI không tự suy đoán.
- Event completed có thể còn hiển thị ở Public như lịch sử nhưng luôn `closed`; Event cancelled vẫn bị ẩn và không tự chuyển sang completed.

## Admin Categories API

Admin Categories là nhiệm vụ của Bửu và là nguồn dữ liệu động cho form Events:

| Method | Endpoint | Ý nghĩa |
|---|---|---|
| `GET` | `/api/admin/categories?includeInactive=true` | Danh sách kèm số Event đang tham chiếu |
| `POST` | `/api/admin/categories` | Tạo danh mục |
| `PATCH` | `/api/admin/categories/:id` | Sửa nội dung, thứ tự hoặc active/inactive |
| `DELETE` | `/api/admin/categories/:id` | Chỉ xóa khi chưa có Event tham chiếu |

Slug danh mục đã được Event sử dụng không được đổi. Danh mục inactive không xuất hiện trong form tạo Event mới nhưng Event cũ vẫn giữ quan hệ và lịch sử.

Lưu ý: một số lệnh test chỉ hoạt động sau khi nhóm bổ sung file kiểm thử.

## 13. Kế hoạch triển khai 8 tuần và checklist theo thành viên

Kế hoạch này là nguồn đối chiếu với Trello. Mỗi tuần có đúng ba nhóm việc của Bửu, Tài và Khôi. Không chuyển việc giữa thành viên nếu chưa cập nhật đồng thời README, Trello và người review Pull Request.

### Tuần 1 — Phân tích yêu cầu, kiến trúc và khởi tạo dự án

**Mục tiêu nhóm:** Chốt phạm vi TicketBoxQR, ba luồng Admin/Public/Staff, kiến trúc, CSDL và quy trình cộng tác.

**Bửu — Leader, Platform và CSDL**

- [x] Khởi tạo repo, cấu trúc `client/server/database` và các package nền.
- [x] Phân tích nghiệp vụ tổng thể và vẽ ERD cho schema 13 bảng.
- [x] Tạo consolidated schema, MySQL pool, seed và `/api/health`.
- [x] Viết `AGENTS.md`, README, quy ước branch/PR và hướng dẫn nhóm chạy dự án.
- Bàn giao: repo chạy được, ERD/schema và tài liệu nền có minh chứng.

**Tài — Phân tích Public Purchase Flow**

- [x] Khởi tạo React/Vite/TypeScript/Tailwind và cấu trúc UI Public.
- [x] Phân tích hành trình Event List → Detail → Checkout → Payment → Ticket/QR → Email.
- [x] Liệt kê màn hình, dữ liệu API và trạng thái loading/empty/error cần có.
- [x] Chốt nguyên tắc khách mua vé không cần tài khoản nhưng phải xác minh email.
- Bàn giao: Public UI nền và tài liệu luồng mua vé.

**Khôi — Phân tích Scanner và Check-in**

- [x] Phân tích Staff chỉ vận hành Event được phân công.
- [x] Thiết kế luồng camera QR và nhập mã thủ công.
- [x] Liệt kê Assigned Events, Scanner, Result và Recent Logs.
- [x] Chốt các kết quả `SUCCESS`, `INVALID`, `ALREADY_CHECKED_IN`, `WRONG_EVENT`, `CANCELLED`, `UNPAID`, `EVENT_NOT_AVAILABLE`, `STAFF_NOT_ASSIGNED`.
- Bàn giao: luồng vận hành cổng, giao diện mẫu và ma trận trường hợp check-in.

### Tuần 2 — Authentication, RBAC và khung giao diện

**Mục tiêu nhóm:** Người dùng đi vào đúng khu vực theo vai trò; ba giao diện Admin/Public/Staff có nền tảng dùng chung.

**Bửu — Auth và Admin foundation**

- [x] Hoàn thiện login, refresh, logout và `/me`.
- [x] Hash mật khẩu; hash/rotate/revoke refresh session trong `auth_sessions`.
- [x] Xây middleware authenticate/authorize và ProtectedRoute cho Admin/Staff.
- [x] Hoàn thiện Login, AdminLayout, khung Admin Dashboard và seed tài khoản; số liệu thật của Dashboard còn thiếu.
- Bàn giao: xác thực và RBAC hoạt động từ frontend đến backend.

**Tài — Public UI foundation**

- [x] Hoàn thiện PublicLayout, routing, API service và type dùng chung.
- [x] Xây Home, Event cards, Event List và Event Detail.
- [x] Bổ sung search, filter Category và lựa chọn Ticket Type.
- [x] Hoàn thiện loading, empty, error và responsive cơ bản.
- Bàn giao: khách duyệt được giao diện Public và xem dữ liệu Event.

**Khôi — Staff UI foundation**

- [x] Hoàn thiện StaffLayout, StaffHome và route chỉ dành cho role Staff.
- [x] Scanner UI, quyền camera, trạng thái xử lý và Check-in Result đã tích hợp vào `main`.
- [x] Dùng Auth contract và payload QR hiện hành.
- Bàn giao: Staff shell và Scanner nền trên `main`; UAT thiết bị thật ở tuần 7.

### Tuần 3 — Admin Event catalogue và Public Event integration

**Mục tiêu nhóm:** Admin tạo được Category → Event → Ticket Type → Publish; khách chỉ thấy Event đủ điều kiện bán; contract QR/Check-in được khóa ổn định.

**Bửu — Categories, Events và Ticket Types**

- [x] CRUD Category và quy tắc active/inactive, slug, không xóa Category đang được dùng.
- [x] CRUD Event, upload ảnh, lịch bán/check-in, visibility và publish readiness.
- [x] CRUD Ticket Type, capacity, giá, sales window và pause sales.
- [x] Áp dụng lifecycle Event và bảo vệ last-active-tier.
- [x] Hoàn thiện cancellation transaction, refund/email-log queue và workflow verification.
- [ ] Scheduled publish: UI hiện hứa tự động nhưng server chưa có job; trước nghiệm thu phải triển khai job có test hoặc bỏ lựa chọn/mô tả tự động.
- Bàn giao: Admin quản lý đầy đủ chuỗi Category → Event → Ticket Type → Publish.

**Tài — Public Event với API thật**

- [x] Tích hợp Event List/Detail và Category API.
- [x] Search/filter và hiển thị sale state do backend trả về.
- [x] Hiển thị giá, lịch bán, tồn kho và Ticket Type hợp lệ.
- [ ] Nghiệm thu pagination/sort, responsive, accessibility và các lỗi API.
- Bàn giao: khách xem và chọn đúng Event/Ticket Type đủ điều kiện.

**Khôi — Contract QR/Check-in và prototype Scanner**

- [x] Chốt payload `ticketbox:<raw-token>` và tra cứu bằng SHA-256 hash.
- [x] Chốt result code, dữ liệu log và nguyên tắc không lộ raw QR token.
- [x] Prototype camera/manual Scanner đã có trên `main`.
- [x] Test matrix service/route hiện có cho assignment, Event window, Ticket và duplicate scan; UAT thiết bị thật ở tuần 7.
- Bàn giao: contract ổn định để tuần 4–6 triển khai; không nhận CRUD Admin Staff.

### Tuần 4 — Staff Assignment và Checkout/Order

**Mục tiêu nhóm:** Admin phân công được Staff; khách tạo Order và giữ vé an toàn; Staff nhìn thấy Event được giao.

**Bửu — Admin Staff và Event Assignment**

- [ ] Nghiệm thu Google sign-in → pending → Admin duyệt/từ chối → gán Event theo mục 9 trên database thử nghiệm và Google thật.
- [ ] Nghiệm thu Admin Staff list/update/activate/deactivate; không hard-delete tài khoản có lịch sử.
- [ ] Assign/revoke và lịch sử `event_staff` đã có code trong working tree; cần review/merge và UAT.
- [ ] Chặn Staff inactive, Event terminal và lịch chồng lấn đã có code/trigger; cần clean-install và UAT.
- [x] Review transaction/row lock, inventory và Order expiry của luồng Checkout.
- [ ] Admin Staff UI/API/validation/authorization/test đã có trong working tree; chưa được nghiệm thu trên `main`.
- Bàn giao: Admin quản lý Staff và phân công Event; Khôi dùng API Assigned Events ổn định.

**Tài — Checkout, Order và Payment nền**

- [x] Hoàn thiện form người mua, xác minh email và chọn số lượng vé.
- [x] Tạo Order/Order Items, backend tự tính tiền và sinh lookup token.
- [x] Giữ vé bằng transaction, row lock và `expires_at`; job hết hạn nhả tồn kho.
- [x] Xử lý free/simulated payment và chuyển reservation sang sold.
- [ ] Admin Orders list/filter/detail/pagination đã có trên `develop`; cần đồng bộ giao diện Admin và nghiệm thu lifecycle Order.
- [ ] reCAPTCHA v3, rate limit IP/email/action, HTTP 429 và countdown đã có trên `develop`; cần tích hợp và chạy test chung.
- Bàn giao: luồng Checkout → pending Order → Payment hoạt động và không oversell.

**Khôi — Assigned Events và Scanner foundation**

- [x] API Assigned Events, UI chọn Event và check-in window đã có trên `main`.
- [x] Camera QR/nhập mã thủ công theo Event context đã có trên `main`.
- [x] Camera cleanup và lỗi quyền truy cập có code; UAT thiết bị thật ở tuần 7.
- Bàn giao: Staff chọn được Event hợp lệ và Scanner sẵn sàng gọi Check-in API.

### Tuần 5 — Phát hành vé, QR, Email và Scanner integration

**Mục tiêu nhóm:** Sau thanh toán khách nhận được QR; Scanner gửi đúng một yêu cầu cho mỗi mã và trả kết quả rõ ràng.

**Bửu — Tích hợp lifecycle và review bảo mật**

- [x] Hoàn thiện Event cancellation: đóng bán, nhả hold, hủy pending và vô hiệu QR.
- [x] Tạo Refund/Email Log có audit cho confirmed Order khi Event bị hủy.
- [ ] Review Admin Staff/Assignment và hợp đồng Assigned Events trước khi merge.
- [ ] Review idempotency, QR/lookup hash, masking và quyền truy cập liên module.
- [ ] Review/merge PR của Tài và Khôi vào `develop` sau khi kiểm tra.
- Bàn giao: các luồng Event–Order–Ticket–Assignment không phá invariant CSDL.

**Tài — Ticket, QR, Email và Admin Orders**

- [x] Xác nhận Payment và phát hành đúng số Ticket theo quantity.
- [x] Sinh `ticket_code`, QR payload `ticketbox:<raw-token>` và lưu hash làm khóa tra cứu Check-in.
- [x] Tạo QR, gửi email vé và ghi `email_logs`.
- [x] Hiển thị Order Result và tra cứu đơn bằng lookup token.
- [ ] Ticket Retrieval, ciphertext QR phục vụ gửi lại và email retry job đã có trên `develop`; cần review secrets, phản hồi trung tính, rate limit và tương thích QR Check-in.
- [ ] Hoàn thiện Admin Orders: tích hợp list/filter/detail Payment, Ticket và trạng thái email với UI Admin mới.
- Bàn giao: khách nhận QR lúc phát hành, có thể yêu cầu gửi lại đúng QR gốc và xem trạng thái Order bằng lookup token; cần nghiệm thu end-to-end sau khi đồng bộ nhánh.

**Khôi — Scanner kết nối Check-in API**

- [x] Camera/manual gửi đúng Event context với Staff lấy từ access token.
- [x] Scanner khóa lúc xử lý, hiển thị result code và nút “vé tiếp theo”.
- [x] Recent Logs và trạng thái mất mạng không tự retry đã có trên `main`.
- [x] Code đã tích hợp vào `develop`/`main`; UAT thiết bị thật ở tuần 7.
- Bàn giao: Scanner dùng QR thật, không gửi request lặp và không lộ token.

### Tuần 6 — Atomic Check-in, Admin Orders và Reports

**Mục tiêu nhóm:** Hoàn chỉnh vận hành sau bán vé: Staff check-in an toàn, Admin theo dõi đơn và xem báo cáo chính xác.

**Bửu — Admin integration và security review**

- [ ] Hoàn tất/ổn định Admin Staff và Event Assignment trên `develop`.
- [ ] Review authorization, lock order, rate limit, masked log và audit history của Check-in.
- [ ] Review Event cancellation, refund/email jobs và xử lý partial failure.
- [ ] Tích hợp menu Admin Staff, Orders, Check-in Logs và Reports không còn placeholder.
- [ ] Nối số liệu thật và quick actions của Admin Dashboard; hiện đang là `00`/nút chưa nối chức năng.
- [ ] Chạy schema/seed/workflow verification sau khi tích hợp.
- Bàn giao: các module Admin và shared database chạy thống nhất.

**Tài — Admin Orders và hậu mãi**

- [ ] Hoàn thiện và Việt hóa Admin Orders list/search/filter/detail/phân trang từ `develop`.
- [ ] Hiển thị Payment, Ticket, email delivery và lookup token an toàn; cho phép controlled ticket redelivery nhưng không trả raw QR/ciphertext qua API.
- [ ] Hiển thị trạng thái Event cancellation và Refund; không tự xác nhận hoàn tiền thật.
- [ ] Nghiệm thu Ticket Retrieval, lỗi gửi email lần đầu, retry/redelivery và đối chiếu dữ liệu doanh thu cho Reports.
- [ ] Bổ sung test và bằng chứng đối chiếu Order–Payment–Ticket–Refund.
- Bàn giao: Admin quản trị được toàn bộ vòng đời đơn hàng sau mua.

**Khôi — Atomic Check-in, Logs và Attendance Reporting**

- [x] Kiểm tra Staff active/assigned, Event status/window, Ticket và confirmed Order.
- [x] Atomic update `issued → checked_in`, bảo đảm tối đa một `SUCCESS`.
- [x] Ghi `checkin_logs` cho SUCCESS và mọi kết quả từ chối nghiệp vụ.
- [x] Hoàn thiện Admin Check-in Logs, Attendance/Revenue Reports và bộ lọc.
- [x] Xuất Excel an toàn và test concurrency/report aggregation.
- Bàn giao: phần core Check-in/Reports đã có trên `main` và test; UAT camera, staging và đối chiếu trên thiết bị thật vẫn ở tuần 7.

### Tuần 7 — QA/UAT và deploy staging

**Mục tiêu nhóm:** Nghiệm thu ba luồng end-to-end trên staging, sửa toàn bộ blocker trước release.

**Bửu — Platform QA và staging**

- [ ] QA Auth/RBAC, Categories, Events, Ticket Types, Staff và Assignment.
- [ ] Kiểm tra Google Staff thật: pending không có session, Admin duyệt/gán Event, vô hiệu hóa/thu hồi phiên, tài khoản email trùng; lưu bằng chứng.
- [ ] Thiết kế rồi bổ sung notification center realtime cho Admin (nguồn sự kiện, người nhận, quyền xem và cách nhận). WebSocket trạng thái Event đã có nhưng chỉ là tín hiệu refetch dữ liệu công khai, không thay thế notification center.
- [ ] Clean-install schema, seed, `db:verify`, server typecheck/build/test.
- [ ] Audit env/secrets, jobs, rate limit, logging và backup/restore.
- [ ] UAT scheduled publish/WebSocket Event trên môi trường thật và nối số liệu thật Admin Dashboard.
- [ ] Deploy staging; lập danh sách lỗi có owner, mức độ và deadline.
- Bàn giao: staging hoạt động và không còn blocker Platform/Admin.

**Tài — Commerce QA**

- [ ] Test Event → Checkout → Payment → Ticket/QR → Email → Order lookup.
- [ ] Test sold out, expiry, idempotency, concurrency và không oversell.
- [ ] Hoàn thiện OTP reCAPTCHA/429/countdown và tránh đưa Order lookup token vào URL/access log trước staging.
- [ ] QA Admin Orders, email phát vé lần đầu, cancellation/refund display và số liệu doanh thu.
- [ ] Hoàn thiện responsive/accessibility và bằng chứng desktop/mobile.
- Bàn giao: luồng khách và Admin Orders ổn định trên staging.

**Khôi — Operations QA**

- [ ] Test camera/manual code trên máy tính và thiết bị thật.
- [ ] Test đủ INVALID, DUPLICATE, WRONG_EVENT, CANCELLED, UNPAID, ngoài window và chưa assigned.
- [ ] Đối chiếu Logs/Reports/Excel với dữ liệu Order, Ticket và Check-in.
- [ ] QA bàn phím, camera cleanup, mất mạng và tốc độ quét liên tục.
- [ ] Lọc Event completed/cancelled khỏi danh sách Staff hoặc hiển thị rõ là đã đóng; kiểm tra không thể check-in Event terminal.
- [ ] Nếu báo cáo cần phân biệt QR/manual, thống nhất với Bửu trước khi thêm `checkin_method` vào schema/log; đây là cải thiện, không phải tiêu chí thành công hiện tại.
- Bàn giao: Scanner và Reports được UAT, có ảnh/video/test evidence.

### Tuần 8 — Release, deploy production và demo

**Mục tiêu nhóm:** Hoàn tất project, triển khai bản cuối và trình diễn ba luồng liền mạch.

**Bửu — Release và điều phối**

- [ ] Chốt UAT, review PR và merge `develop → main`.
- [ ] Deploy frontend, backend và MySQL production theo cấu hình an toàn.
- [ ] Kiểm tra health check, smoke test, backup/restore và rollback plan.
- [ ] Gắn version release; cập nhật README, API, ERD, hướng dẫn cài đặt và dữ liệu demo.
- [ ] Tổng hợp báo cáo, slide, đóng góp thành viên và kịch bản dự phòng.
- Bàn giao: URL production hoạt động, release có thể cài lại và demo được.

**Tài — Demo Public Purchase và Admin Orders**

- [ ] Chuẩn bị Event/Ticket Type và dữ liệu mua vé demo.
- [ ] Demo search/filter → Detail → Checkout → Payment → QR/Email.
- [ ] Demo Order lookup, Ticket Retrieval gửi lại đúng QR gốc và Admin Orders mà không làm lộ email có tồn tại.
- [ ] Chuẩn bị trường hợp free/paid, sold out, expired và lỗi thanh toán.
- Bàn giao: luồng Commerce end-to-end chạy trên production.

**Khôi — Demo Scanner, Check-in và Reports**

- [ ] Chuẩn bị QR hợp lệ/lỗi và nhập mã thủ công dự phòng.
- [ ] Demo Staff login → Assigned Events → Scanner → Result → Recent Logs.
- [ ] Demo chống quét trùng, sai Event, chưa assigned và ngoài window.
- [ ] Demo Attendance Report, bộ lọc và export Excel.
- Bàn giao: luồng vận hành cổng và báo cáo chạy trên production.

## 14. Git workflow đa nền tảng

Branch tích hợp là `develop`; `main` dành cho bản đã review. Mỗi thành viên kiểm tra tên branch thật trước khi switch. Branch hiện dùng: `buu-events`, `tai`, `khoi-checkin-reports`. Trước khi kéo/merge, chạy `git status` và xử lý thay đổi chưa commit của mình; không dùng `git add .` trên working tree lẫn nhiều task.

```text
owner branch → review/PR → develop → review/release → main
```

Các lệnh Git/NPM sau chạy được trong PowerShell (Windows) hoặc Terminal (macOS) từ root repository:

```sh
git status
git fetch origin
git switch <ten-nhanh-cua-ban>
git merge origin/develop
git diff --check
```

Chỉ stage đúng file thuộc task, xem `git diff --cached` rồi tự commit/push theo phân công nhóm. Khi gặp conflict liên module, trao đổi owner và kiểm tra lại test trước khi merge. Code chỉ ở local hoặc nhánh cá nhân chưa được ghi là hoàn thành trên `main`.

Trên Windows dùng PowerShell `Copy-Item` và `./scripts/verify.ps1`; trên macOS/Linux dùng `cp` và trực tiếp `npm run lint`, `npm run build`, `npm run typecheck`, `npm test` trong thư mục tương ứng. MySQL có thể chạy bằng MySQL Workbench, Homebrew hoặc service cài trên Windows; mỗi người đặt `DB_HOST`, `DB_PORT` và credential theo máy mình.
## 15. Quy tắc chung

- Không commit `.env`, mật khẩu hoặc token.
- Không commit `node_modules`, `dist` hoặc file log.
- Không dùng tài khoản MySQL `root` khi triển khai.
- Không tự ý sửa migration cũ đã chia sẻ cho nhóm.
- Trong giai đoạn hiện tại, mọi thay đổi database được tích hợp vào duy nhất `database/migrations/001_initial_schema.sql`; không tạo SQL thứ hai. Trước production phải chuyển sang migration tăng dần thực sự.
- Backend phải tự tính giá và tổng tiền.
- Không sử dụng ID tăng dần làm nội dung QR.
- Giữ vé, thanh toán và check-in phải dùng transaction.
- Staff chỉ được check-in Event đã được phân công.
- Mọi Pull Request phải được ít nhất một thành viên khác kiểm tra.

## 16. Definition of Done

Một task chỉ được xem là hoàn thành khi:

- Đúng yêu cầu nghiệp vụ.
- Frontend có loading, empty và error state.
- Backend có validation, authentication và authorization phù hợp.
- Không làm lộ dữ liệu bí mật.
- Build và typecheck thành công.
- Nghiệp vụ quan trọng có test.
- Có hướng dẫn kiểm thử trong Pull Request.
- Chạy được sau khi merge vào `develop`.

## License

Dự án được thực hiện phục vụ mục đích học tập.

## Staff Scanner / Check-in (Khôi)

Trang `/staff` hiển thị Event đang được phân công cho Staff đã đăng nhập,
cho phép nhập mã `TKT-…`, dán nội dung QR `ticketbox:<token>` hoặc mở camera.
Bộ đọc [jsQR](https://github.com/cozmo/jsQR) được tải khi bật camera; không phụ
thuộc BarcodeDetector của trình duyệt. Camera cần HTTPS hoặc localhost và
quyền truy cập camera. Máy quét ngoài có thể nhập mã vào ô mã vé rồi gửi Enter.
Sau mỗi yêu cầu, chọn **Vé tiếp theo** để mở lại scanner; mất mạng không tự gửi lại.
Camera dừng khi đóng, đổi Event hoặc rời trang, và có thể đóng bằng Escape.

### API và quyền truy cập

| Method | Endpoint | Kết quả |
|---|---|---|
| GET | `/api/staff/events` | Event có assignment active của Staff hiện tại |
| POST | `/api/staff/events/:eventId/checkins` | Kiểm tra và check-in với body `{ "code": "TKT-…" }` |
| GET | `/api/staff/events/:eventId/checkins` | 20 lần quét mới nhất của chính Staff tại Event được phân công |

Tất cả endpoint yêu cầu Bearer token và role `staff`; Admin không được dùng API
này để bỏ qua quy trình cổng. ID Staff lấy từ phiên đăng nhập, không nhận từ body.
POST giới hạn 180 yêu cầu/phút/Staff trên mỗi tiến trình server.

HTTP 200 có envelope `{ success: true, data }` nghĩa là yêu cầu đã được xử lý.
**Chỉ `data.code === "SUCCESS"` nghĩa là vé được vào cổng.** Các kết quả còn lại:
`ALREADY_CHECKED_IN`, `WRONG_EVENT`, `CANCELLED`, `UNPAID`, `INVALID`,
`EVENT_NOT_AVAILABLE`, `STAFF_NOT_ASSIGNED`. Kết quả sai Event/không được phân
công không trả thông tin người giữ vé. Lỗi xác thực, validation, Event không tồn
tại hoặc sự cố lưu trữ dùng HTTP lỗi; không được diễn giải là check-in thành công.

### Hợp đồng với Bửu và Tài

- Không thay đổi schema. Sử dụng assignment của Bửu và QR `ticketbox:` cộng token
  hex 64 ký tự đang được Tài phát hành; tra cứu bằng SHA-256 của token.
- Check-in khóa Event, kiểm tra/khóa assignment, rồi khóa Order và Ticket.
  Chỉ Order `confirmed`, Ticket `issued`, Event `published/ongoing` và thời điểm
  nằm trong cửa sổ check-in mới được vào. Event hidden vẫn có thể phục vụ khách
  đã mua vé: visibility chỉ điều khiển trang công khai.
- Đổi trạng thái Ticket và thêm log nằm trong cùng transaction. Nếu lưu log lỗi,
  thay đổi Ticket rollback. Các kết quả từ chối bình thường được commit cùng log.
- Log chỉ lưu hash và ký hiệu che mã, không lưu token QR thô. Mã không hợp lệ cũng
  có log khi request hợp lệ, Event tồn tại và Staff đã xác thực. Yêu cầu không qua
  xác thực/validation/rate limit không phải lần quét nghiệp vụ và không tạo log.
- Admin Check-in Logs, Reports và xuất Excel đã được triển khai ở mục bên dưới;
  Staff vẫn chỉ được xem recent logs của chính mình trong Event được phân công.

### Kiểm thử bàn giao

Tự động: `cd server` rồi `npm test` chạy các test service/repository với mock và
HTTP route test (auth được mô phỏng, authorization/validation thật). Chạy thêm
client lint/build và server typecheck/build như mục 12. Trên macOS/Linux,
chạy trực tiếp các lệnh `npm run` tương ứng trong `client` và `server`.

Kiểm thử tích hợp cần MySQL local đã chuẩn bị theo mục 11, backend chạy và dữ liệu
Event đang mở check-in, Staff được phân công, Order confirmed, Ticket issued:

1. Đăng nhập Staff, chọn Event, nhập mã vé hợp lệ: SUCCESS, Ticket checked_in và một log SUCCESS.
2. Quét lại cùng vé: ALREADY_CHECKED_IN, thêm log từ chối, thời điểm check-in cũ giữ nguyên.
3. Hai Staff được phân công cùng gửi một vé đồng thời: đúng một SUCCESS, lần còn lại ALREADY_CHECKED_IN.
4. Kiểm tra mã giả, vé sai Event, vé hủy, đơn chưa confirmed, ngoài giờ và thu hồi assignment.
5. Kiểm tra audit log cho từng kết quả; mã QR thô không xuất hiện trong log/API lịch sử.
6. Quét trong lúc hủy Event: không có vé hợp lệ sau khi giao dịch hủy hoàn tất.
7. Thử từ chối camera, tắt camera, đổi Event, rời trang, mất mạng và quét lại sau khi xem lịch sử.
8. Kiểm tra camera trên thiết bị thật, màn hình hẹp và thao tác bàn phím.

Các test mock không thay thế kiểm tra khóa/trigger/concurrency trên MySQL thật
hoặc thử camera thiết bị thật. Chỉ đánh dấu UAT hoàn thành sau các bước trên.

Lịch sử kiểm tra ngày 15/09/2026 có thử giải mã QR bằng jsQR và UAT MySQL cho
Check-in/Reports. Lần kiểm tra working tree mới nhất ghi ở cuối README; camera
trên thiết bị thật vẫn cần nghiệm thu.


## Admin Check-in Logs và Reports (Khôi)

- `/admin/checkins`: chọn Event, lọc ngày, Staff ID, kết quả; phân trang 20 dòng;
  giữ cả mã sai không có Ticket. Xuất toàn bộ dữ liệu khớp bộ lọc (tối đa 10.000 dòng),
  không chỉ trang đang xem. Nếu vượt giới hạn, API yêu cầu thu hẹp bộ lọc.
- `/admin/reports`: chọn Event, khoảng ngày, xem số đơn xác nhận, vé bán/phát hành,
  vé đã vào, tổng lần quét/từ chối, tiền thu/hoàn/thu ròng. Không có dữ liệu trong kỳ
  thì trả số 0; Event không tồn tại trả 404.
- `GET /api/admin/reports/events?q=...`: tìm tối đa 100 Event theo tên.
- `GET /api/admin/reports?eventId=...&from=YYYY-MM-DD&to=YYYY-MM-DD`: số liệu Event.
- `GET /api/admin/checkins?eventId=...&from=...&to=...&staffId=...&result=...&page=1&limit=20`: lịch sử.
- Thêm `/export` vào hai endpoint reports/checkins để tải `.xlsx`; chỉ bỏ các tham
  số phân trang khi muốn xuất toàn bộ. Cả hai endpoint đều áp dụng cùng bộ lọc.

Tất cả API trên yêu cầu Admin, `Cache-Control: no-store`. Xuất giới hạn 5 file/phút/
Admin/tiến trình. Excel có sheet bộ lọc, thời gian xuất và sheet dữ liệu; cột tiền
là số, chuỗi bắt đầu `=` vẫn là văn bản, không tạo công thức từ dữ liệu người dùng.
Không xuất QR token hoặc hash bí mật.

### Định nghĩa số liệu

Ngày lọc là ngày Việt Nam (UTC+07), gồm toàn bộ ngày kết thúc. Không truyền ngày
nghĩa là không giới hạn khoảng thời gian. Mỗi chỉ số dùng thời điểm nghiệp vụ riêng:

| Chỉ số | Nguồn và thời điểm |
|---|---|
| Đơn xác nhận / vé bán | Order confirmed, `confirmed_at`, số lượng `total_quantity` |
| Vé phát hành | Ticket, `issued_at`, gồm vé sau đó đã hủy để giữ lịch sử |
| Vé đã vào | Số Ticket phân biệt trong log SUCCESS, `checked_at` |
| Tổng lần quét / từ chối | Check-in Logs, `checked_at`; từ chối là kết quả khác SUCCESS |
| Đã thu | Payment success, `paid_at` |
| Đã hoàn | Refund completed, `completed_at`; pending/failed không trừ tiền |
| Thu ròng | Đã thu trừ đã hoàn trong kỳ; có thể âm |

Tổng hợp Payments, Refunds, Orders và Check-in Logs độc lập để không nhân số tiền
khi một đơn có nhiều vé/lần quét. Mỗi lần đọc báo cáo hoặc count+danh sách log dùng
một transaction read-only với snapshot nhất quán. Báo cáo không sửa lịch sử giao dịch.
Xuất Excel là một snapshot mới tại lúc bấm tải, có thể khác trang vừa xem nếu đang
có giao dịch mới. Thay đổi bộ lọc trên form chưa ảnh hưởng dữ liệu/export cho đến
khi bấm **Áp dụng bộ lọc**.

### Môi trường Windows và macOS

- Khởi động MySQL theo cách đã cài trên từng máy; cấu hình `DB_HOST`/`DB_PORT` trong `server/.env` cho đúng. Không dùng đường dẫn cài đặt hoặc port riêng của một thành viên làm mặc định của cả nhóm.
- Windows PowerShell: `Copy-Item server/.env.example server/.env`, `Copy-Item client/.env.example client/.env.local`; macOS/Linux Terminal: `cp server/.env.example server/.env`, `cp client/.env.example client/.env.local`. Chạy các lệnh này từ root nếu file chưa tồn tại; không ghi đè cấu hình hiện có.
- Cài dependencies bằng `npm ci` ở từng thư mục. Chạy `npm run dev` trong hai terminal riêng từ `server` và `client`. Vite mặc định `http://localhost:5173`, API `http://localhost:3000`; giữ `CLIENT_URL` và Google OAuth origin khớp URL dùng thực tế.
- Windows có thể chạy `./scripts/verify.ps1 -Scope all`. macOS/Linux chạy lệnh npm của mục 12. Chỉ chạy SQL clean-install và seed trên database thử nghiệm có thể xóa, tuyệt đối không trên dữ liệu cần giữ.

### Bằng chứng và giới hạn nghiệm thu

Lần kiểm tra working tree 24/09/2026: client lint/build, server typecheck/build và **112/112 test** pass; test Checkout dùng MySQL cho idempotency, reserve/expiry và chống oversell. Lifecycle test kiểm tra transition theo thời gian, chạy lại idempotent, rollback khi cập nhật dở dang và WebSocket thực nhận thông điệp sau commit. Trước đây Khôi đã ghi nhận UAT MySQL local cho Check-in/Reports; bằng chứng tự động không thay thế UAT camera trên thiết bị thật hoặc Google Staff login thật. Cần chạy lại clean-install schema mới trên database thử nghiệm và chụp bằng chứng trước khi nghiệm thu phần Google Staff.
- Client lint/build và Server typecheck/build pass; 58 test pass (service, routes,
  transaction, validation, XLSX đọc lại, phân quyền).
- Schema nạp vào instance MySQL mới; seed và seed:workflows thành công;
  `db:verify`: 28/28 kiểm tra pass trước khi chạy các lần quét UAT bổ sung.
- MySQL thật: hai lời gọi Check-in cùng `TKT-QA-ONGOING-PAID-2` đồng thời trả
  một SUCCESS, một ALREADY_CHECKED_IN; mỗi kết quả có audit log.
- Event QA ongoing: tiền thu 100.000 VND, 2 vé bán, 2 vé đã vào; lọc kỳ tương lai
  trả số 0. API Excel reports/checkins trả file XLSX đọc lại được bằng ExcelJS.
- Chưa thử camera trên thiết bị thật. Các fixture QA có thời gian tương đối;
  Event ongoing sẽ đóng cổng sau 3 giờ kể từ lúc seed. Khi cần thay bộ dữ liệu QA,
  chỉ chạy `seed:workflows` trên database local thử (lệnh thay toàn bộ Category QA).

Không thay đổi schema/API của Event, Order hoặc Assignment; cần Bửu review phần
mount route Admin và Tài review định nghĩa tiền thu/hoàn khi tích hợp vào develop.


## Public ticket retrieval and checkout email verification (Tài)

- Configure `RECAPTCHA_SECRET_KEY` on the server and `VITE_RECAPTCHA_SITE_KEY` in the client using a matching reCAPTCHA **v3** key pair. Register the actual frontend hostname in Google. Restart the server and rebuild/restart Vite after configuration changes. `RECAPTCHA_MIN_SCORE` defaults to `0.5`; optional `RECAPTCHA_HOSTNAME` restricts the verified hostname. Missing keys fail closed with a generic message.
- Google integration follows https://developers.google.com/recaptcha/docs/v3 and https://developers.google.com/recaptcha/docs/verify: execute at submit time, verify server-side, and check the expected action and score.
- Existing `MAIL_USER`, `MAIL_APP_PASSWORD`, and `MAIL_FROM_NAME` configure delivery. No credentials are included in client code.
- `POST /api/tickets/retrieval` accepts `{ email, recaptchaToken }`, action `ticket_retrieval`. It acknowledges every accepted request with the same neutral message. Background work selects confirmed orders only and sends each order's active tickets to its buyer email. Empty results send no mail. This endpoint never requires an OTP.
- `POST /api/orders/verify-email/request` accepts `{ email, recaptchaToken }`, action `checkout_email`. `POST /api/orders/verify-email/confirm` accepts `{ email, otp }`. Both require a random UUID `X-Checkout-Session` header generated for the current checkout. OTP expires after 5 minutes and is invalidated after 5 incorrect attempts. Confirmation returns a token valid for 15 minutes and bound to the normalized email and checkout session.
- Order creation at `/api/checkout/orders` (also `/api/orders`) sends the same `X-Checkout-Session` plus `emailVerificationToken` and the existing `Idempotency-Key`. Successful creation consumes verification; retries of the same order retain the existing idempotency behavior. `/api/checkout/email-verifications` aliases now require the same reCAPTCHA/session contract; confirm uses `otp` instead of `code`. Email verification accepts valid non-Gmail addresses too.
- Each flow limits both IP and normalized email to one accepted request per 60 seconds. HTTP 429 returns `code: RATE_LIMITED`, `retryAfterSeconds`, and `Retry-After`. Limits and verification records use `node-cache`; restart clears them. Deploy this implementation as a single server process; multiple replicas require a shared cache/sticky-session design before rollout.
- Ticket email includes event name, start/end time (Asia/Ho_Chi_Minh), venue, ticket type and the original QR, joined through order items → ticket types → events. Issuance stores an authenticated encrypted token alongside its unchanged hash. Initial delivery and resend use durable `email_logs` jobs; provider calls happen after commit. Resend never rotates the QR. Legacy tickets without recoverable payload fail with `QR_PAYLOAD_UNAVAILABLE`; their existing QR remains valid.
- `/admin/orders` uses the existing Admin layout with list filters, pagination and detail. `GET /api/admin/orders/stats` adds global pending / confirmed-today / expired counts, independent of list filters and pagination. “Today” follows the MySQL session date. All Admin Orders endpoints retain administrator authentication/authorization.
- Public navigation no longer exposes login/register. The standalone `/login` route remains the existing Admin/Staff entry point outside PublicLayout. No auth, Admin Events/Ticket Types/Staff/Categories, Check-in/Reports or schema implementation was changed.

### Verification for this change

Automated coverage lives in `server/tests/public-email-security.test.ts`, `email-verification.test.ts`, `ticket-retrieval.test.ts`, and `ticket-mail.test.ts`, alongside the existing checkout integration suite. Run `.agents/skills/ticketbox-verify/scripts/verify.ps1` and `npm test` from `server`.

Manual acceptance still requires configured Google/SMTP credentials and browser interaction:

1. Check desktop/mobile public navigation; verify Admin/Staff can still enter via `/login`.
2. Submit retrieval for a confirmed buyer, an unknown address and a pending-only buyer: same public message, mail only for confirmed active tickets, every QR accompanied by event details.
3. Repeat with the same IP/different email and same email/different IP: 429 and countdown. After 60 seconds retry. Reject wrong reCAPTCHA action/low score without disclosing the reason.
4. Request checkout OTP; verify wrong/expired codes fail, another checkout session cannot confirm or use the verification token, and verified email can create an order. Retrieval must never ask for OTP.
5. Check Admin Orders filters, pagination, details and global metrics, including paid-today date boundaries; keyboard-tab the detail dialog and close with Escape.
6. Simulate mail failure after payment: confirmed order/tickets remain committed and email log records failure. Retry later and verify the original QR still checks in successfully; checked-in/cancelled tickets must not appear as usable tickets in resend mail.

Verification evidence (2026-09-22): server typecheck/build, client lint/build, and all 75 tests across 10 test files passed; `git diff --check` passed. The first sandbox run failed at client build / Vitest worker creation with `spawn EPERM`; rerunning those commands outside the sandbox passed. Browser and live Google/SMTP acceptance steps above have not been executed. No schema reset or migration was run.

### Original-QR email queue (2026-09-22)

- Setup now requires `QR_ENCRYPTION_KEY` (canonical Base64 of a securely provisioned 32-byte key) and `QR_ENCRYPTION_KEY_ID` (1–32 letters/digits/underscore/hyphen) in the server environment. `.env.example` intentionally contains no working key. Missing/invalid configuration prevents startup; the application never generates a replacement key. Keep the same key across restarts/instances and back it up securely. No secret belongs in the client or Git.
- AES-256-GCM uses a fresh 12-byte nonce, 16-byte authentication tag and ticket code as AAD. The versioned Base64 envelope fits `tickets.qr_token_encrypted`; the original SHA-256 hash and scanner format remain unchanged. Only the approved final column and ciphertext immutability guard were added to the canonical schema. Bửu reviews this shared schema change; Check-in/Reports and other owners' modules are unchanged.
- Existing databases need the approved schema change before running this version. The canonical SQL **drops the database**: do not apply it to valuable data. This task verifies it on a disposable database only. No existing ticket payload can be recovered from a hash; there is no automatic backfill, replacement QR or token rotation.
- The current implementation supports one configured key ID. Replacing its key/ID strands old ciphertext. Keyring-based rotation and re-encryption are outside this change; retain the original key. The immutable-ciphertext trigger deliberately prevents rewriting stored envelopes.
- Payment commits the initial mail job with the ticket transaction. Public retrieval commits enqueue operations before its neutral acknowledgement; unknown emails create no jobs. A database failure returns generic `503 TICKET_RETRIEVAL_UNAVAILABLE` and logs a request ID. A public acknowledgement does not prove SMTP delivery.
- Worker: poll every 15 seconds, claim at most five jobs with `FOR UPDATE SKIP LOCKED`, increment attempts and commit before SMTP. Retry temporary failures after 1, 5, 15, 60 minutes, at most five attempts total. QR errors, invalid credentials and permanent provider errors become failed immediately. Five-minute leases recover interrupted workers; an obsolete attempt cannot overwrite a newer result. Delivery is at least once: SMTP acceptance followed by a crash before recording success can produce a duplicate email containing the **same** QR. `sent` means the provider accepted the recipient, not guaranteed inbox delivery.
- Admin `POST /api/admin/orders/:id/resend-email` now returns HTTP 202 with `orderId`, `jobId`, `queued`, `status`, `message`; the message says queued. `POST /api/admin/orders/:id/email-logs/:logId/retry` requires Admin access and a failed ticket-mail log belonging to that order, with no active job of the same type. Manual retry creates a new job with a fresh attempt budget and retains the failed log for audit. Admin detail exposes attempts, next attempt/lease, status and safe error reason, never the QR hash/ciphertext/token.
- Before each attempt, only `issued` tickets on a `confirmed` order are prepared. Any eligible legacy ticket with no payload fails the whole order's email; no partial or replacement email is sent. Tickets may still be checked in or an event cancelled after mail preparation; scanner/database state remains authoritative even for a QR already in transit.
- Run `node scripts/verify-ticket-email.mjs` from `server` for the complete schema, seeds, DB verification and test suite in a uniquely named `ticketboxqr_test_*` database. It uses an explicit test-only key, never writes `.env`, and drops only the database it created. Integration tests refuse the normal database. Ordinary `npm test` requires this disposable fixture and configured test environment. Run `.agents/skills/ticketbox-verify/scripts/verify.ps1` for server typecheck/build and client lint/build.
- Removal audit: `rotateTicketQrToken` existed only as the repository definition and service import/call; no direct client/test references existed. Git attribution: `a3ddff12`, Tai1245, 2026-09-13 23:11:28 +0700. The retrieval tests and Admin response/UI expectations now cover enqueue completion instead of QR replacement.
- Verification: 95 tests in 14 files passed, including real-MySQL QR immutability, payment encryption rollback, concurrent enqueue/claim, stale-lease recovery, SMTP failure/manual retry, original-QR check-in and event cancellation. Disposable schema seed, workflow seed and 29/29 DB checks passed. Server typecheck/build, client lint/build and `git diff --check` passed. Disposable databases were removed; the existing `ticketboxqr` database and real `.env` were not changed. Live browser/Google/SMTP inbox delivery has not been exercised for this queue change.
