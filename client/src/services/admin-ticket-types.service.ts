import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export interface AdminTicketType {id:number;eventId:number;name:string;description:string|null;price:number;capacity:number;reservedQuantity:number;soldQuantity:number;availableQuantity:number;maxPerOrder:number;salesStartAt:string|null;salesEndAt:string|null;isActive:boolean;createdAt:string;updatedAt:string}
export interface TicketTypePayload {eventId:number;name:string;description:string|null;price:number;capacity:number;maxPerOrder:number;salesStartAt:string|null;salesEndAt:string|null;isActive:boolean}
const auth=()=>getStoredToken();
export async function listAdminTicketTypes(eventId:number){return (await apiRequest<AdminTicketType[]>(`/admin/ticket-types?eventId=${eventId}`,{},auth())).data;}
export async function createAdminTicketType(body:TicketTypePayload){return (await apiRequest<AdminTicketType>("/admin/ticket-types",{method:"POST",body:JSON.stringify(body)},auth())).data;}
export async function updateAdminTicketType(id:number,body:Partial<Omit<TicketTypePayload,"eventId">>){return (await apiRequest<AdminTicketType>(`/admin/ticket-types/${id}`,{method:"PATCH",body:JSON.stringify(body)},auth())).data;}
export async function setAdminTicketSalesStatus(id:number,active:boolean){return (await apiRequest<AdminTicketType>(`/admin/ticket-types/${id}/sales-status`,{method:"PATCH",body:JSON.stringify({active})},auth())).data;}
export async function deleteAdminTicketType(id:number){await apiRequest<void>(`/admin/ticket-types/${id}`,{method:"DELETE"},auth());}
