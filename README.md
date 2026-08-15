# TicketBox QR

Hệ thống quản lý vé và check-in bằng QR cho sự kiện, được xây dựng bằng React, Node.js và MySQL.

## Giới thiệu

TicketBox QR quản lý toàn bộ vòng đời vé sự kiện:

- Admin tạo và công khai sự kiện.
- Admin tạo nhiều loại vé, quy định giá và số lượng.
- Khách mua nhiều vé hoặc nhiều loại vé trong cùng một đơn.
- Hệ thống giữ vé tạm thời trong lúc thanh toán.
- Mỗi vé được phát hành thành một bản ghi riêng và có QR riêng.
- Staff quét QR hoặc nhập mã vé tại cổng.
- Một vé chỉ được check-in thành công một lần.
- Admin xem thống kê vé bán, doanh thu và tỷ lệ tham dự.

## Thành viên

| Thành viên | Vai trò | Phạm vi |
|---|---|---|
| Bửu | Leader, Platform và Admin | Architecture, Database, Auth/RBAC, Event, Ticket Type, Admin UI, Integration, Deployment |
| Tài | Public Ticket Flow | Public Event, Cart, Checkout, Order, Payment, Ticket, QR, Email |
| Khôi | Operations và Reporting | Staff, Event Assignment, Scanner, Check-in, Logs, Dashboard, Export |

## Công nghệ

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- Zod
- React Hook Form

### Backend

- Node.js
- Express
- TypeScript
- MySQL2
- Zod
- JSON Web Token
- bcrypt
- Nodemailer
- QRCode
- Vitest
- Supertest

### Database

- MySQL 9.5
- InnoDB
- Foreign Key
- Unique Constraint
- Check Constraint
- Transaction
- Row Lock
- Atomic Update

## Cấu trúc repository

```text
ticketbox-QR/
├── client/                         React frontend
├── server/                         Express backend
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seeds/
├── docs/                           Project documentation
├── .gitignore
└── README.md
```

## Mô hình dữ liệu

Database gồm 10 bảng:

| Bảng | Chức năng |
|---|---|
| `users` | Tài khoản Admin và Staff |
| `events` | Thông tin sự kiện |
| `event_staff` | Phân công Staff vào Event |
| `ticket_types` | Loại vé, giá và tồn kho |
| `orders` | Đơn hàng |
| `order_items` | Từng loại vé trong đơn |
| `tickets` | Từng vé độc lập và QR |
| `payments` | Lịch sử thanh toán |
| `checkin_logs` | Lịch sử các lần quét |
| `email_logs` | Lịch sử gửi email |

Quan hệ nghiệp vụ chính:

```text
Event
  └── Ticket Type
        └── Order Item
              └── Ticket
                    └── Check-in Log

Order
  ├── Order Items
  └── Payments
```

## Yêu cầu môi trường

- Node.js 24 LTS
- npm
- MySQL Community Server 9.5
- MySQL Workbench
- Git

## Cài đặt repository

```powershell
git clone https://github.com/BrianLe1601/ticketbox-QR.git

cd ticketbox-QR
```

## Cài đặt frontend

```powershell
cd client

npm install

npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

### Biến môi trường frontend

Sao chép file mẫu:

```powershell
Copy-Item .env.example .env.local
```

Nội dung:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Không commit `.env.local`.

## Cài đặt backend

```powershell
cd server

npm install
```

Sao chép file môi trường sau khi `server/.env.example` được thêm:

```powershell
Copy-Item .env.example .env
```

Cấu hình dự kiến:

```env
NODE_ENV=development
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ticketboxqr
DB_USER=ticketbox_app
DB_PASSWORD=change_me

JWT_SECRET=change_me_to_a_long_random_value
JWT_EXPIRES_IN=1h

CLIENT_URL=http://localhost:5173
```

Không commit `server/.env`.

> Backend foundation đang được triển khai. Các lệnh `dev`, `build`, `lint`, `typecheck` và `test` sẽ được bổ sung trong task `feature/backend-foundation`.

## Khởi tạo database

Mở file sau bằng MySQL Workbench:

```text
database/migrations/001_initial_schema.sql
```

Chọn **Execute All**, sau đó kiểm tra:

```sql
USE ticketboxqr;

SHOW TABLES;
```

Database phải có 10 bảng.

## Tạo tài khoản cho backend

Đăng nhập MySQL bằng `root` và chạy:

```sql
CREATE USER IF NOT EXISTS 'ticketbox_app'@'localhost'
IDENTIFIED BY 'YOUR_BACKEND_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE, SHOW VIEW
ON ticketboxqr.*
TO 'ticketbox_app'@'localhost';

FLUSH PRIVILEGES;
```

Backend không sử dụng tài khoản `root`.

## Git workflow

Repository sử dụng mô hình:

```text
main
└── develop
    ├── feature/backend-foundation
    ├── feature/auth-rbac
    ├── feature/event-management
    ├── feature/public-checkout
    ├── feature/order-reservation
    ├── feature/ticket-issuance
    ├── feature/staff-management
    ├── feature/qr-scanner
    ├── feature/atomic-checkin
    └── feature/reporting
```

### Quy tắc nhánh

- `main`: phiên bản ổn định và dùng để release.
- `develop`: nhánh tích hợp của nhóm.
- `feature/*`: phát triển chức năng.
- `fix/*`: sửa lỗi.
- `docs/*`: cập nhật tài liệu.
- Không push trực tiếp lên `main`.
- Không phát triển chức năng trực tiếp trên `develop`.

### Bắt đầu một task

```powershell
git switch develop

git pull origin develop

git switch -c feature/ten-chuc-nang
```

### Commit code

```powershell
git status

git add .

git commit -m "feat(scope): short description"
```

### Push feature branch

```powershell
git push -u origin feature/ten-chuc-nang
```

Sau đó tạo Pull Request:

```text
feature/ten-chuc-nang → develop
```

### Sau khi Pull Request được merge

```powershell
git switch develop

git pull origin develop

git branch -d feature/ten-chuc-nang
```

## Commit convention

```text
feat(scope): add a new feature
fix(scope): fix a bug
refactor(scope): restructure code
test(scope): add or update tests
docs(scope): update documentation
chore(scope): project configuration
```

Ví dụ:

```text
feat(auth): add admin login
feat(order): support multiple ticket types
feat(checkin): prevent duplicate check-in
fix(ticket): validate available quantity
test(order): cover concurrent reservation
docs(api): document check-in response
chore(server): configure TypeScript
```

## Pull Request checklist

Trước khi tạo Pull Request:

- [ ] Code đúng acceptance criteria.
- [ ] Không commit `.env`, token hoặc mật khẩu.
- [ ] Không commit `node_modules` hoặc `dist`.
- [ ] Build thành công.
- [ ] Lint thành công.
- [ ] Test thành công.
- [ ] API có validation.
- [ ] API nội bộ có authentication và authorization.
- [ ] Migration hoặc seed được cập nhật nếu cần.
- [ ] README/API documentation được cập nhật.
- [ ] Pull Request có mô tả và hướng dẫn kiểm thử.

## Quy tắc database

- Không chỉnh trực tiếp database mà không có migration.
- Không sửa migration cũ sau khi nhóm đã cùng sử dụng.
- Migration mới phải tăng số thứ tự:

```text
001_initial_schema.sql
002_add_new_column.sql
003_add_new_index.sql
```

- Mọi thay đổi schema phải được thông báo cho cả nhóm.
- Backend phải dùng transaction cho giữ vé, thanh toán và check-in.
- Không xóa cứng Event, Ticket Type hoặc Ticket đã phát sinh giao dịch.

## Quy tắc bảo mật

- Không commit file `.env`.
- Không dùng tài khoản MySQL `root` trong backend.
- Không lưu mật khẩu dạng văn bản.
- Không đưa ticket ID tuần tự vào QR.
- Không log JWT hoặc QR token đầy đủ.
- Backend phải tự tính giá và tổng tiền.
- Staff chỉ được check-in Event đã được phân công.
- Login, lookup và check-in phải có rate limit.

## Definition of Done

Một task được xem là hoàn thành khi:

- Đạt acceptance criteria.
- Không còn lỗi blocker.
- Frontend có loading, empty và error state.
- Backend có validation và authorization.
- Migration và seed được cập nhật nếu cần.
- Có test cho nghiệp vụ rủi ro cao.
- Build, lint và test thành công.
- Pull Request được thành viên khác review.
- Tài liệu liên quan được cập nhật.
- Chạy được trên nhánh `develop`.

## Trạng thái dự án

- [x] Khởi tạo GitHub repository.
- [x] Khởi tạo React, TypeScript và Vite.
- [x] Cài đặt Tailwind CSS.
- [x] Khởi tạo Node.js backend.
- [x] Cài đặt backend dependencies.
- [x] Thiết kế và tạo MySQL database.
- [x] Commit database migration.
- [ ] Backend foundation.
- [ ] MySQL connection pool.
- [ ] Auth và RBAC.
- [ ] Event và Ticket Type.
- [ ] Order và Payment.
- [ ] Ticket và QR.
- [ ] Staff assignment.
- [ ] Atomic check-in.
- [ ] Dashboard và export.
- [ ] Deployment.

## License

Dự án được thực hiện phục vụ mục đích học tập.
