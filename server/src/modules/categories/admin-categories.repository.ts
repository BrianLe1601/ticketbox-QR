import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { AppError } from "../../utils/app-error.js";
import { hasPlatformSchema } from "../platform-settings/platform-settings.repository.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./admin-categories.schema.js";

export interface CategoryRow extends RowDataPacket {
  id: number; name: string; slug: string; description: string | null; icon: string | null;
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
export async function findCategoryConflict(name: string | undefined, slug: string | undefined, excludeId?: number) {
  const conditions: string[] = []; const params: unknown[] = [];
  if (name) { conditions.push("LOWER(name)=LOWER(?)"); params.push(name); }
  if (slug) { conditions.push("slug=?"); params.push(slug); }
  if (!conditions.length) return null;
  if (excludeId) { params.push(excludeId); }
  const [rows] = await pool.query<CategoryRow[]>(`SELECT ${await select()} FROM categories c WHERE (${conditions.join(" OR ")})${excludeId ? " AND c.id<>?" : ""} LIMIT 1`, params);
  return rows[0] ?? null;
}
function requireKindSupport(kind: string | undefined, supported: boolean) {
  if (supported || kind === undefined || kind === "other") return;
  throw new AppError(503, "Database chưa có cột phân loại danh mục; chạy lại schema trên database thử nghiệm", "PLATFORM_SCHEMA_UPGRADE_REQUIRED");
}
export async function insertCategory(input: CreateCategoryInput) {
  const supported = await hasPlatformSchema();
  requireKindSupport(input.kind, supported);
  const [result] = supported
    ? await pool.execute<ResultSetHeader>("INSERT INTO categories(name,slug,description,icon,kind,is_active,sort_order) VALUES (?,?,?,?,?,?,?)", [input.name,input.slug,input.description ?? null,input.icon ?? null,input.kind,input.isActive,input.sortOrder])
    : await pool.execute<ResultSetHeader>("INSERT INTO categories(name,slug,description,icon,is_active,sort_order) VALUES (?,?,?,?,?,?)", [input.name,input.slug,input.description ?? null,input.icon ?? null,input.isActive,input.sortOrder]);
  return result.insertId;
}
export async function updateCategoryRecord(id: number, input: UpdateCategoryInput) {
  requireKindSupport(input.kind, await hasPlatformSchema());
  const mapping: Record<string, string> = { name:"name",slug:"slug",description:"description",icon:"icon",kind:"kind",isActive:"is_active",sortOrder:"sort_order" };
  const sets: string[] = []; const params: unknown[] = [];
  for (const [key, value] of Object.entries(input)) if (value !== undefined) { sets.push(`${mapping[key]}=?`); params.push(value); }
  if (sets.length) await pool.query(`UPDATE categories SET ${sets.join(",")} WHERE id=?`, [...params,id]);
}
export async function deleteCategoryRecord(id: number) {
  const [result] = await pool.execute<ResultSetHeader>("DELETE FROM categories WHERE id=?", [id]);
  return result.affectedRows === 1;
}
