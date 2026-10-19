/** Formatting shared by every Admin page: Vietnamese locale, Asia/Ho_Chi_Minh time. */
export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** 1500000 -> "1.500.000 ₫". Intl puts a no-break space before the sign; a normal space is used instead. */
export function formatMoney(value: number | null | undefined): string {
  return money.format(Number(value ?? 0)).replace(/\s/g, " ");
}

/** Axis/compact form with one consistent unit family: "850 N ₫", "36 Tr ₫", "1,2 Tỷ ₫". */
export function formatMoneyCompact(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${decimal.format(abs / 1e9)} Tỷ ₫`;
  if (abs >= 1e6) return `${sign}${decimal.format(abs / 1e6)} Tr ₫`;
  if (abs >= 1e3) return `${sign}${decimal.format(abs / 1e3)} N ₫`;
  return `${sign}${integer.format(abs)} ₫`;
}

export function formatNumber(value: number | null | undefined): string {
  return integer.format(Number(value ?? 0));
}

/** 0.4567 or 45.67 (percent already) -> "45,7%". Pass `isRatio` for 0..1 inputs. */
export function formatPercent(value: number | null | undefined, isRatio = false): string {
  const n = Number(value ?? 0) * (isRatio ? 100 : 1);
  return `${decimal.format(n)}%`;
}

function parts(iso: string | Date, options: Intl.DateTimeFormatOptions) {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TIME_ZONE, ...options }).format(date);
}

/** "17/10/2026 19:30" */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  // vi-VN puts the time first ("19:30 17/10/2026"); Admin tables read date first.
  const date = formatDate(iso);
  return date ? `${date} ${formatTime(iso)}` : "";
}

/** "17/10/2026" */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  return parts(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "19:30" or, with seconds, "19:30:05" */
export function formatTime(iso: string | Date | null | undefined, withSeconds = false): string {
  if (!iso) return "";
  return parts(iso, { hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}), hour12: false });
}

/**
 * Initials for avatars. Non-letters are dropped first, so "[DEMO] 1 Nguyễn Văn An" gives "NA"
 * instead of "[1" / "[0". Vietnamese letters (with diacritics) count as letters.
 */
export function initials(name: string | null | undefined, fallback = "?"): string {
  const words = String(name ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("vi-VN");
  return (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase("vi-VN");
}

/** Vietnamese plural-free count label: (3, "đơn") -> "3 đơn". */
export function countLabel(count: number, noun: string): string {
  return `${formatNumber(count)} ${noun}`;
}
