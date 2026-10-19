import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export type CategoryScope = "music_only" | "all";
export interface VenueSettings { name: string; address: string; city: string; capacity: number }
export interface PlatformSettings {
  venue: VenueSettings | null;
  categoryScope: CategoryScope;
  /** Draft/published Events whose venue snapshot differs from the current venue. */
  outOfSyncEventCount: number;
  updatedAt: string | null;
  updatedBy: { id: number; fullName: string | null } | null;
}

const auth = () => getStoredToken();
export async function getPlatformSettings() {
  return (await apiRequest<PlatformSettings>("/admin/platform-settings", {}, auth())).data;
}
export async function saveVenueSettings(venue: VenueSettings) {
  return (await apiRequest<PlatformSettings>("/admin/platform-settings/venue", { method: "PUT", body: JSON.stringify(venue) }, auth())).data;
}
export async function saveCategoryScope(scope: CategoryScope) {
  return (await apiRequest<PlatformSettings>("/admin/platform-settings/category-scope", { method: "PUT", body: JSON.stringify({ scope }) }, auth())).data;
}
