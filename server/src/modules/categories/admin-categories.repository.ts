import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { hasPlatformSchema } from "../platform-settings/platform-settings.repository.js";
import type { UpdateCategoryInput } from "./admin-categories.schema.js";

export interface CategoryRow extends RowDataPacket {
  id: number; name: string; slug: string; description: string | null; icon: string | null;
  /** 'music' = genre of the fixed catalogue (installed by the schema); 'other' = legacy history. */
  kind: "music" | "other"; is_active: number; sort_order: number; event_count: number;
}

// Databases created before categories.kind existed keep working: every Category
// reads as 'other' until the schema is re-installed (see PLATFORM_SCHEMA_UPGRADE_REQUIRED).
async function select() {
  const kind = await hasPlatformSchema() ? "c.kind" : "'other'";
  return `c.id,c.name,c.slug,c.description,c.icon,${kind} kind,c.is_active,c.sort_order,
  (SELECT COUNT(*) FROM events e WHERE e.category_id=c.id) event_count`;
}

export async function listCategories(includeInactive: boolean) {
  const [rows] = await pool.query<CategoryRow[]>(`SELECT ${await select()} FROM categories c ${includeInactive ? "" : "WHERE c.is_active=TRUE"} ORDER BY c.sort_order,c.name`);
  return rows;
}
export async function findCategory(id: number) {
  const [rows] = await pool.query<CategoryRow[]>(`SELECT ${await select()} FROM categories c WHERE c.id=? LIMIT 1`, [id]);
  return rows[0] ?? null;
}
export async function findCategoryBySlug(slug: string) {
  const [rows] = await pool.query<CategoryRow[]>(`SELECT ${await select()} FROM categories c WHERE c.slug=? LIMIT 1`, [slug]);
  return rows[0] ?? null;
}
/** Only the two Admin-editable columns; the catalogue itself is never written here. */
export async function updateCategoryRecord(id: number, input: UpdateCategoryInput) {
  const sets: string[] = []; const params: unknown[] = [];
  if (input.isActive !== undefined) { sets.push("is_active=?"); params.push(input.isActive); }
  if (input.sortOrder !== undefined) { sets.push("sort_order=?"); params.push(input.sortOrder); }
  if (sets.length) await pool.query(`UPDATE categories SET ${sets.join(",")} WHERE id=?`, [...params, id]);
}
