import { AppError } from "../../utils/app-error.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./admin-categories.schema.js";
import { deleteCategoryRecord, findCategory, findCategoryConflict, insertCategory, listCategories, updateCategoryRecord, type CategoryRow } from "./admin-categories.repository.js";

function map(row: CategoryRow) { return { id:row.id,name:row.name,slug:row.slug,description:row.description,icon:row.icon,isActive:Boolean(row.is_active),sortOrder:row.sort_order,eventCount:Number(row.event_count) }; }
export async function getCategories(includeInactive=false) { return (await listCategories(includeInactive)).map(map); }
export async function getCategory(id:number) { const row=await findCategory(id); if(!row) throw AppError.notFound("Category not found","CATEGORY_NOT_FOUND"); return map(row); }
export async function createCategory(input:CreateCategoryInput) {
  if(await findCategoryConflict(input.name,input.slug)) throw new AppError(409,"Category name or slug already exists","CATEGORY_CONFLICT");
  return getCategory(await insertCategory(input));
}
export async function updateCategory(id:number,input:UpdateCategoryInput) {
  const current=await getCategory(id);
  if(await findCategoryConflict(input.name,input.slug,id)) throw new AppError(409,"Category name or slug already exists","CATEGORY_CONFLICT");
  if(input.slug!==undefined&&input.slug!==current.slug&&current.eventCount>0) throw new AppError(409,"A Category slug referenced by Events cannot be changed","CATEGORY_SLUG_IN_USE");
  await updateCategoryRecord(id,input); return getCategory(id);
}
export async function removeCategory(id:number) {
  const current=await getCategory(id);
  if(current.eventCount>0) throw new AppError(409,"This Category is used by Events. Deactivate it instead.","CATEGORY_IN_USE");
  if(!await deleteCategoryRecord(id)) throw AppError.notFound("Category not found","CATEGORY_NOT_FOUND");
}
