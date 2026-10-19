import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface SeedVenue {
  name: string;
  address: string;
  city: string;
  capacity: number;
}

interface VenueRow extends RowDataPacket {
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_capacity: number | null;
}

/**
 * Seeds copy the single platform venue into each Event, exactly like Admin create.
 * A venue an Admin already configured is never overwritten; the placeholder below
 * is written only into an empty configuration so a fresh disposable database works.
 */
export async function resolveSeedVenue(
  connection: PoolConnection,
  adminId: number,
  placeholder: SeedVenue,
  requiredCapacity: number,
): Promise<SeedVenue> {
  const [rows] = await connection.query<VenueRow[]>(
    `SELECT venue_name, venue_address, venue_city, venue_capacity
       FROM platform_settings WHERE id = 1 FOR UPDATE`,
  );
  const row = rows[0];
  if (!row) throw new Error("platform_settings row is missing; re-run the current schema on a disposable database");

  if (row.venue_name && row.venue_address && row.venue_city && row.venue_capacity) {
    if (Number(row.venue_capacity) < requiredCapacity) {
      throw new Error(
        `Configured venue capacity (${row.venue_capacity}) is below the ${requiredCapacity} seats these fixtures need; `
        + "raise it in Admin Settings or seed a disposable database.",
      );
    }
    return {
      name: row.venue_name,
      address: row.venue_address,
      city: row.venue_city,
      capacity: Number(row.venue_capacity),
    };
  }

  await connection.query(
    `UPDATE platform_settings SET venue_name = ?, venue_address = ?, venue_city = ?,
       venue_capacity = ?, updated_by = ? WHERE id = 1`,
    [placeholder.name, placeholder.address, placeholder.city, placeholder.capacity, adminId],
  );
  return placeholder;
}

/** The deployment has one venue, so two seed sets with a live "ongoing" Event cannot share a database. */
export function explainVenueConflict(error: unknown, seedName: string): unknown {
  const message = (error as { sqlMessage?: string } | null)?.sqlMessage ?? "";
  if (!message.includes("Venue schedule conflicts")) return error;
  return new Error(
    `${seedName}: the single venue is already booked for part of this schedule. `
    + "seed:admin-demo and seed:workflows both create an Event that is ongoing now, so run one of them per "
    + "disposable database or remove the other set's Events first.",
    { cause: error },
  );
}
