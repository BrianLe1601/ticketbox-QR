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
| Bửu | Leader, nền tảng và quản trị | Auth, RBAC, Admin, Event, Ticket Type, tích hợp hệ thống |
| Tài | Quy trình đặt và phát hành vé | Public Event, Checkout, Order, Payment, Ticket, QR, Email |
| Khôi | Vận hành tại sự kiện | Staff, Assignment, Scanner, Check-in, Logs, Reporting |

Luồng bàn giao chính:

```text
Bửu tạo Event và Ticket Type
              ↓
Tài xây dựng Order, Payment, Ticket, QR và Email
              ↓
Khôi xây dựng Scanner, Check-in, Logs và Reporting
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
- [x] Thiết kế database gồm 10 bảng.
- [x] Lưu migration `001_initial_schema.sql`.
- [x] Cấu hình biến môi trường backend.
- [x] Tạo MySQL connection pool.
- [x] Kết nối backend với database `ticketboxqr`.
- [x] Tạo API kiểm tra `/api/health`.

Chưa hoàn thành:

- [ ] Chuẩn hóa cấu trúc frontend.
- [ ] Chuẩn hóa cấu trúc backend.
- [ ] Authentication và phân quyền.
- [ ] Quản lý Event và Ticket Type.
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
│   ├── migrations/                # Các lần thay đổi cấu trúc database
│   │   └── 001_initial_schema.sql
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

Database `ticketboxqr` gồm 10 bảng:

| Bảng | Chức năng |
|---|---|
| `users` | Tài khoản Admin và Staff |
| `events` | Thông tin và trạng thái sự kiện |
| `event_staff` | Phân công Staff vào Event |
| `ticket_types` | Loại vé, giá, sức chứa và thời gian bán |
| `orders` | Thông tin người mua, tổng tiền và thời hạn giữ vé |
| `order_items` | Mỗi loại vé và số lượng trong đơn |
| `tickets` | Từng vé độc lập cùng QR token |
| `payments` | Các lần thanh toán của đơn |
| `checkin_logs` | Lưu tất cả lần quét thành công hoặc thất bại |
| `email_logs` | Theo dõi trạng thái gửi email |

Quan hệ chính:

```text
Event
├── Ticket Types
├── Orders
└── Event Staff

Order
├── Order Items
│   └── Tickets
├── Payments
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
6. Khi thanh toán thành công, Order chuyển sang `PAID`.
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

Mở và chạy file sau trong MySQL Workbench:

```text
database/migrations/001_initial_schema.sql
```

Kiểm tra:

```sql
USE ticketboxqr;
SHOW TABLES;
```

### Chạy backend

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```

Điền thông tin thật trong `server/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ticketboxqr
DB_USER=ticketbox_app
DB_PASSWORD=your_password
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
- Mỗi thay đổi database phải có migration mới.
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

## License

Dự án được thực hiện phục vụ mục đích học tập.
