import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export interface AdminCategory {
  id:number;name:string;slug:string;description:string|null;icon:string|null;isActive:boolean;sortOrder:number;eventCount:number;
  /** Genre of the fixed TicketBox catalogue; false = legacy Category kept for old Events. */
  catalog:boolean;
  /** Server decision: a switched-on catalogue genre, usable for NEW Events. */
  selectableForNewEvent:boolean;
}
/** The catalogue is fixed: an Admin only switches a genre on/off and reorders it. */
export interface CategoryUpdate { isActive?:boolean; sortOrder?:number }
const auth=()=>getStoredToken();
export async function listAdminCategories(includeInactive=true){return (await apiRequest<AdminCategory[]>(`/admin/categories?includeInactive=${includeInactive}`,{},auth())).data;}
export async function updateAdminCategory(id:number,body:CategoryUpdate){return (await apiRequest<AdminCategory>(`/admin/categories/${id}`,{method:"PATCH",body:JSON.stringify(body)},auth())).data;}
