import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export type EventStatus = "draft" | "published" | "ongoing" | "completed" | "cancelled";
export interface PublishReadiness { ready:boolean; missing:string[] }
export interface AdminEvent {
  id:number; name:string; description:string|null; categoryId:number; category:string; venue:string; address:string; city:string;
  venueCapacity:number; coverImageUrl:string|null; coverImagePublicId:string|null; coverImageAlt:string|null; startTime:string; endTime:string; salesStartAt:string;
  salesEndAt:string; checkinStartAt:string; checkinEndAt:string; status:EventStatus;
  visibility:"visible"|"hidden"; hiddenAt:string|null; hiddenReason:string|null;
  scheduledPublishAt:string|null; ticketTypeCount:number; validTicketTypeCount:number; allocatedCapacity:number;
  soldQuantity:number; pendingOrderCount:number; confirmedOrderCount:number; activeStaffCount:number; readiness:PublishReadiness;
}
export interface EventPayload {
  name:string; description:string|null; category:string;
  venue:string; address:string; city:string; venueCapacity:number; coverImageUrl:string|null;
  coverImagePublicId:string|null; coverImageAlt:string|null;
  startTime:string; endTime:string; salesStartAt:string; salesEndAt:string;
  checkinStartAt:string; checkinEndAt:string; scheduledPublishAt:string|null;
}

const auth=()=>getStoredToken();
export async function listAdminEvents(){
  const limit=50;
  const first=await apiRequest<AdminEvent[]>(`/admin/events?page=1&limit=${limit}`,{},auth());
  const total=first.meta?.total??first.data.length;
  const data=[...first.data];
  for(let page=2;page<=Math.ceil(total/limit);page+=1){
    const response=await apiRequest<AdminEvent[]>(`/admin/events?page=${page}&limit=${limit}`,{},auth());
    data.push(...response.data);
  }
  return {data,meta:{total:data.length,page:1,limit:Math.max(1,data.length)}};
}
export async function getAdminEvent(id:number){return (await apiRequest<AdminEvent>(`/admin/events/${id}`,{},auth())).data;}
export async function createAdminEvent(body:EventPayload){return (await apiRequest<AdminEvent>("/admin/events",{method:"POST",body:JSON.stringify(body)},auth())).data;}
export async function updateAdminEvent(id:number,body:EventPayload){return (await apiRequest<AdminEvent>(`/admin/events/${id}`,{method:"PATCH",body:JSON.stringify(body)},auth())).data;}
export async function getPublishReadiness(id:number){return (await apiRequest<PublishReadiness>(`/admin/events/${id}/publish-readiness`,{},auth())).data;}
export async function publishAdminEvent(id:number){return (await apiRequest<AdminEvent>(`/admin/events/${id}/publish`,{method:"POST"},auth())).data;}
export async function scheduleAdminEvent(id:number,scheduledPublishAt:string|null){return (await apiRequest<AdminEvent>(`/admin/events/${id}/publish-schedule`,{method:"PATCH",body:JSON.stringify({scheduledPublishAt})},auth())).data;}
export async function cancelAdminEvent(id:number,reason:string){return (await apiRequest<AdminEvent>(`/admin/events/${id}/cancel`,{method:"POST",body:JSON.stringify({reason})},auth())).data;}
export async function deleteAdminEvent(id:number){await apiRequest<void>(`/admin/events/${id}`,{method:"DELETE"},auth());}
export async function setAdminEventVisibility(id:number,visible:boolean,reason?:string){return (await apiRequest<AdminEvent>(`/admin/events/${id}/visibility`,{method:"PATCH",body:JSON.stringify(visible?{visible:true}:{visible:false,reason})},auth())).data;}
