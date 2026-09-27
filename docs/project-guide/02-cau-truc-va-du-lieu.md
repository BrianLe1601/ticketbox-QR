# TicketBoxQR — Cấu trúc mã nguồn, dữ liệu và API

Đối chiếu working tree ngày 27/09/2026. Đọc cùng [luồng nghiệp vụ](01-nghiep-vu-va-pham-vi.md) và [công cụ/thư viện](03-cong-cu-va-thu-vien.md). Các đường dẫn tương đối dưới đây tính từ root repository.

## 1. Kiến trúc tổng thể

Project có hai ứng dụng trong cùng repository: `client` là React SPA chạy trên trình duyệt; `server` là Express API chạy trên Node.js. Backend là một ứng dụng chia module, cùng database và cùng tiến trình chạy jobs; không phải microservices.

| Thành phần | Gọi/trao đổi với | Mục đích |
|---|---|---|
| React SPA | Express qua HTTP JSON | Đọc Event, tạo Order, quản trị, check-in, báo cáo |
| Express | MySQL qua mysql2 | Lưu nghiệp vụ, khóa dòng, transaction, đọc báo cáo |
| Express | Google Identity | Xác minh Google ID token cho Staff |
| React + Express | reCAPTCHA v3 | Client lấy token; server xác minh trước yêu cầu email |
| Express | Gmail qua Nodemailer | Gửi OTP, vé điện tử và thông báo hủy |
| React | Cloudinary bằng chữ ký từ Express | Upload ảnh Event |
| Express → React | WebSocket `/ws/events` | Báo thay đổi trạng thái để client refetch REST |
| React | Camera + canvas + jsQR | Đọc nội dung QR; kết quả hợp lệ hay không do Backend quyết định |
| Express → trình duyệt | File XLSX | Xuất Logs/Reports bằng ExcelJS |

Một thao tác điển hình: `AdminEventsPage` → `admin-events.service` phía client → HTTP → `admin-events.routes` → validate/auth → controller → service Backend → repository → MySQL. Response quay về client để cập nhật giao diện. Service phía client và service phía server cùng hậu tố nhưng có vai trò khác nhau: client đóng gói HTTP; server xử lý quy tắc nghiệp vụ.

## 2. Các mục ở root

```text
ticketbox-QR/
├── client/                  Ứng dụng trình duyệt
├── server/                  API, jobs, database access và tests
├── database/
│   └── migrations/
│       └── 001_initial_schema.sql
├── scripts/
│   └── verify.ps1          Chạy chuỗi kiểm tra client/server
├── .agents/skills/         Hướng dẫn cho trợ lý làm việc trong repo
├── docs/project-guide/    Bộ tài liệu rà soát này
├── README.md              Cài đặt, nghiệp vụ, API, QA và kế hoạch cũ
├── AGENTS.md              Quy tắc kỹ thuật/phối hợp owner
└── .gitignore             Loại dependencies, build, env, log khỏi Git
```

Không có `package.json` ở root: chạy npm trong `client` hoặc `server`. Mỗi ứng dụng có `package.json` và `package-lock.json` riêng. `.git` là lịch sử Git, không phải mã sản phẩm. Không thấy `.github` workflow, Dockerfile/docker-compose hay cấu hình CI/CD trong danh sách file hiện tại; không nên mô tả dự án đã có pipeline tự động dựa trên suy đoán.

## 3. Backend — các thư mục và tập tin nền tảng

```text
server/
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── config/env.ts
│   ├── database/
│   ├── routes/index.ts
│   ├── middlewares/
│   ├── modules/
│   ├── services/
│   ├── jobs/
│   ├── realtime/event-status.gateway.ts
│   ├── types/express.d.ts
│   └── utils/
├── tests/                 29 file *.test.ts; trong đó 2 integration MySQL
├── scripts/verify-ticket-email.mjs
├── .env.example
├── package.json
├── package-lock.json
└── tsconfig.json
```

| File/thư mục | Công dụng cụ thể |
|---|---|
| `src/server.ts` | Kiểm tra kết nối DB, đồng bộ lifecycle lúc khởi động, mở cổng HTTP, tạo WebSocket, bắt đầu 6 jobs, xử lý dừng server/pool |
| `src/app.ts` | Tạo Express app; CORS, Helmet, log Morgan, JSON, cookie; mount API; health check; xử lý 404/lỗi |
| `src/config/env.ts` | Nạp dotenv và kiểm tra cấu hình bằng Zod; DB, JWT, Google, QR key, email, Cloudinary, seed và cleanup |
| `src/routes/index.ts` | Mount Public Events, Checkout, Ticket Retrieval và Admin Orders. Các module còn lại mount trực tiếp ở app.ts |
| `src/database/pool.ts` | Connection pool mysql2, tối đa 10 kết nối; xử lý Date theo `+07:00`, UTF-8, trả DECIMAL dạng số; health check DB |
| `src/database/seed.ts` | Tạo/cập nhật tài khoản Admin/Staff local phục vụ phát triển |
| `src/database/seed-admin-demo.ts` | Fixture quản trị để demo các màn hình Admin |
| `src/database/seed-workflows.ts` | Fixture nghiệp vụ trong category cách ly `qa-workflow` |
| `src/database/verify-workflows.ts` | Đối chiếu fixture và các phép thử bị DB từ chối; các kiểm tra âm rollback |
| `src/types/express.d.ts` | Bổ sung kiểu `authUser` cho Express Request |
| `src/utils/app-error.ts` | Lỗi ứng dụng có HTTP status/code/message |
| `src/utils/response.ts` | Đóng gói response thành công nhất quán |
| `src/utils/jwt.ts` | Ký/kiểm tra access JWT và dữ liệu payload |
| `tsconfig.json` | TypeScript strict, NodeNext ESM, ES2022; biên dịch src sang dist; không đưa tests vào build ứng dụng |
| `tests/tsconfig.json` | Cấu hình kiểu phục vụ mã test |
| `scripts/verify-ticket-email.mjs` | Tạo database `ticketboxqr_test_*` dùng một lần, chạy schema/seeds/verify/tests, xóa đúng database nó tạo |
| `dist/` | JavaScript build để Node chạy; không phải nơi sửa source |
| `node_modules/` | Package đã cài; không phải source nghiệp vụ |

`timezone: '+07:00'` của mysql2 là cấu hình chuyển đổi giá trị Date của driver. Schema còn có `SET time_zone = '+07:00'` cho phiên chạy SQL; cần bảo đảm múi giờ MySQL của môi trường thực tế khi đối chiếu `NOW()`/báo cáo, không mặc định mọi phiên DB đã được script thiết lập vĩnh viễn.

### Middleware

| File | Vai trò |
|---|---|
| `authenticate.ts` | Đọc Bearer token, xác minh JWT, đọc lại tài khoản còn active, gắn authUser |
| `authorize.ts` | Kiểm tra role admin/staff cho API |
| `validate.ts` | Kiểm tra body/query/params bằng Zod trước controller |
| `require-staff-schema.ts` | Kiểm tra schema có cột Google Staff/approval; báo 503 nếu DB cũ chưa tương thích |
| `error-handler.ts` | Chuẩn hóa lỗi HTTP, Zod/JWT/DB; file này cũng xuất notFoundHandler đang dùng bởi app.ts |
| `not-found.ts` | Handler 404 riêng có trong cây source; app.ts hiện dùng bản từ error-handler.ts |

### Mẫu tổ chức trong module

| Hậu tố | Đọc file này khi muốn biết |
|---|---|
| `.routes.ts` | Endpoint nào, method nào, ai có quyền, schema nào được kiểm tra |
| `.schema.ts` | Dữ liệu hợp lệ: kiểu, độ dài, trạng thái, giới hạn số lượng/thời gian |
| `.controller.ts` | Đọc request và trả response như thế nào |
| `.service.ts` | Điều kiện và thứ tự xử lý nghiệp vụ |
| `.repository.ts` | Query SQL, bảng liên quan, transaction và khóa dữ liệu |
| `.types.ts` | Kiểu dữ liệu, mã kết quả dùng chung nội bộ module |
| `.export.ts` | Cách tạo file xuất |

Không phải module nào cũng có đủ tất cả hậu tố. Các ngoại lệ SQL/service và logic nằm tại route được ghi trong tài liệu 01 để tránh hiểu kiến trúc lý tưởng là hiện trạng tuyệt đối.

## 4. Backend — từng module làm gì?

| Thư mục `src/modules/` | Các nhóm file hiện có | Công dụng và owner |
|---|---|---|
| `auth/` | `auth.routes/schema/controller/service/repository.ts`; `auth-session.repository.ts`; `refresh-token.ts`; `google-identity.service.ts` | Bửu: login local/Google, user hiện tại, refresh rotation, logout, xác minh Google, session hash |
| `categories/` | `admin-categories.routes/schema/controller/service/repository.ts`; `categories.routes.ts` | Bửu: quản trị danh mục và endpoint Public đọc danh mục active |
| `events/` | `admin-events.routes/schema/controller/service/repository.ts` | Bửu: tạo/sửa, readiness, publish, lịch publish, hide/show, cancel, delete draft |
| `events/` | `events.routes/schema/controller/service/repository.ts` | Tài: Public Event list/detail, filter/sort/page và khả năng bán |
| `events/` | `event-lifecycle.repository/service.ts`, `event-status.publisher.ts` | Bửu: chuyển trạng thái theo thời gian, điều phối tín hiệu sau commit |
| `events/` | `event-cancellation-email.repository.ts` | Bửu: claim, lease, recovery và ghi kết quả email hủy Event |
| `ticket-types/` | `admin-ticket-types.routes/schema/controller/service/repository.ts` | Bửu: hạng vé theo Event; capacity, giá, thời gian bán, active, pause/resume |
| `admin-staff/` | `admin-staff.routes/schema/controller/service/repository.ts` | Bửu: duyệt/từ chối/kích hoạt/ngưng Staff, tên hiển thị, gán/thu hồi Event |
| `dashboard/` | `admin-dashboard.routes/controller/service/repository.ts` | Bửu: số liệu vận hành tổng quan, Event chưa có Staff, lỗi lịch publish, đơn/refund |
| `uploads/` | `admin-uploads.routes.ts` | Bửu: tạo chữ ký upload ảnh Cloudinary cho Admin |
| `checkout/` | `checkout.routes/schema/controller/service/repository.ts` | Tài: OTP endpoints, tạo Order/idempotency, giữ/nhả tồn, lookup bằng token, Payment, phát hành Ticket |
| `orders/` | `admin-orders.routes/schema/controller/service/repository.ts` | Tài: quản trị Order, thống kê/filter options/detail, hủy pending, Refund, resend/retry email |
| `tickets/` | `ticket-retrieval.routes/controller/service/repository.ts`; `ticket-email.repository.ts` | Tài: tra cứu qua email và queue gửi/gửi lại vé; không phải CRUD Ticket cho khách |
| `checkins/` | `checkin.routes/schema/controller/service/repository/types.ts` | Khôi: assigned Events, scan/nhập mã, atomic check-in, mã kết quả và recent logs |
| `reports/` | `report.routes/schema/controller/service/repository/export.ts` | Khôi: tổng hợp số liệu, tìm Event, lọc check-in logs, tạo Excel |

Payment, Refund và QR không có một thư mục module CRUD riêng cho mỗi tên. Payment nằm trong Checkout; Refund được tạo khi hủy Event và thao tác qua Admin Orders; QR nằm trong `src/services` và được Checkout/Email/Check-in sử dụng theo vai trò.

### Services dùng chung

| `server/src/services/` | Công dụng |
|---|---|
| `email-verification.service.ts` | Sinh OTP, hash, TTL, số lần thử, xác nhận và tiêu thụ token email |
| `public-email-security.service.ts` | reCAPTCHA v3 và cooldown IP/email/action bằng NodeCache |
| `mail.service.ts` | Transport Gmail, HTML email, QR attachment, escape nội dung |
| `qr.service.ts` | Tạo ảnh QR Data URL từ payload ticketbox |
| `qr-encryption.service.ts` | Mã hóa/giải mã QR AES-256-GCM, key ID, kiểm tra định dạng và ticket-code binding |
| `ticket-email.service.ts` | Chuẩn bị nội dung vé, khôi phục QR, phân loại lỗi provider và ghi kết quả gửi |

### Jobs và realtime

| File | Chu kỳ/hành vi hiện tại |
|---|---|
| `expire-orders.job.ts` | Mỗi 30 giây: xử lý Orders pending quá hạn và nhả reservation |
| `scheduled-publish.job.ts` | Lúc khởi động và cron mỗi 30 giây: publish Event đã hẹn và đủ readiness |
| `event-lifecycle.job.ts` | Cron mỗi giây: đồng bộ ongoing/completed; startup sync ở server.ts |
| `ticket-email.job.ts` | Lúc khởi động và mỗi 15 giây: recover/claim/deliver email vé; tránh tick trùng trong process |
| `event-cancellation-email.job.ts` | Lúc khởi động; lên lịch lượt tiếp sau khi batch xong, cách 60 giây; email hủy riêng |
| `auth-session-cleanup.job.ts` | Dọn session hết hạn/đã thu hồi theo retention; mặc định chu kỳ 24 giờ, retention 30 ngày |
| `realtime/event-status.gateway.ts` | WebSocket gắn vào HTTP server, public-data-only, heartbeat/cleanup; không chứa dữ liệu khách/QR |

Jobs chạy trong server process, queue là các dòng MySQL `email_logs`. Chưa có Redis/BullMQ/RabbitMQ trong runtime của dự án.

## 5. Frontend — cấu trúc và entry point

```text
client/
├── index.html
├── public/                  favicon.svg, icons.svg
├── src/
│   ├── main.tsx             Khởi động React
│   ├── App.tsx              AuthProvider + AppRoutes
│   ├── routes/              Routing và bảo vệ role
│   ├── context/             AuthContext
│   ├── layouts/             Public/Admin/Staff
│   ├── pages/               Trang nghiệp vụ
│   ├── components/          Thành phần tái sử dụng
│   ├── services/            API và tích hợp trình duyệt
│   ├── hooks/               reCAPTCHA và email cooldown
│   ├── types/               Kiểu TypeScript
│   ├── constants/           Hằng số Event
│   ├── lib/                 Tiện ích
│   ├── styles/              CSS và theme
│   └── assets/              Ảnh nền và hình minh họa
├── tests/recaptcha.test.cjs
├── .env.example
├── package.json / package-lock.json
├── vite.config.ts
├── eslint.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── postcss.config.mjs
├── pnpm-workspace.yaml
└── default_shadcn_theme.css
```

| File | Vai trò |
|---|---|
| `index.html` | HTML host có root cho React; Vite dùng làm entry |
| `src/main.tsx` | createRoot, StrictMode, BrowserRouter, import CSS và bắt đầu nạp reCAPTCHA |
| `src/App.tsx` | Bọc route bằng AuthProvider |
| `src/routes/AppRoutes.tsx` | Khai báo các đường dẫn và lazy load page/layout qua Suspense |
| `src/routes/ProtectedRoute.tsx` | Chờ khôi phục auth, kiểm tra role trước khi render route Admin/Staff |
| `src/context/AuthContext.tsx` | User/token/loading và login/logout/Google login; khôi phục refresh session khi app mở |
| `src/layouts/PublicLayout.tsx` | Khung Header/Footer và Outlet các trang Public |
| `src/layouts/AdminLayout.tsx` | Điều hướng và khung quản trị |
| `src/layouts/StaffLayout.tsx` | Khung vận hành Staff |
| `vite.config.ts` | React plugin, Tailwind Vite plugin, phân giải alias từ tsconfig |
| `tsconfig.app.json` | Kiểu trình duyệt/JSX; alias `@/* → src/*`; kiểm tra code ứng dụng |
| `tsconfig.node.json` | Kiểu cho cấu hình chạy trong Node như Vite config |
| `eslint.config.js` | Quy tắc JavaScript/TypeScript, React Hooks và Fast Refresh |
| `postcss.config.mjs` | Cấu hình PostCSS hiện rỗng; Tailwind được tích hợp qua Vite plugin |
| `pnpm-workspace.yaml` | File cấu hình pnpm còn trong repo, có kiến trúc Linux; workflow README hiện dùng npm/lockfile npm |

### Pages và route

| File dưới `src/pages/` | URL | Chức năng |
|---|---|---|
| `auth/LoginPage.tsx` | `/login` | Trang đăng nhập local hoặc Google Staff |
| `public/HomePage.tsx` | `/` | Trang đầu, giới thiệu/danh mục/Event và điểm vào tìm vé |
| `public/EventListPage.tsx` | `/events` | Search/filter/sort/page Event |
| `public/EventDetailPage.tsx` | `/events/:id` | Nội dung Event, lịch, địa điểm, trạng thái bán, chọn vé |
| `public/CheckoutPlaceholder.tsx` | `/checkout/:id` | Đã có checkout thật: thông tin buyer, OTP, chọn mua và tạo Order; tên Placeholder là tên file cũ |
| `public/OrderPaymentPage.tsx` | `/orders/:id` | Đọc đơn bằng token, đếm hạn giữ vé, Payment mô phỏng và hiển thị QR sau xác nhận |
| `admin/AdminDashboardPage.tsx` | `/admin` | Tổng quan vận hành, số liệu và lối vào module |
| `admin/AdminCategoriesPage.tsx` | `/admin/categories` | Danh mục |
| `admin/AdminEventsPage.tsx` | `/admin/events` | Event, form và lifecycle; dạng thẻ/danh sách |
| `admin/AdminTicketTypesPage.tsx` | `/admin/ticket-types` | Chọn Event, quản lý hạng vé |
| `admin/AdminStaffPage.tsx` | `/admin/staff` | Duyệt/quản lý Staff, phân công |
| `admin/AdminOrdersPage.tsx` | `/admin/orders` | Danh sách/chi tiết Order, hủy pending, Refund, email |
| `admin/AdminOperationsPage.tsx` | `/admin/checkins`, `/admin/reports` | Hai chế độ Logs và Reports/Excel |
| `staff/StaffHomePage.tsx` | `/staff` | Chọn Event, Scanner/nhập tay, kết quả và recent logs |
| `admin/AdminPlaceholderPage.tsx` | Chưa gắn route hiện tại | Trang mẫu còn trong source; không tính là module nghiệp vụ đang hoạt động |

AppRoutes không khai báo catch-all `*` hiện tại; không nên mô tả đã có trang 404 riêng chỉ vì Backend có handler 404.

### Components

| Nhóm/tập tin | Dùng để làm gì? |
|---|---|
| `auth/LoginForm.tsx` | Form email/mật khẩu; React Hook Form + Zod |
| `auth/GoogleStaffLogin.tsx` | Tích hợp Google Identity script/button, xử lý Staff pending/approved |
| `admin/EventCoverUploader.tsx` | Chọn ảnh, lấy chữ ký, upload, hiển thị kết quả/lỗi |
| `checkin/CameraScanner.tsx` | Quản lý camera, decode QR, tắt stream/timer khi đóng/rời trang |
| `event/EventCard.tsx` | Thẻ Event trong danh sách |
| `event/EventCardSkeleton.tsx` | Khung chờ khi tải dữ liệu Event |
| `event/EventHeader.tsx` | Phần thông tin đầu trang Event |
| `event/TicketSelector.tsx` | Chọn hạng và số lượng để tới Checkout |
| `event/CategorySection.tsx` | Hiển thị nhóm danh mục ở Public |
| `event/TicketRetrievalForm.tsx` | Form tìm lại vé qua email, reCAPTCHA, loading và cooldown |
| `layout/Header.tsx`, `Footer.tsx`, `NavSearch.tsx` | Điều hướng Public, chân trang, tìm kiếm |
| `shared/CategoryIcon.tsx` | Ánh xạ icon danh mục |
| `shared/EmptyState.tsx` | Trạng thái không có dữ liệu |
| `shared/NativeSelect.tsx` | Select tái sử dụng |
| `shared/StatusBadge.tsx` | Hiển thị trạng thái |
| `figma/ImageWithFallback.tsx` | Component ảnh dự phòng còn trong source; chưa thấy đi từ entry hiện tại |
| `ui/` | Bộ component mẫu theo kiểu shadcn/Radix; xem phân loại bên dưới |

`components/ui` chứa: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip; kèm `utils.ts` và `use-mobile.ts`.

Các tên mô tả đúng loại widget: chart là vỏ biểu đồ Recharts, carousel là thanh ảnh Embla, command là hộp lệnh cmdk, drawer là ngăn kéo Vaul, sonner là toast, form là tích hợp React Hook Form. Tuy nhiên kiểm tra đồ thị import từ `main.tsx` gồm import động **chưa tìm thấy đường sử dụng đến components/ui**. Các màn hình đang dùng nhiều HTML/CSS và component riêng. Sự tồn tại của template không chứng minh chức năng đó xuất hiện trong ứng dụng.

### Services phía client

| File `src/services/` | Công dụng |
|---|---|
| `api.ts` | Wrapper fetch: GET/POST/auth request/download; lỗi có status/code; refresh một lần khi 401 |
| `auth.service.ts` | Login/Google/me/refresh/logout, token trong bộ nhớ, chia sẻ refreshPromise |
| `category.service.ts` | Danh mục Public |
| `event.service.ts` | Event Public và ánh xạ response sang dữ liệu UI |
| `order.service.ts` | Request/confirm OTP, create Order, POST lookup, pay |
| `admin-categories.service.ts` | CRUD/status danh mục Admin |
| `admin-events.service.ts` | Event Admin và các action lifecycle/visibility/schedule; tự đọc đủ các trang 50 bản ghi để các count/filter/bộ chọn dùng toàn bộ Event |
| `admin-ticket-types.service.ts` | List/create/update/pause/resume/delete hạng vé |
| `admin-staff.service.ts` | Staff approval/profile/status/assignments |
| `admin-orders.service.ts` | List/stats/filter options/detail, cancel, Refund, resend/retry |
| `admin-dashboard.service.ts` | Tải summary Dashboard |
| `checkin.service.ts` | Assigned Events, recent logs, gửi request check-in |
| `report.service.ts` | Tìm Event, tải Reports/Logs, tải file Excel |
| `cloudinary-upload.service.ts` | Upload ảnh trực tiếp bằng chữ ký do server cấp |
| `recaptcha.ts` | Nạp một script, đợi ready, execute action, timeout và retry tải script |
| `event-realtime.service.ts` | Một WebSocket dùng chung, subscribe/unsubscribe, reconnect; UI tải lại REST |

Form Ticket Retrieval gọi `apiPost` trực tiếp; không có một file `ticket-retrieval.service.ts` riêng ở client.

### Hooks, types, CSS và assets

| Mục | Công dụng |
|---|---|
| `hooks/useRecaptcha.ts` | Đưa trạng thái tải/lỗi/ready và cách lấy token vào React |
| `hooks/useEmailCooldown.ts` | Đếm thời gian chờ gửi lại và cleanup timer |
| `types/auth.ts` | User, role và kết quả xác thực |
| `types/event.types.ts` | Dữ liệu Event/Ticket Type dùng ở Public |
| `types/order.types.ts` | Buyer, selection, Order và PaymentResult |
| `constants/eventconstants.ts` | Hằng số phục vụ giao diện Event |
| `lib/utils.ts` | Tiện ích format/ghép class được code UI sử dụng |
| `lib/cyber-audio.ts` | Tiện ích âm thanh có sẵn; chưa thấy được import từ entry hiện tại |
| `src/index.css` | Import styles/index.css và admin-tech.css; thêm phần Tailwind chung |
| `styles/index.css` | Nạp fonts, tailwind và theme |
| `styles/fonts.css` | Nạp Google Fonts: Manrope, Be Vietnam Pro và JetBrains Mono |
| `styles/tailwind.css` | Nạp Tailwind và tw-animate-css |
| `styles/theme.css` | Biến theme, màu sắc, token giao diện |
| `styles/admin-tech.css` | Giao diện Admin và các lớp trang theo chủ đề hiện tại |
| `styles/admin-categories.css` | CSS riêng màn Danh mục, import ở page |
| `App.css`, `styles/globals.css`, `default_shadcn_theme.css` | File CSS tồn tại; không nằm trong chuỗi import chính đã đọc, không mặc định mọi file đều được nạp |
| `assets/` | hero, SVG mẫu, ảnh nền login/public/admin/staff; chỉ là tài nguyên giao diện |
| `public/` | Tài nguyên tĩnh phục vụ trực tiếp; khác assets được import vào bundle |

## 6. Database — 13 bảng và ý nghĩa

Nguồn duy nhất: [001_initial_schema.sql](../../database/migrations/001_initial_schema.sql). Dự án dùng SQL trực tiếp, chưa có Prisma/Sequelize/TypeORM.

| Bảng | Lưu gì? | Quan hệ chính |
|---|---|---|
| `users` | Admin/Staff, password hash nullable, Google sub, approval/active | Cha của sessions; Staff trong assignments/logs |
| `auth_sessions` | Refresh session hash, expiry/revocation, metadata | Nhiều session của một user |
| `categories` | Danh mục, slug, icon, active, sort order | Một danh mục có nhiều Events |
| `events` | Nội dung/lịch/địa điểm/capacity/lifecycle/visibility/publish/hủy | Thuộc category; có tiers, orders, staff assignments |
| `event_staff` | Ai được gán Event, ai gán, lúc gán/thu hồi | Nối users và events, lưu lịch sử phân công |
| `ticket_types` | Hạng, giá, capacity/reserved/sold/max-per-order/lịch bán | Thuộc Event; được Order Items tham chiếu |
| `orders` | Buyer email/name/phone, tổng lượng/tiền, trạng thái, lookup hash, idempotency, hạn | Một Event có nhiều Orders |
| `order_items` | Hạng/số lượng, tên hạng và giá snapshot lúc mua | Thuộc Order và tham chiếu Ticket Type |
| `tickets` | Mỗi vé, ticket_code, QR hash/ciphertext, holder, trạng thái/check-in/hủy | Mỗi Order Item có nhiều Tickets |
| `payments` | Bản ghi thanh toán free/simulated, amount, status, paid_at | Thuộc Order; giữ Payment success |
| `refunds` | Hoàn tiền mô phỏng, amount, reason, trạng thái, completed_at | Tối đa một bản ghi theo Order nhờ unique constraint |
| `checkin_logs` | Event/Staff/Ticket, kết quả quét, mã hash/che, thời gian | Lịch sử vận hành cổng; ticket_id có thể null khi không tìm được vé |
| `email_logs` | Queue/lịch sử gửi, type, recipient, status, attempts, lịch retry/lease, provider_id | Thuộc Order; ba loại email nghiệp vụ |

Chuỗi dữ liệu quan trọng: Category có Event; Event có Ticket Types và Orders; Order có Order Items; Order Item sinh Tickets. Payment/Refund/Email Logs gắn Order. Check-in Logs nối Event + Staff + Ticket.

`order_items.ticket_type_name` và `unit_price` là snapshot để sửa hạng vé không viết lại giao dịch cũ. `checkin_logs.event_id` lưu cổng Event đang quét, cần cả trong trường hợp quét nhầm Event. Không xem hai phần này là dư thừa chỉ vì có thể join được đường khác.

Schema có foreign keys, unique/check constraints, indexes và triggers bảo vệ lifecycle/quan hệ/giá/tồn kho/role. Quy tắc nghiệp vụ được kiểm tra cả ở service lẫn database ở các phần đã triển khai. Không thấy khai báo VIEW trong schema hiện tại.

File schema bắt đầu bằng DROP/CREATE database dùng cho reset/cài mới trong đồ án; nó không phải tập incremental migrations. Chạy file này trên dữ liệu cần giữ sẽ làm mất dữ liệu. Lần rà soát này không chạy schema hoặc seed.

## 7. Bản đồ API đang có

Tất cả đường dẫn dưới đây có tiền tố `/api` trừ WebSocket. Bảng ghi route nghiệp vụ, không liệt kê lặp mọi alias.

| Nhóm/quyền | Endpoint và tác dụng |
|---|---|
| Hệ thống | `GET /health`: tình trạng API/DB; `GET /admin/test`: thử RBAC Admin |
| Auth | `POST /auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Danh mục Public | `GET /categories` |
| Danh mục Admin | `GET/POST /admin/categories`; `PATCH/DELETE /admin/categories/:id` |
| Event Public | `GET /events`, `GET /events/:id` |
| Event Admin | `GET/POST /admin/events`; `GET/PATCH/DELETE /admin/events/:id`; `GET /:id/publish-readiness`; `POST /:id/publish`; `PATCH /:id/publish-schedule`; `POST /:id/cancel`; `PATCH /:id/visibility` dưới `/admin/events` |
| Hạng vé Admin | `GET/POST /admin/ticket-types`; `PATCH/DELETE /admin/ticket-types/:id`; `PATCH /:id/sales-status` |
| Staff Admin | `GET /admin/staff`; `PATCH /:staffId`, `PATCH /:staffId/status`; `POST /:staffId/assignments`; `DELETE /:staffId/assignments/:assignmentId` dưới `/admin/staff` |
| Dashboard/Upload Admin | `GET /admin/dashboard/summary`; `POST /admin/uploads/image-signature` |
| OTP Public | Client dùng `POST /orders/verify-email/request` và `/orders/verify-email/confirm`; route cũng có aliases `/checkout/email-verifications`, `/checkout/email-verifications/confirm` |
| Order/Payment Public | `POST /checkout/orders`; `POST /checkout/orders/:id/lookup`; `POST /checkout/orders/:id/pay` |
| Tìm lại vé Public | `POST /tickets/retrieval` |
| Orders Admin | `GET /admin/orders`, `/stats`, `/filter-options`, `/:id`; `POST /:id/cancel`; `PATCH /:id/refund`; `POST /:id/resend-email`; `POST /:id/email-logs/:logId/retry` dưới `/admin/orders` |
| Vận hành Staff | `GET /staff/events`; `GET/POST /staff/events/:eventId/checkins` |
| Reports Admin | `GET /admin/reports/events`, `GET /admin/reports`, `GET /admin/reports/export` |
| Logs Admin | `GET /admin/checkins`, `GET /admin/checkins/export` |
| Realtime | WebSocket `/ws/events` |

Checkout router hiện được mount cả tại `/api/checkout` và `/api`; vì vậy có thêm đường alias như `/api/orders`. Đó là hai đường vào cùng implementation, không phải hai module Order độc lập. Lookup GET chứa token đã được thay bằng POST trong working tree.

Payload chuẩn: thành công `{ success: true, data, meta? }`; thất bại `{ success: false, message, code }`, một số lỗi email thêm retryAfterSeconds. File download là binary XLSX; endpoint logout có thể trả 204 không body.

## 8. Cấu hình môi trường và lệnh vận hành

Chỉ liệt kê tên biến, không đưa giá trị bí mật vào tài liệu:

| Nhóm | Biến chính |
|---|---|
| Client | `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_RECAPTCHA_SITE_KEY`, tùy chọn `VITE_EVENT_WS_URL` |
| Server HTTP | `NODE_ENV`, `PORT`, `CLIENT_URL` |
| MySQL | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Login/session | `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `REFRESH_TOKEN_DAYS`; nhóm `AUTH_SESSION_*` |
| Email | `MAIL_USER`, `MAIL_APP_PASSWORD`, `MAIL_FROM_NAME` |
| QR | `QR_ENCRYPTION_KEY`, `QR_ENCRYPTION_KEY_ID` |
| reCAPTCHA | `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE`, `RECAPTCHA_HOSTNAME` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_EVENT_FOLDER` |
| Seed | `SEED_ADMIN_*`, `SEED_STAFF_*`, `SEED_DEFAULT_PASSWORD` |

`VITE_*` được đưa vào mã client, chỉ dùng cho cấu hình công khai. Bí mật DB/JWT/mail/QR/Cloudinary secret nằm server. File `.env.example` là mẫu; `.env`/`.env.local` không đưa vào Git.

| Thư mục | Lệnh có sẵn | Công dụng |
|---|---|---|
| client | `npm run dev` | Vite phát triển/HMR |
| client | `npm run lint` | ESLint |
| client | `npm run build` | TypeScript project build + Vite production bundle |
| client | `npm run preview` | Xem bundle build tại máy phát triển |
| client | `node --test tests/recaptcha.test.cjs` | Test reCAPTCHA/form có sẵn, chưa nằm trong npm test script |
| server | `npm run dev` | tsx watch chạy TypeScript server |
| server | `npm run typecheck` | Kiểm tra kiểu, không emit |
| server | `npm run build` / `npm start` | Biên dịch tsc / chạy dist/server.js |
| server | `npm test` / `npm run test:watch` | Vitest một lượt / theo dõi |
| server | `npm run seed`, `seed:admin-demo`, `seed:workflows`, `db:verify` | Tài khoản, fixture và kiểm tra DB; đọc điều kiện reset trước khi dùng |
| server | `node scripts/verify-ticket-email.mjs` | Full suite trên database dùng một lần, cần quyền tạo/xóa DB test |
| root | `./scripts/verify.ps1 -Scope all` | Ghép lint/build client + typecheck/build/test server; không bao gồm client reCAPTCHA test riêng |

Hai cửa sổ terminal chạy client/server là đủ cho mô hình phát triển được mô tả; MySQL chạy thành dịch vụ riêng. Vite mặc định 5173; API mặc định 3000; MySQL mặc định 3306. Đó là default trong cấu hình, không khẳng định dịch vụ đang chạy ở các cổng này vào lúc đọc tài liệu.

## 9. Định vị nhanh khi gặp vấn đề

| Triệu chứng | Nơi bắt đầu đọc |
|---|---|
| Không đăng nhập/refresh | AuthContext → auth.service client → auth routes/service/session repository |
| Event không publish | readiness → admin-events.service → Ticket Type/Category và schema |
| Public hiện sai giờ bán | events.service/repository → checkout.service → lịch Event/Tier |
| Sai tồn/hết vé | checkout repository và các transaction cancellation/expiry; không sửa số đếm chỉ ở UI |
| Không nhận OTP | reCAPTCHA + rate-limit → email-verification → mail transporter |
| Vé có nhưng chưa có thư | email_logs → ticket-email job/service → SMTP; tách với trạng thái Order |
| Không gửi lại được QR | qr_token_encrypted, QR key ID/key, prepareTicketEmail |
| Staff không thấy Event | user active/approved → assignment → listEvents predicate |
| QR bị từ chối | result code → checkin.service và log; không kết luận từ camera đọc được mã |
| Báo cáo lệch số | Định nghĩa chỉ số, mốc thời gian và Refund status → report.repository |
| Giao diện không cập nhật lifecycle | WebSocket subscription → REST refetch → polling fallback |

Git workflow được tài liệu dự án quy định: owner branch → develop → main sau review. Bộ hướng dẫn `.agents/skills/ticketbox-event-safety` và `ticketbox-verify` hỗ trợ trợ lý kiểm tra invariants/chất lượng, không phải dependency của sản phẩm.
