import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export type CategoryKind = "music" | "other";
export interface AdminCategory {
  id:number;name:string;slug:string;description:string|null;icon:string|null;kind:CategoryKind;isActive:boolean;sortOrder:number;eventCount:number;
  /** Server decision: active and inside the Admin-selected scope for NEW Events. */
  selectableForNewEvent:boolean;
}
export interface CategoryPayload { name:string;slug:string;description:string|null;icon:string|null;kind:CategoryKind;isActive:boolean;sortOrder:number }
const auth=()=>getStoredToken();
export async function listAdminCategories(includeInactive=true){return (await apiRequest<AdminCategory[]>(`/admin/categories?includeInactive=${includeInactive}`,{},auth())).data;}
export async function createAdminCategory(body:CategoryPayload){return (await apiRequest<AdminCategory>("/admin/categories",{method:"POST",body:JSON.stringify(body)},auth())).data;}
export async function updateAdminCategory(id:number,body:Partial<CategoryPayload>){return (await apiRequest<AdminCategory>(`/admin/categories/${id}`,{method:"PATCH",body:JSON.stringify(body)},auth())).data;}
export async function deleteAdminCategory(id:number){await apiRequest<void>(`/admin/categories/${id}`,{method:"DELETE"},auth());}
