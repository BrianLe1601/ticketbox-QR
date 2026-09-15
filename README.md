# TicketBox QR

Hệ thống quản lý vé và check-in bằng mã QR cho sự kiện, được xây dựng bằng React, Node.js và MySQL.

Repository: https://github.com/BrianLe1601/ticketbox-QR

## 1. Mục tiêu dự án

TicketBox QR hỗ trợ toàn bộ quy trình quản lý vé sự kiện:

- Admin tạo và quản lý sự kiện.
- Tạo nhiều loại vé, giá bán và số lượng khác nhau.
- Khách đăng ký hoặc đặt vé trực tuyến.
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
- Axios
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

Trạng thái dưới đây được đối chiếu với code ngày 15/09/2026. Quy ước:

- `[x]`: đã có trên `main`, không chỉ tồn tại ở nhánh cá nhân.
- `[ ]`: chưa hoàn tất, chưa nghiệm thu hoặc còn chờ review/merge.
- Một chức năng chỉ được tick trên README và Trello khi đáp ứng Definition of Done ở mục 16.

Đã có trên `main`:

- [x] Repository React 19 + Vite + TypeScript và Node.js + Express + TypeScript.
- [x] Schema MySQL hợp nhất gồm 13 bảng, constraints, indexes và triggers.
- [x] Kết nối MySQL, seed tài khoản và `/api/health`.
- [x] Authentication, refresh-session rotation/revoke và RBAC Admin/Staff.
- [x] Admin CRUD Categories, Events và Ticket Types.
- [x] Event lifecycle, publish readiness, visibility và cancellation workflow.
- [x] Public Home, Event List, Event Detail, search/filter và chọn loại vé.
- [x] Luồng Checkout/Order/giữ chỗ/Payment mô phỏng/Ticket/QR/Email ở mức tích hợp cơ bản.

Đã có trên nhánh nhưng chưa được xem là nghiệm thu trên `main`:

- [ ] Nhánh `khoi-checkin-reports`: Assigned Events, camera/manual Scanner, atomic Check-in và Recent Logs.
- [ ] Nhánh `khoi-checkin-reports`: Admin Check-in Logs, Attendance/Revenue Reports, export Excel và test.
- [ ] Đồng bộ nhánh Khôi với `develop`, review contract liên module và merge bằng Pull Request.

Còn thiếu hoặc cần hoàn thiện:

- [ ] Admin Staff CRUD, activate/deactivate và Event Assignment — Bửu.
- [ ] Admin Orders: danh sách, lọc, chi tiết Order/Payment/Ticket/Refund — Tài.
- [ ] Email retry/resend, hoàn thiện hậu mãi và trạng thái refund — Tài.
- [ ] UAT camera trên thiết bị thật và tích hợp Scanner sau merge — Khôi.
- [ ] Test tích hợp end-to-end, concurrency, responsive và accessibility — cả nhóm.
- [ ] Deploy staging, sửa blocker, deploy production và chuẩn bị demo — Bửu điều phối.

## 5. Cấu trúc repository

```text
ticketbox-QR/
├── client/                         # Frontend React
├── server/                         # Backend Node.js và Express
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql # Toàn bộ database, chạy một lần khi reset
│   └── seeds/                     # Dữ liệu mẫu để phát triển và kiểm thử
├── .gitignore
└── README.md
```

## 6. Cấu trúc frontend cần hoàn thiện

```text
client/
├── public/                         # Favicon và file tĩnh công khai
├── src/
│   ├── assets/                    # Logo, hình sự kiện và hình minh họa
│   ├── components/
│   │   ├── common/                # Button, Input, Modal, Loading, Pagination
│   │   ├── events/                # EventCard, EventForm, TicketTypeForm
│   │   ├── orders/                # Cart, OrderSummary, PaymentStatus
│   │   ├── tickets/               # TicketCard, QRCodeView
│   │   ├── checkin/               # QRScanner, CheckinResult
│   │   └── dashboard/             # StatisticCard, bảng và biểu đồ
│   ├── layouts/
│   │   ├── PublicLayout.tsx       # Layout dành cho khách
│   │   ├── AdminLayout.tsx        # Layout quản trị
│   │   └── StaffLayout.tsx        # Layout nhân viên check-in
│   ├── pages/
│   │   ├── public/                # Trang sự kiện, chi tiết và checkout
│   │   ├── auth/                  # Login và đổi mật khẩu
│   │   ├── admin/                 # Event, vé, đơn hàng, nhân viên, dashboard
│   │   └── staff/                 # Danh sách sự kiện và màn hình quét QR
│   ├── routes/
│   │   ├── AppRoutes.tsx          # Khai báo toàn bộ route
│   │   └── ProtectedRoute.tsx     # Kiểm tra đăng nhập và quyền truy cập
│   ├── services/
│   │   ├── api.ts                 # Axios instance và xử lý token
│   │   ├── auth.service.ts
│   │   ├── event.service.ts
│   │   ├── order.service.ts
│   │   ├── ticket.service.ts
│   │   └── checkin.service.ts
│   ├── hooks/                     # Custom hook dùng lại
│   ├── context/                   # Trạng thái đăng nhập và giỏ vé
│   ├── schemas/                   # Zod schema cho biểu mẫu
│   ├── types/                     # Kiểu dữ liệu TypeScript
│   ├── utils/                     # Hàm định dạng ngày, tiền và lỗi
│   ├── App.tsx                    # Component gốc
│   ├── main.tsx                   # Điểm khởi động React
│   └── index.css                  # Tailwind và CSS toàn cục
├── .env.example
├── package.json
└── vite.config.ts
```

### Chức năng các nhóm thư mục frontend

| Thư mục | Chức năng |
|---|---|
| `components` | Component nhỏ có thể tái sử dụng ở nhiều trang |
| `layouts` | Khung giao diện chung cho Public, Admin và Staff |
| `pages` | Các màn hình hoàn chỉnh tương ứng với URL |
| `routes` | Điều hướng và bảo vệ trang theo vai trò |
| `services` | Gọi API backend bằng Axios |
| `hooks` | Logic React dùng lại giữa nhiều component |
| `context` | Trạng thái dùng chung như tài khoản và giỏ vé |
| `schemas` | Kiểm tra dữ liệu form bằng Zod |
| `types` | Interface và type TypeScript |
| `utils` | Các hàm hỗ trợ không phụ thuộc giao diện |

## 7. Cấu trúc backend cần hoàn thiện

```text
server/
├── src/
│   ├── config/
│   │   └── env.ts                 # Đọc và kiểm tra biến môi trường
│   ├── database/
│   │   └── pool.ts                # MySQL connection pool
│   ├── middlewares/
│   │   ├── authenticate.ts        # Xác thực JWT
│   │   ├── authorize.ts           # Kiểm tra ADMIN hoặc STAFF
│   │   ├── validate.ts            # Kiểm tra request bằng Zod
│   │   ├── error-handler.ts       # Xử lý lỗi tập trung
│   │   └── not-found.ts           # Xử lý endpoint không tồn tại
│   ├── modules/
│   │   ├── auth/                  # Đăng nhập và tài khoản
│   │   ├── events/                # Quản lý sự kiện
│   │   ├── ticket-types/          # Quản lý loại vé
│   │   ├── orders/                # Đặt vé và giữ chỗ
│   │   ├── payments/              # Lịch sử và xác nhận thanh toán
│   │   ├── tickets/               # Phát hành vé và QR
│   │   ├── staff/                 # Nhân viên và phân công
│   │   ├── checkins/              # Quét và check-in
│   │   └── reports/               # Dashboard và báo cáo
│   ├── services/
│   │   ├── mail.service.ts        # Gửi email
│   │   └── qr.service.ts          # Tạo ảnh QR
│   ├── jobs/
│   │   ├── expire-orders.job.ts   # Hủy đơn giữ chỗ quá hạn
│   │   └── retry-emails.job.ts    # Gửi lại email thất bại
│   ├── utils/
│   │   ├── app-error.ts           # Lớp lỗi dùng chung
│   │   ├── response.ts            # Chuẩn hóa API response
│   │   └── token.ts               # Hỗ trợ JWT và QR token
│   ├── app.ts                     # Cấu hình Express và mount routes
│   └── server.ts                  # Kết nối DB và khởi động server
├── tests/                          # Integration test và API test
├── .env.example
├── package.json
└── tsconfig.json
```

Mỗi module nghiệp vụ nên có cấu trúc:

```text
modules/events/
├── event.routes.ts                # Khai báo endpoint và middleware
├── event.controller.ts            # Nhận request và trả response
├── event.service.ts               # Xử lý nghiệp vụ
├── event.repository.ts            # Truy vấn MySQL
├── event.schema.ts                # Validation bằng Zod
└── event.types.ts                 # Kiểu TypeScript
```

### Quy tắc phân tầng backend

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
MySQL
```

- `route`: khai báo URL và middleware.
- `controller`: nhận request, gọi service và trả response.
- `service`: xử lý nghiệp vụ và transaction.
- `repository`: chỉ thực hiện truy vấn database.
- `schema`: kiểm tra dữ liệu đầu vào.
- `types`: định nghĩa kiểu dữ liệu.

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

Schema hoàn chỉnh bao gồm Users/Auth Sessions, Categories, Events, Event Staff, Ticket Types, Orders, Order Items, Tickets, Payments, Refunds, Check-in Logs, Email Logs, indexes, constraints, triggers và reporting views.

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
SEED_ADMIN_NAME=Admin
SEED_ADMIN_EMAIL=admin@ticketbox.local
SEED_STAFF_NAME=Staff
SEED_STAFF_EMAIL=staff@ticketbox.local
SEED_DEFAULT_PASSWORD=ticketbox@123
```

`DB_PASSWORD` phải trùng với mật khẩu `ticketbox_app` vừa tạo. Đặt `NODE_ENV=development` để cho phép seed.

Tạo hoặc cập nhật hai tài khoản test từ các biến `SEED_*`:

```powershell
npm run seed
```

Seed có thể chạy lại an toàn: email đã tồn tại sẽ được cập nhật tên, role, mật khẩu và kích hoạt lại. Seed bị chặn khi `NODE_ENV=production`.

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

### Database workflow và dữ liệu kiểm thử tích hợp

Sau khi chạy lại schema và `npm run seed`, tạo bộ dữ liệu QA riêng biệt:

```powershell
cd server
npm run seed:workflows
npm run db:verify
```

`seed:workflows` chỉ quản lý dữ liệu thuộc Category `qa-workflow`, không xóa Event của Admin ở Category khác. Có thể chạy lại để thay thế bộ fixture cũ. Lệnh bị chặn hoàn toàn khi `NODE_ENV=production`.

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
- Check-in: khóa Ticket, kiểm tra Event/Staff assignment/cửa sổ check-in, đổi Ticket sang `checked_in` và ghi log trong một transaction.
- Cancel Event: khóa Event cùng toàn bộ Order, đóng bán, nhả giữ chỗ, hủy pending Order/Payment, vô hiệu QR, tạo Refund và queue Email Log trong một transaction. Gửi email/hoàn tiền qua provider được xử lý ngoài transaction.

### Quy tắc dữ liệu không được phá vỡ

- Category có Event không được xóa; hãy inactive Category.
- Event public phải có ít nhất một active Ticket Type hợp lệ.
- Tổng capacity các tier không vượt venue capacity.
- Giá vé không đổi sau khi đã reserved/sold; mở tier mới nếu cần giá mới.
- Order Item là snapshot tên tier, đơn giá và số lượng tại lúc mua, không phải dữ liệu dư thừa.
- Order/Payment/Ticket/Refund/Email/Check-in là lịch sử kiểm toán, không hard-delete sau giao dịch.
- Public API là nguồn quyết định trạng thái `coming-soon`, `on-sale`, `sold-out`, `closed`; UI không tự suy đoán.

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
- [x] Hoàn thiện Login, AdminLayout, Admin Dashboard và seed tài khoản.
- Bàn giao: xác thực và RBAC hoạt động từ frontend đến backend.

**Tài — Public UI foundation**

- [x] Hoàn thiện PublicLayout, routing, API service và type dùng chung.
- [x] Xây Home, Event cards, Event List và Event Detail.
- [x] Bổ sung search, filter Category và lựa chọn Ticket Type.
- [x] Hoàn thiện loading, empty, error và responsive cơ bản.
- Bàn giao: khách duyệt được giao diện Public và xem dữ liệu Event.

**Khôi — Staff UI foundation**

- [x] Hoàn thiện StaffLayout, StaffHome và route chỉ dành cho role Staff.
- [ ] Tích hợp Scanner UI thực tế từ nhánh Khôi vào `develop`.
- [ ] Hoàn thiện quyền camera, trạng thái xử lý và Check-in Result.
- [ ] Review Auth contract với Bửu và QR payload contract với Tài.
- Bàn giao: Staff shell trên `main`; Scanner UI sẵn sàng sau PR được review.

### Tuần 3 — Admin Event catalogue và Public Event integration

**Mục tiêu nhóm:** Admin tạo được Category → Event → Ticket Type → Publish; khách chỉ thấy Event đủ điều kiện bán; contract QR/Check-in được khóa ổn định.

**Bửu — Categories, Events và Ticket Types**

- [x] CRUD Category và quy tắc active/inactive, slug, không xóa Category đang được dùng.
- [x] CRUD Event, upload ảnh, lịch bán/check-in, visibility và publish readiness.
- [x] CRUD Ticket Type, capacity, giá, sales window và pause sales.
- [x] Áp dụng lifecycle Event và bảo vệ last-active-tier.
- [x] Hoàn thiện cancellation transaction, refund/email-log queue và workflow verification.
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
- [ ] Đồng bộ prototype camera/manual Scanner với `develop` mới nhất.
- [ ] Hoàn thiện test matrix cho assignment, Event window, Ticket và duplicate scan.
- Bàn giao: contract ổn định để tuần 4–6 triển khai; không nhận CRUD Admin Staff.

### Tuần 4 — Staff Assignment và Checkout/Order

**Mục tiêu nhóm:** Admin phân công được Staff; khách tạo Order và giữ vé an toàn; Staff nhìn thấy Event được giao.

**Bửu — Admin Staff và Event Assignment**

- [ ] Xây Admin Staff list/create/update/activate/deactivate; không hard-delete tài khoản có lịch sử.
- [ ] Xây assign/revoke Staff cho Event và giữ lịch sử trong `event_staff`.
- [ ] Chặn Staff inactive, Event terminal và lịch phân công chồng lấn.
- [x] Review transaction/row lock, inventory và Order expiry của luồng Checkout.
- [ ] Hoàn thiện Admin Staff UI, API, validation, authorization và test.
- Bàn giao: Admin quản lý Staff và phân công Event; Khôi dùng API Assigned Events ổn định.

**Tài — Checkout, Order và Payment nền**

- [x] Hoàn thiện form người mua, xác minh email và chọn số lượng vé.
- [x] Tạo Order/Order Items, backend tự tính tiền và sinh lookup token.
- [x] Giữ vé bằng transaction, row lock và `expires_at`; job hết hạn nhả tồn kho.
- [x] Xử lý free/simulated payment và chuyển reservation sang sold.
- [ ] Xây Admin Orders list/filter/detail cơ bản.
- Bàn giao: luồng Checkout → pending Order → Payment hoạt động và không oversell.

**Khôi — Assigned Events và Scanner foundation**

- [ ] Tích hợp API lấy Event được phân công theo Staff đăng nhập.
- [ ] Hoàn thiện UI chọn Event và hiển thị check-in window.
- [ ] Tích hợp camera QR và ô nhập mã thủ công với Event context.
- [ ] Dừng camera khi đổi Event/rời trang; xử lý từ chối quyền camera.
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
- [x] Sinh `ticket_code`, raw QR token dùng một lần và chỉ lưu hash.
- [x] Tạo QR, gửi email vé và ghi `email_logs`.
- [x] Hiển thị Order Result và tra cứu đơn bằng lookup token.
- [ ] Hoàn thiện Admin Orders: list/filter/detail Payment, Ticket và trạng thái email.
- Bàn giao: khách nhận/tra cứu được vé; Admin theo dõi được đơn hàng.

**Khôi — Scanner kết nối Check-in API**

- [ ] Gửi camera/manual code đến đúng Event context và Staff từ access token.
- [ ] Khóa tạm Scanner khi xử lý để một mã chỉ tạo một request.
- [ ] Hiển thị đầy đủ result code/message và nút “vé tiếp theo”.
- [ ] Hoàn thiện recent logs, xử lý mất mạng và không tự retry check-in.
- [ ] Đồng bộ nhánh, chạy test và tạo PR vào `develop`.
- Bàn giao: Scanner dùng QR thật, không gửi request lặp và không lộ token.

### Tuần 6 — Atomic Check-in, Admin Orders và Reports

**Mục tiêu nhóm:** Hoàn chỉnh vận hành sau bán vé: Staff check-in an toàn, Admin theo dõi đơn và xem báo cáo chính xác.

**Bửu — Admin integration và security review**

- [ ] Hoàn tất/ổn định Admin Staff và Event Assignment trên `develop`.
- [ ] Review authorization, lock order, rate limit, masked log và audit history của Check-in.
- [ ] Review Event cancellation, refund/email jobs và xử lý partial failure.
- [ ] Tích hợp menu Admin Staff, Orders, Check-in Logs và Reports không còn placeholder.
- [ ] Chạy schema/seed/workflow verification sau khi tích hợp.
- Bàn giao: các module Admin và shared database chạy thống nhất.

**Tài — Admin Orders và hậu mãi**

- [ ] Hoàn thiện Admin Orders list/search/filter/detail và phân trang.
- [ ] Hiển thị Payment, Ticket, email delivery và lookup/resend an toàn.
- [ ] Hiển thị trạng thái Event cancellation và Refund; không tự xác nhận hoàn tiền thật.
- [ ] Hoàn thiện email retry/resend và dữ liệu doanh thu cung cấp cho Reports.
- [ ] Bổ sung test và bằng chứng đối chiếu Order–Payment–Ticket–Refund.
- Bàn giao: Admin quản trị được toàn bộ vòng đời đơn hàng sau mua.

**Khôi — Atomic Check-in, Logs và Attendance Reporting**

- [ ] Kiểm tra Staff active/assigned, Event status/window, Ticket và confirmed Order.
- [ ] Atomic update `issued → checked_in`, bảo đảm tối đa một `SUCCESS`.
- [ ] Ghi `checkin_logs` cho SUCCESS và mọi kết quả từ chối nghiệp vụ.
- [ ] Hoàn thiện Admin Check-in Logs, Attendance/Revenue Reports và bộ lọc.
- [ ] Xuất Excel an toàn và test concurrency/report aggregation.
- Bàn giao: Check-in chống trùng; logs và số lượt tham dự khớp dữ liệu nguồn.

### Tuần 7 — QA/UAT và deploy staging

**Mục tiêu nhóm:** Nghiệm thu ba luồng end-to-end trên staging, sửa toàn bộ blocker trước release.

**Bửu — Platform QA và staging**

- [ ] QA Auth/RBAC, Categories, Events, Ticket Types, Staff và Assignment.
- [ ] Clean-install schema, seed, `db:verify`, server typecheck/build/test.
- [ ] Audit env/secrets, jobs, rate limit, logging và backup/restore.
- [ ] Deploy staging; lập danh sách lỗi có owner, mức độ và deadline.
- Bàn giao: staging hoạt động và không còn blocker Platform/Admin.

**Tài — Commerce QA**

- [ ] Test Event → Checkout → Payment → Ticket/QR → Email → Order lookup.
- [ ] Test sold out, expiry, idempotency, concurrency và không oversell.
- [ ] QA Admin Orders, resend, cancellation/refund display và số liệu doanh thu.
- [ ] Hoàn thiện responsive/accessibility và bằng chứng desktop/mobile.
- Bàn giao: luồng khách và Admin Orders ổn định trên staging.

**Khôi — Operations QA**

- [ ] Test camera/manual code trên máy tính và thiết bị thật.
- [ ] Test đủ INVALID, DUPLICATE, WRONG_EVENT, CANCELLED, UNPAID, ngoài window và chưa assigned.
- [ ] Đối chiếu Logs/Reports/Excel với dữ liệu Order, Ticket và Check-in.
- [ ] QA bàn phím, camera cleanup, mất mạng và tốc độ quét liên tục.
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
- [ ] Demo Order lookup, resend và Admin Orders.
- [ ] Chuẩn bị trường hợp free/paid, sold out, expired và lỗi thanh toán.
- Bàn giao: luồng Commerce end-to-end chạy trên production.

**Khôi — Demo Scanner, Check-in và Reports**

- [ ] Chuẩn bị QR hợp lệ/lỗi và nhập mã thủ công dự phòng.
- [ ] Demo Staff login → Assigned Events → Scanner → Result → Recent Logs.
- [ ] Demo chống quét trùng, sai Event, chưa assigned và ngoài window.
- [ ] Demo Attendance Report, bộ lọc và export Excel.
- Bàn giao: luồng vận hành cổng và báo cáo chạy trên production.

## 14. Git workflow

Không làm tính năng trực tiếp trên `main`.

```text
main
└── develop
    ├── feature/auth-rbac
    ├── feature/event-management
    ├── feature/order-checkout
    ├── feature/ticket-qr
    ├── feature/staff-management
    ├── feature/qr-checkin
    └── feature/reporting
```

Bắt đầu task:

```powershell
git switch develop
git pull origin develop
git switch -c feature/ten-chuc-nang
```

Commit và push:

```powershell
git status
git add README.md client/src server/src database/migrations/001_initial_schema.sql
git diff --cached
git commit -m "feat(scope): short description"
git push -u origin feature/ten-chuc-nang
```

Chỉ đưa đúng file thuộc task vào staging; thay danh sách đường dẫn ở ví dụ trên theo thay đổi thực tế.

Sau đó tạo Pull Request:

```text
feature/ten-chuc-nang → develop
```

Quy ước commit:

```text
feat(scope): thêm chức năng
fix(scope): sửa lỗi
refactor(scope): cải tiến cấu trúc
test(scope): thêm kiểm thử
docs(scope): cập nhật tài liệu
chore(scope): cập nhật cấu hình
```

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
client lint/build và server typecheck/build như mục 12. Trên macOS không có
PowerShell, chạy trực tiếp các lệnh tương đương trong skill `ticketbox-verify`.

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

Kết quả kiểm tra bản triển khai 2026-09-15: client lint/build, server typecheck/build
và 58 test đều pass; thử tạo QR theo cấu hình phát hành hiện tại rồi giải mã bằng
jsQR cũng pass. MySQL thật đã được cài và kiểm thử như mục dưới; camera thiết bị
thật vẫn cần thử trực tiếp.


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

### Môi trường local đã chuẩn bị trên Mac này

- MySQL riêng tại `127.0.0.1:3307`, chỉ lắng nghe localhost.
- Data: `~/.local/share/ticketbox-mysql/data`; chương trình ở
  `~/.local/lib/mysql-8.0.35-macos13-x86_64` (bản tương thích macOS 13 Intel).
- Backend dùng tài khoản `ticketbox_app`; mật khẩu ngẫu nhiên và JWT secret nằm
  trong `server/.env` được Git bỏ qua. Không dùng instance này cho production.
- Khởi động MySQL sau khi tắt máy: `~/.local/bin/ticketbox-mysql-start`.
- Dừng MySQL: `~/.local/bin/ticketbox-mysql-stop`.
- Chạy `npm run dev` lần lượt trong `server` và `client`. Mở
  `http://localhost:5173/login` để khớp origin đã cấu hình.
- Tài khoản demo: `admin@ticketbox.local`, `staff@ticketbox.local`,
  `qa.staff@ticketbox.local`; mật khẩu local mẫu `ticketbox@123`.

### Bằng chứng kiểm tra 2026-09-15

- Client lint/build và Server typecheck/build pass; 58 test pass (service, routes,
  transaction, validation, XLSX đọc lại, phân quyền).
- Schema nạp vào instance MySQL mới; seed và seed:workflows thành công;
  `db:verify`: 28/28 kiểm tra pass trước khi chạy các lần quét UAT bổ sung.
- HTTP thật: login Admin/Staff, quyền truy cập, hai request quét cùng
  `TKT-QA-ONGOING-PAID-2` đồng thời: một SUCCESS, một ALREADY_CHECKED_IN.
- HTTP thật: INVALID, WRONG_EVENT, STAFF_NOT_ASSIGNED, quét lại vé; log được ghi.
- Event QA ongoing: tiền thu 100.000 VND, 2 vé bán, 2 vé đã vào; lọc kỳ tương lai
  trả số 0. API Excel reports/checkins trả file XLSX đọc lại được bằng ExcelJS.
- Chưa thử camera trên thiết bị thật. Các fixture QA có thời gian tương đối;
  Event ongoing sẽ đóng cổng sau 3 giờ kể từ lúc seed. Khi cần thay bộ dữ liệu QA,
  chỉ chạy `seed:workflows` trên database local thử (lệnh thay toàn bộ Category QA).

Không thay đổi schema/API của Event, Order hoặc Assignment; cần Bửu review phần
mount route Admin và Tài review định nghĩa tiền thu/hoàn khi tích hợp vào develop.
