import { AppError } from "../../utils/app-error.js";
import { hasPlatformSchema, readSettings, type CategoryScope } from "../platform-settings/platform-settings.repository.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./admin-categories.schema.js";
import { deleteCategoryRecord, findCategory, findCategoryConflict, insertCategory, listCategories, updateCategoryRecord, type CategoryRow } from "./admin-categories.repository.js";

/** A Category can be chosen for a NEW Event when it is active and inside the Admin-selected scope. */
export function isSelectableForNewEvent(row: Pick<CategoryRow, "is_active" | "kind">, scope: CategoryScope) {
  return Boolean(row.is_active) && (scope === "all" || row.kind === "music");
}

// Public shape (Ticket pages filter by slug): unchanged by the Admin-only kind/scope fields.
function map(row: CategoryRow) { return { id:row.id,name:row.name,slug:row.slug,description:row.description,icon:row.icon,isActive:Boolean(row.is_active),sortOrder:row.sort_order,eventCount:Number(row.event_count) }; }
function mapAdmin(row: CategoryRow, scope: CategoryScope) { return { ...map(row), kind: row.kind, selectableForNewEvent: isSelectableForNewEvent(row, scope) }; }
async function currentScope(): Promise<CategoryScope> { return await hasPlatformSchema() ? (await readSettings()).category_scope : "all"; }

export async function getCategories(includeInactive=false) { return (await listCategories(includeInactive)).map(map); }
export async function getAdminCategories(includeInactive=false) { const scope=await currentScope(); return (await listCategories(includeInactive)).map((row)=>mapAdmin(row,scope)); }
async function getAdminCategory(id:number) { const row=await findCategory(id); if(!row) throw AppError.notFound("Category not found","CATEGORY_NOT_FOUND"); return mapAdmin(row,await currentScope()); }
export async function createCategory(input:CreateCategoryInput) {
  if(await findCategoryConflict(input.name,input.slug)) throw new AppError(409,"Category name or slug already exists","CATEGORY_CONFLICT");
  return getAdminCategory(await insertCategory(input));
}
export async function updateCategory(id:number,input:UpdateCategoryInput) {
  const current=await getAdminCategory(id);
  if(await findCategoryConflict(input.name,input.slug,id)) throw new AppError(409,"Category name or slug already exists","CATEGORY_CONFLICT");
  if(input.slug!==undefined&&input.slug!==current.slug&&current.eventCount>0) throw new AppError(409,"A Category slug referenced by Events cannot be changed","CATEGORY_SLUG_IN_USE");
  await updateCategoryRecord(id,input); return getAdminCategory(id);
}
export async function removeCategory(id:number) {
  const current=await getAdminCategory(id);
  if(current.eventCount>0) throw new AppError(409,"This Category is used by Events. Deactivate it instead.","CATEGORY_IN_USE");
  if(!await deleteCategoryRecord(id)) throw AppError.notFound("Category not found","CATEGORY_NOT_FOUND");
}
