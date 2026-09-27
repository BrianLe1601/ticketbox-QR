# TicketBoxQR — Công cụ và thư viện

Kiểm kê ngày **27/09/2026**, đọc trực tiếp hai manifest, hai lockfile và import trong source/config. Phiên bản dưới đây là **phiên bản đã khóa trong package-lock.json**, không phải bản mới nhất trên Internet hoặc xác nhận bản đang chạy trên hosting.

## 1. Cách đọc danh mục

- Client: **50 dependencies + 12 devDependencies = 62 khai báo trực tiếp**.
- Server: **19 dependencies + 20 devDependencies = 39 khai báo trực tiếp**.
- Tổng: **101 khai báo ở hai ứng dụng, 94 tên package khác nhau** vì một số tên dùng cả hai phía.
- Client lockfile chứa **360 vị trí package**; server chứa **473**. Số này gồm dependencies gián tiếp, bản lồng nhau và package tùy chọn theo nền tảng; không phải 833 thư viện nghiệp vụ mà nhóm tự lựa chọn.
- [Phụ lục lockfile](04-package-lock-inventory.md) liệt kê toàn bộ 833 vị trí với version. Hai lockfile là nguồn đầy đủ về cây phụ thuộc.

`dependencies` là cách manifest phân nhóm; không đồng nghĩa mọi package trong đó đều được bundle hoặc sử dụng. `devDependencies` chủ yếu phục vụ compiler/build/lint/tests. Ký hiệu `^`/`~` trong package.json là khoảng phiên bản được phép; lockfile giữ bản cụ thể. Dùng npm ci sẽ dựa trên lockfile.

Đồ thị import TypeScript từ `client/src/main.tsx`, có đi theo các import động trực tiếp, cho thấy runtime đi đến React, React DOM, React Router, React Hook Form, Zod/resolver, Lucide, jsQR, clsx và tailwind-merge. CSS/build dùng Tailwind và các plugin riêng. Không thấy đường vào `components/ui`; đây là kết quả phân tích source, không phải phép đo kích thước bundle production.

## 2. Công cụ và dịch vụ ngoài npm

| Công cụ/dịch vụ | Vai trò được xác nhận trong dự án | Nguồn/giới hạn |
|---|---|---|
| Node.js | Chạy API, jobs, compiler/test scripts | Phiên rà soát quan sát Node v24.14.1; không khẳng định mọi thành viên dùng cùng bản |
| npm | Cài dependencies và chạy scripts | package-lock.json + README/scripts; launcher npm trong phiên này lỗi đường dẫn, xem tài liệu 01 |
| MySQL | CSDL quan hệ, transaction, khóa dòng, indexes, constraints, triggers | Schema cần các khả năng như CHECK và SKIP LOCKED; chưa truy vấn version DB đang chạy trong lần này |
| SQL | Ngôn ngữ truy vấn/định nghĩa database | mysql2 + schema/repositories; không có ORM |
| Git | Quản lý phiên bản, owner branches và review/merge | .git, README, AGENTS; working tree đang có thay đổi chưa commit |
| GitHub | Remote repository và lịch sử pull request | README ghi repository BrianLe1601/ticketbox-QR; chưa kiểm tra remote mới qua mạng |
| Trello | Board quản lý phân công/tiến độ | Board TicketBox - Project Plan & Report đã dùng trong task trước; không thuộc runtime |
| PowerShell | Chạy verify.ps1 và thao tác local Windows | scripts/verify.ps1 |
| MySQL Workbench | Công cụ mở/chạy schema theo README | Được tài liệu đề cập; không bắt buộc đối với runtime, không kiểm tra cài đặt trên máy |
| Google Identity Services | Nút Google login Staff ở trình duyệt | GoogleStaffLogin nạp script; server dùng google-auth-library |
| Google reCAPTCHA v3 | Xác minh yêu cầu gửi OTP/tìm vé | Client script + endpoint xác minh phía server; không có npm wrapper reCAPTCHA |
| Gmail/SMTP | Provider email hiện tại | Nodemailer service gmail trong mail.service; người nhận không bị giới hạn Gmail |
| Cloudinary | Lưu/serve ảnh Event | Client upload trực tiếp với chữ ký server |
| Google Fonts | Cấp font giao diện qua CSS import | styles/fonts.css nạp Manrope, Be Vietnam Pro, JetBrains Mono; không phải npm package |
| Browser DevTools/trình duyệt | Chạy giao diện và kiểm tra request/camera khi UAT | Là môi trường vận hành/debug; chưa làm UAT trình duyệt trong lần này |
| Codex + quy tắc .agents | Hỗ trợ rà soát/phát triển trong phiên làm việc | Công cụ hỗ trợ, không phải dependency khi chạy TicketBoxQR |
| Figma/shadcn dấu vết template | Có components/figma và components/ui trong source | Không đủ bằng chứng để khẳng định có tích hợp Figma API, dự án Next.js hoặc pipeline thiết kế tự động |

Không thấy tích hợp cổng thanh toán thật, Redux, React Query, Socket.IO, Redis, BullMQ, Prisma, Sequelize, TypeORM, Jest, Cypress hay Playwright trong các dependency trực tiếp của sản phẩm. Vitest dùng cho Backend; test client bổ sung dùng Node test runner. Không cài thêm công cụ để thực hiện kiểm kê này.

## 3. API nền tảng có sẵn, không phải npm package

| API | Công dụng trong project |
|---|---|
| fetch / Headers / URL / URLSearchParams | HTTP client, query, reCAPTCHA server verification |
| WebSocket của trình duyệt | Nhận thông báo lifecycle Event |
| navigator.mediaDevices.getUserMedia | Xin camera và lấy video stream |
| canvas/getImageData | Chuyển khung hình thành pixels cho jsQR |
| sessionStorage | Lookup token của Order theo tab |
| localStorage | Lưu một số lựa chọn giao diện như dạng xem Event |
| Intl/Date | Format tiền/ngày và xử lý múi giờ |
| AbortController/AbortSignal | Hủy request, timeout, cleanup |
| Blob/URL.createObjectURL | Download Excel ở client |
| node:crypto | Random, SHA-256, HMAC, AES-256-GCM, timingSafeEqual |
| node:fs, node:path, node:child_process | Scripts đọc schema/chạy verification; không phải ORM hoặc queue |
| node:test, node:assert, node:vm | Test client và harness TypeScript có sẵn |

## 4. Client — toàn bộ dependencies trực tiếp

| Package | Khai báo | Bản khóa | Công dụng | Sử dụng trong repo |
|---|---|---|---|---|
| `@hookform/resolvers` | `^5.8.0` | 5.8.0 | Nối schema Zod với React Hook Form. | Đang dùng trong components/auth/LoginForm.tsx. |
| `@radix-ui/react-accordion` | `1.2.3` | 1.2.3 | Primitive UI cho khối nội dung đóng/mở. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-alert-dialog` | `1.1.6` | 1.1.6 | Primitive UI cho hộp xác nhận thao tác. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-aspect-ratio` | `1.1.2` | 1.1.2 | Primitive UI cho giữ tỉ lệ khung. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-avatar` | `1.1.3` | 1.1.3 | Primitive UI cho ảnh đại diện. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-checkbox` | `1.1.4` | 1.1.4 | Primitive UI cho ô chọn. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-collapsible` | `1.1.3` | 1.1.3 | Primitive UI cho vùng thu gọn. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-context-menu` | `2.2.6` | 2.2.6 | Primitive UI cho menu ngữ cảnh. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-dialog` | `1.1.6` | 1.1.6 | Primitive UI cho hộp thoại; cũng làm nền cho sheet. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-dropdown-menu` | `2.1.6` | 2.1.6 | Primitive UI cho menu xổ xuống. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-hover-card` | `1.1.6` | 1.1.6 | Primitive UI cho thẻ hiện khi rê chuột. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-label` | `2.1.2` | 2.1.2 | Primitive UI cho nhãn điều khiển form. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-menubar` | `1.1.6` | 1.1.6 | Primitive UI cho thanh menu. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-navigation-menu` | `1.2.5` | 1.2.5 | Primitive UI cho menu điều hướng. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-popover` | `1.1.6` | 1.1.6 | Primitive UI cho khối nội dung nổi. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-progress` | `1.1.2` | 1.1.2 | Primitive UI cho thanh tiến độ. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-radio-group` | `1.2.3` | 1.2.3 | Primitive UI cho nhóm chọn một. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-scroll-area` | `1.2.3` | 1.2.3 | Primitive UI cho vùng cuộn. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-select` | `2.1.6` | 2.1.6 | Primitive UI cho hộp chọn. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-separator` | `1.1.2` | 1.1.2 | Primitive UI cho đường phân cách. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-slider` | `1.2.3` | 1.2.3 | Primitive UI cho thanh trượt giá trị. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-slot` | `1.1.2` | 1.1.2 | Primitive UI cho ghép props/hành vi vào component con. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-switch` | `1.1.3` | 1.1.3 | Primitive UI cho công tắc. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-tabs` | `1.1.3` | 1.1.3 | Primitive UI cho thẻ chuyển nội dung. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-toggle` | `1.1.2` | 1.1.2 | Primitive UI cho nút bật/tắt. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-toggle-group` | `1.1.2` | 1.1.2 | Primitive UI cho nhóm nút bật/tắt. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@radix-ui/react-tooltip` | `1.1.8` | 1.1.8 | Primitive UI cho chú giải. | Có import trong components/ui; chưa có đường import từ main.tsx vào nhóm template này. |
| `@tailwindcss/vite` | `^4.3.3` | 4.3.3 | Biên dịch Tailwind trong Vite. | Dùng ở vite.config.ts; là công cụ build dù khai báo dependencies. |
| `axios` | `^1.19.0` | 1.19.0 | HTTP client của bên thứ ba. | Có khai báo nhưng chưa thấy import trong source/config đã rà soát; API hiện dùng fetch. |
| `class-variance-authority` | `0.7.1` | 0.7.1 | Tạo biến thể class theo size/variant. | Chỉ thấy trong components/ui; chưa nối vào route hiện tại. |
| `clsx` | `2.1.1` | 2.1.1 | Ghép class CSS có điều kiện. | lib/utils.ts đang dùng; cũng có trong template UI. |
| `cmdk` | `1.1.1` | 1.1.1 | Command menu/hộp tìm lệnh. | Template components/ui/command.tsx; chưa nối vào route hiện tại. |
| `date-fns` | `3.6.0` | 3.6.0 | Thư viện xử lý/định dạng ngày. | Có khai báo nhưng chưa thấy import trong source/config; code hiện dùng Date/Intl. |
| `embla-carousel-react` | `8.6.0` | 8.6.0 | Carousel trượt nội dung. | Template ui/carousel.tsx; chưa nối vào route hiện tại. |
| `input-otp` | `1.4.2` | 1.4.2 | Widget nhập OTP chia ô. | Template ui/input-otp.tsx; không phải bằng chứng Checkout đang dùng widget này. |
| `jsqr` | `^1.4.0` | 1.4.0 | Giải mã QR từ pixel ảnh camera. | CameraScanner tải động khi bật camera. |
| `lucide-react` | `^1.31.0` | 1.31.0 | Bộ icon dạng React component. | Đang dùng rộng khắp Public/Admin/Staff. |
| `next-themes` | `0.4.6` | 0.4.6 | Quản lý theme. | Template ui/sonner.tsx; chưa nối vào route hiện tại; project không phải Next.js. |
| `react` | `^19.2.8` | 19.2.8 | Giao diện component, state và hooks. | Đang dùng từ main.tsx, pages và components. |
| `react-dom` | `^19.2.8` | 19.2.8 | Gắn React vào DOM, tạo portal cho dialog. | Đang dùng ở main.tsx và các trang Admin. |
| `react-hook-form` | `^7.85.0` | 7.85.0 | Quản lý giá trị, validation và submit form. | LoginForm đang dùng; có thêm template ui/form. |
| `react-resizable-panels` | `2.1.7` | 2.1.7 | Panel kéo thay đổi kích thước. | Template ui/resizable.tsx; chưa nối vào route hiện tại. |
| `react-router-dom` | `^7.18.2` | 7.18.2 | Điều hướng SPA, URL params, layouts, route theo role. | Đang dùng ở main.tsx, AppRoutes, ProtectedRoute. |
| `recharts` | `2.15.2` | 2.15.2 | Vẽ biểu đồ React. | Template ui/chart.tsx; Reports hiện dùng số liệu/thẻ/bảng, chưa dùng template này. |
| `sonner` | `2.0.3` | 2.0.3 | Thông báo toast. | Template ui/sonner.tsx; chưa nối vào route hiện tại. |
| `tailwind-merge` | `3.2.0` | 3.2.0 | Gộp class Tailwind và giải quyết nhóm class xung đột. | lib/utils.ts đang dùng; cũng có trong template UI. |
| `tailwindcss` | `^4.3.3` | 4.3.3 | Utility CSS cho bố cục, màu sắc, responsive. | Nạp qua CSS; phối hợp plugin Vite. |
| `tw-animate-css` | `1.3.8` | 1.3.8 | Các utility animation CSS. | Import trong styles/tailwind.css; mức sử dụng từng class phụ thuộc UI. |
| `vaul` | `1.1.2` | 1.1.2 | Drawer/ngăn kéo giao diện. | Template ui/drawer.tsx; chưa nối vào route hiện tại. |
| `zod` | `^4.4.3` | 4.4.3 | Kiểm tra dữ liệu theo schema. | Client: LoginForm. Server: env và API schemas/middleware. |

## 5. Client — toàn bộ devDependencies

| Package | Khai báo | Bản khóa | Công dụng | Sử dụng trong repo |
|---|---|---|---|---|
| `@eslint/js` | `^10.0.1` | 10.0.1 | Bộ quy tắc JavaScript ESLint. | Client có cấu hình sử dụng; server có khai báo nhưng chưa có lint script/config riêng. |
| `@types/node` | `^24.13.3` | 24.13.3 | Khai báo kiểu TypeScript cho node. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/react` | `^19.2.17` | 19.2.18 | Khai báo kiểu TypeScript cho react. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/react-dom` | `^19.2.3` | 19.2.4 | Khai báo kiểu TypeScript cho react-dom. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@vitejs/plugin-react` | `^6.0.4` | 6.0.5 | Tích hợp React và Fast Refresh vào Vite. | client/vite.config.ts. |
| `eslint` | `^10.8.0` | 10.8.1 | Phân tích tĩnh/lint code. | client npm run lint; server có package nhưng chưa có npm run lint. |
| `eslint-plugin-react-hooks` | `^7.1.1` | 7.1.1 | Kiểm tra quy tắc hooks và dependencies effect. | client/eslint.config.js. |
| `eslint-plugin-react-refresh` | `^0.5.3` | 0.5.4 | Kiểm tra module export phù hợp Fast Refresh. | client/eslint.config.js. |
| `globals` | `^17.7.0` | 17.11.0 | Danh sách global của môi trường để ESLint nhận biết. | Client cấu hình browser; server chưa thấy cấu hình ESLint riêng. |
| `typescript` | `~6.0.2` | 6.0.3 | Hệ thống kiểu và compiler tsc. | Client: tsc -b; server: typecheck/build. Không phải runtime riêng của trình duyệt. |
| `typescript-eslint` | `^8.65.0` | 8.67.0 | Tích hợp parser/rules TypeScript cho ESLint. | Client eslint config; server khai báo sẵn nhưng chưa có lint script/config. |
| `vite` | `^8.2.0` | 8.2.1 | Dev server, HMR, build và preview client. | client npm scripts và vite.config.ts. |

## 6. Server — toàn bộ dependencies

| Package | Khai báo | Bản khóa | Công dụng | Sử dụng trong repo |
|---|---|---|---|---|
| `bcrypt` | `^6.0.0` | 6.0.0 | Hash và đối chiếu mật khẩu local. | Auth service và seed accounts. |
| `cloudinary` | `^2.11.0` | 2.11.0 | Ký tham số upload ảnh lên Cloudinary. | modules/uploads/admin-uploads.routes.ts. |
| `cookie-parser` | `^1.4.7` | 1.4.7 | Phân tích cookie request. | app.ts; refresh cookie của Auth. |
| `cors` | `^2.8.6` | 2.8.6 | Cho phép origin client truy cập API với cấu hình credentials. | app.ts; origin từ CLIENT_URL. |
| `dotenv` | `^17.4.2` | 17.4.2 | Nạp biến môi trường từ file env. | config/env.ts, public-email-security và script verification. |
| `exceljs` | `^4.4.0` | 4.4.0 | Tạo workbook XLSX cho Reports/Logs. | modules/reports/report.export.ts; không dùng để lưu dữ liệu nghiệp vụ. |
| `express` | `^5.2.1` | 5.2.1 | HTTP server, middleware và router. | app.ts và các route/controller. |
| `express-rate-limit` | `^8.6.2` | 8.6.2 | Giới hạn request. | Auth, scan theo Staff, export theo Admin; cooldown email dùng NodeCache riêng. |
| `google-auth-library` | `^11.1.0` | 11.1.0 | Xác minh Google ID token phía server. | modules/auth/google-identity.service.ts. |
| `helmet` | `^8.3.0` | 8.3.0 | Thiết lập các HTTP security headers. | app.ts. |
| `jsonwebtoken` | `^9.0.3` | 9.0.3 | Ký/kiểm tra access JWT. | utils/jwt.ts và error handling. |
| `morgan` | `^1.11.0` | 1.11.0 | Access log HTTP. | app.ts; request URL token safe-path bỏ query, production vẫn có referrer/user-agent. |
| `mysql2` | `^3.23.3` | 3.23.3 | MySQL driver Promise, pool, SQL và transaction. | database/pool.ts, repositories, một số service/jobs/seeds/tests. |
| `node-cron` | `^4.6.0` | 4.6.0 | Lập lịch dạng cron. | Jobs scheduled-publish và event-lifecycle. |
| `node-cache` | `^5.1.2` | 5.1.2 | Bộ nhớ có TTL trong process. | OTP, verification token và IP/email cooldown; không bền qua restart. |
| `nodemailer` | `^9.0.5` | 9.0.5 | Gửi email qua transport SMTP. | services/mail.service.ts; transport hiện cấu hình service Gmail. |
| `qrcode` | `^1.5.4` | 1.5.4 | Sinh ảnh QR. | services/qr.service.ts; tạo QR, không giải mã camera. |
| `ws` | `^8.21.3` | 8.21.3 | WebSocket server. | realtime/event-status.gateway.ts; client dùng WebSocket native. |
| `zod` | `^4.4.3` | 4.4.3 | Kiểm tra dữ liệu theo schema. | Client: LoginForm. Server: env và API schemas/middleware. |

## 7. Server — toàn bộ devDependencies

| Package | Khai báo | Bản khóa | Công dụng | Sử dụng trong repo |
|---|---|---|---|---|
| `@eslint/js` | `^10.0.1` | 10.0.1 | Bộ quy tắc JavaScript ESLint. | Client có cấu hình sử dụng; server có khai báo nhưng chưa có lint script/config riêng. |
| `@types/bcrypt` | `^6.0.0` | 6.0.0 | Khai báo kiểu TypeScript cho bcrypt. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/cookie-parser` | `^1.4.10` | 1.4.10 | Khai báo kiểu TypeScript cho cookie-parser. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/cors` | `^2.8.19` | 2.8.19 | Khai báo kiểu TypeScript cho cors. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/express` | `^5.0.6` | 5.0.6 | Khai báo kiểu TypeScript cho express. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/jsonwebtoken` | `^9.0.10` | 9.0.10 | Khai báo kiểu TypeScript cho jsonwebtoken. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/morgan` | `^1.9.10` | 1.9.10 | Khai báo kiểu TypeScript cho morgan. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/node` | `^26.2.0` | 26.2.0 | Khai báo kiểu TypeScript cho node. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/node-cron` | `^3.0.11` | 3.0.11 | Khai báo kiểu TypeScript cho node-cron. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/nodemailer` | `^8.0.1` | 8.0.1 | Khai báo kiểu TypeScript cho nodemailer. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/qrcode` | `^1.5.6` | 1.5.6 | Khai báo kiểu TypeScript cho qrcode. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/supertest` | `^7.2.1` | 7.2.1 | Khai báo kiểu TypeScript cho supertest. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `@types/ws` | `^8.18.1` | 8.18.1 | Khai báo kiểu TypeScript cho ws. | Phục vụ compiler/IDE; không phải chức năng runtime và không cần import trực tiếp bằng tên @types. |
| `eslint` | `^10.8.1` | 10.8.1 | Phân tích tĩnh/lint code. | client npm run lint; server có package nhưng chưa có npm run lint. |
| `globals` | `^17.11.0` | 17.11.0 | Danh sách global của môi trường để ESLint nhận biết. | Client cấu hình browser; server chưa thấy cấu hình ESLint riêng. |
| `supertest` | `^7.2.2` | 7.2.2 | Gửi request thử vào Express app. | Các test HTTP/route; không phải client HTTP của người dùng. |
| `tsx` | `^4.23.12` | 4.23.12 | Chạy TypeScript trực tiếp trong Node, có watch. | server dev và seed/db:verify scripts. |
| `typescript` | `^6.0.3` | 6.0.3 | Hệ thống kiểu và compiler tsc. | Client: tsc -b; server: typecheck/build. Không phải runtime riêng của trình duyệt. |
| `typescript-eslint` | `^8.67.0` | 8.67.0 | Tích hợp parser/rules TypeScript cho ESLint. | Client eslint config; server khai báo sẵn nhưng chưa có lint script/config. |
| `vitest` | `^4.1.10` | 4.1.10 | Test runner, assertions, mocks. | server tests và test:watch. |

## 8. Cách giới thiệu stack đúng với hiện trạng

Có thể mô tả: “TicketBoxQR dùng React + TypeScript + Vite + Tailwind cho giao diện; Node.js + Express + TypeScript cho API; MySQL và SQL trực tiếp cho dữ liệu; JWT/refresh cookie và Google Identity cho Admin/Staff; reCAPTCHA/OTP để bảo vệ luồng email; qrcode tạo QR, jsQR đọc QR; Nodemailer gửi thư; ExcelJS xuất báo cáo; ws đồng bộ trạng thái Event; Vitest/Supertest và Node test runner để kiểm thử.”

Không nên nói Axios là lớp API đang dùng, Recharts đã vẽ Reports, shadcn/Radix đang dựng toàn bộ giao diện, hoặc input-otp đang render OTP Checkout chỉ vì các package đó nằm trong manifest. Cũng không cần xóa những package chưa dùng trong đợt rà soát này: thay đổi dependencies là một việc riêng, không cần thiết để hiểu và chốt phạm vi dự án.

Các công cụ chỉ được nhắc như lựa chọn cá nhân (ví dụ IDE, Postman, phần mềm vẽ sơ đồ) không được ghi là “đã dùng” nếu không có bằng chứng trong repository/phiên làm việc. Danh mục này không phải audit lỗ hổng hoặc license pháp lý của dependencies.
