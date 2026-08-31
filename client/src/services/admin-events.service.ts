import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export type EventStatus = "draft" | "published" | "ongoing" | "completed" | "cancelled";
export interface PublishReadiness { ready:boolean; missing:string[] }
export interface AdminEvent {
  id:number; name:string; description:string|null; category:string; venue:string; address:string; city:string;
  venueCapacity:number; coverImageUrl:string|null; coverImagePublicId:string|null; coverImageAlt:string|null; startTime:string; endTime:string; salesStartAt:string;
  salesEndAt:string; checkinStartAt:string; checkinEndAt:string; status:EventStatus;
  visibility:"visible"|"hidden"; hiddenAt:string|null; hiddenReason:string|null;
  scheduledPublishAt:string|null; ticketTypeCount:number; validTicketTypeCount:number; allocatedCapacity:number;
  soldQuantity:number; pendingOrderCount:number; confirmedOrderCount:number; readiness:PublishReadiness;
}
export interface EventPayload {
  name:string; description:string|null; category:"music"|"conference"|"food"|"sports"|"art";
  venue:string; address:string; city:string; venueCapacity:number; coverImageUrl:string|null;
  coverImagePublicId:string|null; coverImageAlt:string|null;
  startTime:string; endTime:string; salesStartAt:string; salesEndAt:string;
  checkinStartAt:string; checkinEndAt:string; scheduledPublishAt:string|null;
}

const auth=()=>getStoredToken();
export async function listAdminEvents(){return apiRequest<AdminEvent[]>("/admin/events?limit=50",{},auth());}
export async function getAdminEvent(id:number){return (await apiRequest<AdminEvent>(`/admin/events/${id}`,{},auth())).data;}
export async function createAdminEvent(body:EventPayload){return (await apiRequest<AdminEvent>("/admin/events",{method:"POST",body:JSON.stringify(body)},auth())).data;}
export async function updateAdminEvent(id:number,body:EventPayload){return (await apiRequest<AdminEvent>(`/admin/events/${id}`,{method:"PATCH",body:JSON.stringify(body)},auth())).data;}
export async function getPublishReadiness(id:number){return (await apiRequest<PublishReadiness>(`/admin/events/${id}/publish-readiness`,{},auth())).data;}
export async function publishAdminEvent(id:number){return (await apiRequest<AdminEvent>(`/admin/events/${id}/publish`,{method:"POST"},auth())).data;}
export async function scheduleAdminEvent(id:number,scheduledPublishAt:string|null){return (await apiRequest<AdminEvent>(`/admin/events/${id}/publish-schedule`,{method:"PATCH",body:JSON.stringify({scheduledPublishAt})},auth())).data;}
export async function cancelAdminEvent(id:number,reason:string){return (await apiRequest<AdminEvent>(`/admin/events/${id}/cancel`,{method:"POST",body:JSON.stringify({reason})},auth())).data;}
export async function deleteAdminEvent(id:number){await apiRequest<void>(`/admin/events/${id}`,{method:"DELETE"},auth());}
export async function setAdminEventVisibility(id:number,visible:boolean,reason?:string){return (await apiRequest<AdminEvent>(`/admin/events/${id}/visibility`,{method:"PATCH",body:JSON.stringify(visible?{visible:true}:{visible:false,reason})},auth())).data;}
