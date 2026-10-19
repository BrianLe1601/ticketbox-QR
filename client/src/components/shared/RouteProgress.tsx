import { useEffect, useState } from "react";
import { useNavigation } from "react-router-dom";

/**
 * Thin progress bar while the router loads the next page's code (data router + route `lazy`).
 * Shown only after 150 ms, so a preloaded page switches without a flicker; rendered by the Admin,
 * Staff and Login shells only (inside their token scope), never on Public pages.
 */
export function RouteProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setShown(true), 150);
    return () => { window.clearTimeout(timer); setShown(false); };
  }, [busy]);

  if (!busy || !shown) return null;
  return (
    <div className="tb-route-progress" role="progressbar" aria-label="Đang chuyển trang" aria-busy="true">
      <span />
    </div>
  );
}
