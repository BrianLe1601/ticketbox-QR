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
| Tài | Quy trình đặt và phát hành vé | Public Event, Order, Payment, Ticket, QR, Email |
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

Đã hoàn thành:

- [x] Khởi tạo GitHub repository.
- [x] Khởi tạo React, TypeScript và Vite.
- [x] Cài đặt Tailwind CSS và thư viện frontend.
- [x] Khởi tạo Node.js, Express và TypeScript.
- [x] Cài đặt thư viện backend.
- [x] Thiết kế database quan hệ và migration baseline.
- [x] Tổng hợp toàn bộ database vào một file schema có thể reset và khởi tạo lại.
- [x] Cấu hình biến môi trường backend.
- [x] Tạo MySQL connection pool.
- [x] Kết nối backend với database `ticketboxqr`.
- [x] Tạo API kiểm tra `/api/health`.

Chưa hoàn thành:

- [ ] Chuẩn hóa cấu trúc frontend.
- [ ] Chuẩn hóa cấu trúc backend.
- [x] Authentication, refresh session và phân quyền Admin/Staff.
- [x] Quản lý Event, Ticket Type và Category ở Admin.
- [ ] Đặt vé, giữ vé và thanh toán.
- [ ] Phát hành QR và gửi email.
- [ ] Quản lý Staff và phân công sự kiện.
- [ ] Quét QR và check-in an toàn.
- [ ] Dashboard và xuất báo cáo.
- [ ] Test và triển khai ứng dụng.

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

## 13. Git workflow

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
git add .
git commit -m "feat(scope): short description"
git push -u origin feature/ten-chuc-nang
```

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

## 14. Quy tắc chung

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

## 15. Definition of Done

Một task chỉ được xem là hoàn thành khi:

- Đúng yêu cầu nghiệp vụ.
- Frontend có loading, empty và error state.
- Backend có validation, authentication và authorization phù hợp.
- Không làm lộ dữ liệu bí mật.
- Build và typecheck thành công.
- Nghiệp vụ quan trọng có test.
- Có hướng dẫn kiểm thử trong Pull Request.
- Chạy được sau khi merge vào `develop`.

# Quy trình GitHub của nhóm

## 1. Các nhánh sử dụng

```text
main        # Bản ổn định để demo
develop     # Nơi tập hợp code của nhóm
buu         # Nhánh của Bửu
tai         # Nhánh của Tài
khoi        # Nhánh của Khôi
```

Mỗi người chỉ code và push lên nhánh của mình.

## 2. Lần đầu lấy project

```powershell
git clone https://github.com/BrianLe1601/ticketbox-QR.git
cd ticketbox-QR
git switch ten-cua-ban
```

Ví dụ:

```powershell
git switch tai
```

Nếu nhánh chưa tồn tại:

```powershell
git switch -c tai
git push -u origin tai
```

## 3. Trước khi bắt đầu code

Lấy code mới nhất từ `develop`:

```powershell
git switch develop
git pull origin develop
git switch ten-cua-ban
git merge develop
```

Ví dụ với Tài:

```powershell
git switch develop
git pull origin develop
git switch tai
git merge develop
```

## 4. Sau khi code

```powershell
git status
git add .
git commit -m "Mô tả phần đã làm"
git push
```

Ví dụ:

```powershell
git add .
git commit -m "Hoàn thành giao diện đặt vé"
git push
```

Code sẽ được push lên nhánh cá nhân, không phải `main`.

## 5. Khi hoàn thành chức năng

Trên GitHub, tạo Pull Request:

```text
buu/tai/khoi → develop
```

Leader kiểm tra và merge vào `develop`.

Khi toàn bộ project chạy ổn định, Leader tạo Pull Request:

```text
develop → main
```

## 6. Luồng cần nhớ

```text
Code trên nhánh cá nhân
        ↓
Push lên nhánh cá nhân
        ↓
Pull Request vào develop
        ↓
Leader kiểm tra và merge
        ↓
Project hoàn chỉnh mới merge vào main
```

## 7. Lưu ý

- Không code hoặc push trực tiếp lên `main`.
- Luôn pull `develop` trước khi bắt đầu.
- Không commit `.env`, `node_modules` hoặc mật khẩu.
- Trước khi merge phải chạy thử project.
- Nếu gặp conflict, báo nhóm cùng xử lý, không tự xóa code.


## License

Dự án được thực hiện phục vụ mục đích học tập.
