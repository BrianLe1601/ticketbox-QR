import { isRouteErrorResponse, useRouteError } from "react-router-dom";

/** First paint while the matched layout/page chunks download (same look as the former Suspense fallback). */
export function BootFallback() {
  const path = window.location.pathname;
  const light = path.startsWith("/admin") || path === "/login" || path === "/reset-password";
  return <div className={`route-loading${light ? " route-loading-light" : ""}`} role="status">Đang tải giao diện...</div>;
}

/**
 * Unknown address (404), or a chunk that fails to download (offline, or an old tab after a new
 * deploy): never a blank page, always a way out.
 */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="route-loading route-loading-light route-error" role="alert">
        <p><strong>Không tìm thấy trang</strong></p>
        <p>Địa chỉ này không tồn tại hoặc đã được đổi.</p>
        <a className="route-error-reload" href="/">Về trang chủ</a>
      </div>
    );
  }
  const chunk = error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message);
  return (
    <div className="route-loading route-loading-light route-error" role="alert">
      <p>{chunk ? "Không tải được trang. Kiểm tra kết nối mạng rồi tải lại." : "Đã có lỗi khi hiển thị trang."}</p>
      <button type="button" className="route-error-reload" onClick={() => window.location.reload()}>Tải lại trang</button>
    </div>
  );
}
