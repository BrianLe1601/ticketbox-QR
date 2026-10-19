export const adminFonts = {
  system: { label: "Hệ thống", family: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  arial: { label: "Arial", family: 'Arial, "Helvetica Neue", sans-serif' },
  serif: { label: "Georgia", family: 'Georgia, "Times New Roman", serif' },
} as const;

export const adminFontSizes = { small: 14, default: 15, large: 17 } as const;
export type AdminAppearance = { font: keyof typeof adminFonts; size: keyof typeof adminFontSizes };
export const defaultAdminAppearance: AdminAppearance = { font: "system", size: "default" };

export function readAdminAppearance(accountId: number): AdminAppearance {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(`ticketbox:admin-appearance:${accountId}`) ?? "null");
    if (stored && typeof stored === "object" && "font" in stored && "size" in stored
      && typeof stored.font === "string" && Object.hasOwn(adminFonts, stored.font)
      && typeof stored.size === "string" && Object.hasOwn(adminFontSizes, stored.size)) {
      return stored as AdminAppearance;
    }
  } catch { /* Blocked storage or corrupt preferences must not prevent login. */ }
  return { ...defaultAdminAppearance };
}

export function writeAdminAppearance(accountId: number, appearance: AdminAppearance): boolean {
  try {
    localStorage.setItem(`ticketbox:admin-appearance:${accountId}`, JSON.stringify(appearance));
    return true;
  } catch { return false; }
}
