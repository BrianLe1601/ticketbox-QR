import { AppError } from "../../utils/app-error.js";
import {
  assertPlatformSchema,
  countOutOfSyncEvents,
  readSettings,
  transaction,
  lockSettings,
  writeVenue,
  type PlatformSettingsRow,
} from "./platform-settings.repository.js";
import type { VenueInput } from "./platform-settings.schema.js";

export interface VenueSnapshot {
  name: string;
  address: string;
  city: string;
  capacity: number;
}

export function venueOf(row: PlatformSettingsRow): VenueSnapshot | null {
  if (!row.venue_name || !row.venue_address || !row.venue_city || !row.venue_capacity) return null;
  return {
    name: row.venue_name,
    address: row.venue_address,
    city: row.venue_city,
    capacity: Number(row.venue_capacity),
  };
}

/** The venue every new Event copies; absent until an Admin configures it. */
export function requireVenue(row: PlatformSettingsRow): VenueSnapshot {
  const venue = venueOf(row);
  if (!venue) {
    throw new AppError(
      409,
      "Chưa cấu hình địa điểm tổ chức. Vào Cài đặt để nhập địa điểm trước khi tạo sự kiện.",
      "VENUE_NOT_CONFIGURED",
    );
  }
  return venue;
}

export async function getPlatformSettings() {
  await assertPlatformSchema();
  const [row, outOfSyncEventCount] = await Promise.all([readSettings(), countOutOfSyncEvents()]);
  return {
    venue: venueOf(row),
    outOfSyncEventCount,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by === null ? null : { id: row.updated_by, fullName: row.updated_by_name },
  };
}

export async function saveVenue(adminId: number, input: VenueInput) {
  await assertPlatformSchema();
  await transaction(async (conn) => {
    await lockSettings(conn);
    await writeVenue(conn, adminId, input);
  });
  return getPlatformSettings();
}
