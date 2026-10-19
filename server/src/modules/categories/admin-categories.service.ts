import { AppError } from "../../utils/app-error.js";
import type { UpdateCategoryInput } from "./admin-categories.schema.js";
import { findCategory, listCategories, updateCategoryRecord, type CategoryRow } from "./admin-categories.repository.js";

/** A catalogue genre (kind 'music') that is switched on; legacy Categories never qualify. */
export function isSelectableForNewEvent(row: Pick<CategoryRow, "is_active" | "kind">) {
  return Boolean(row.is_active) && row.kind === "music";
}

/** The catalogue is installed by the schema; Admins cannot add or remove Categories. */
export function catalogFixedError() {
  return new AppError(409, "Danh sách thể loại nhạc là cố định; chỉ bật/tắt và sắp xếp được", "CATEGORY_CATALOG_FIXED");
}

// Public shape (pages filter by slug). `genre` (additive) tells a catalogue music genre from a
// non-catalogue row, so the Home page lists genres only.
function map(row: CategoryRow) { return { id:row.id,name:row.name,slug:row.slug,description:row.description,icon:row.icon,isActive:Boolean(row.is_active),sortOrder:row.sort_order,eventCount:Number(row.event_count),genre:row.kind === "music" }; }
function mapAdmin(row: CategoryRow) { return { ...map(row), catalog: row.kind === "music", selectableForNewEvent: isSelectableForNewEvent(row) }; }

export async function getCategories(includeInactive=false) { return (await listCategories(includeInactive)).map(map); }
export async function getAdminCategories(includeInactive=false) { return (await listCategories(includeInactive)).map(mapAdmin); }

export async function updateCategory(id:number,input:UpdateCategoryInput) {
  const row=await findCategory(id);
  if(!row) throw AppError.notFound("Category not found","CATEGORY_NOT_FOUND");
  // Legacy Categories stay for the history of their Events: they may be switched off, never back on.
  if(input.isActive===true&&row.kind!=="music"&&!row.is_active) throw new AppError(409,"Danh mục cũ không bật lại được; hãy dùng một thể loại nhạc","CATEGORY_LEGACY_READ_ONLY");
  await updateCategoryRecord(id,input);
  const saved=await findCategory(id);
  if(!saved) throw AppError.notFound("Category not found","CATEGORY_NOT_FOUND");
  return mapAdmin(saved);
}
