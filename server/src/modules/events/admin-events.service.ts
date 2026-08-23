import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import type { AdminEventListInput, CreateAdminEventInput, UpdateAdminEventInput } from "./admin-events.schema.js";
import { deleteDraftEvent, findAdminEvent, insertAdminEvent, listAdminEvents, setEventCancelled, setEventPublished, setPublishSchedule, updateAdminEventRecord } from "./admin-events.repository.js";

function slugify(name:string){
  const base=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180)||"event";
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

function validateTimes(input:CreateAdminEventInput|UpdateAdminEventInput){
  if(input.startTime&&input.endTime&&new Date(input.endTime)<=new Date(input.startTime))throw AppError.badRequest("Event end time must be after start time","INVALID_EVENT_TIME");
  if(input.salesStartAt&&input.salesEndAt&&new Date(input.salesEndAt)<=new Date(input.salesStartAt))throw AppError.badRequest("Sales end time must be after sales start time","INVALID_SALES_TIME");
  if(input.salesEndAt&&input.startTime&&new Date(input.salesEndAt)>new Date(input.startTime))throw AppError.badRequest("Sales cannot end after the event starts","SALES_AFTER_EVENT_START");
  if(input.checkinStartAt&&input.checkinEndAt&&new Date(input.checkinEndAt)<=new Date(input.checkinStartAt))throw AppError.badRequest("Check-in end time must be after check-in start time","INVALID_CHECKIN_TIME");
  if(input.scheduledPublishAt&&input.startTime&&new Date(input.scheduledPublishAt)>=new Date(input.startTime))throw AppError.badRequest("Scheduled publishing must occur before event start","INVALID_PUBLISH_SCHEDULE");
}

function map(row:NonNullable<Awaited<ReturnType<typeof findAdminEvent>>>) {
  const readiness=getReadiness(row);
  return {id:row.id,name:row.name,slug:row.slug,description:row.description,category:row.category,venue:row.venue,address:row.address,city:row.city,venueCapacity:row.venue_capacity,coverImageUrl:row.cover_image_url,startTime:row.start_time,endTime:row.end_time,salesStartAt:row.sales_start_at,salesEndAt:row.sales_end_at,checkinStartAt:row.checkin_start_at,checkinEndAt:row.checkin_end_at,status:row.status,scheduledPublishAt:row.scheduled_publish_at,publishedAt:row.published_at,cancelledAt:row.cancelled_at,cancellationReason:row.cancellation_reason,completedAt:row.completed_at,publishFailureReason:row.publish_failure_reason,ticketTypeCount:Number(row.ticket_type_count),validTicketTypeCount:Number(row.valid_ticket_type_count),allocatedCapacity:Number(row.allocated_capacity),soldQuantity:Number(row.sold_quantity),readiness};
}

function getReadiness(row:NonNullable<Awaited<ReturnType<typeof findAdminEvent>>>) {
  const missing:string[]=[];
  if(!row.name.trim())missing.push("EVENT_NAME_REQUIRED");
  if(!row.venue.trim()||!row.address.trim()||!row.city.trim())missing.push("COMPLETE_LOCATION_REQUIRED");
  if(!row.cover_image_url)missing.push("COVER_IMAGE_REQUIRED");
  if(!row.venue_capacity||row.venue_capacity<=0)missing.push("VENUE_CAPACITY_REQUIRED");
  if(row.end_time<=row.start_time)missing.push("INVALID_EVENT_TIME");
  if(row.start_time<=new Date())missing.push("EVENT_START_MUST_BE_FUTURE");
  if(row.sales_end_at&&row.sales_end_at>row.start_time)missing.push("SALES_END_AFTER_EVENT_START");
  if(Number(row.valid_ticket_type_count)<1)missing.push("VALID_TICKET_TYPE_REQUIRED");
  if(row.venue_capacity&&Number(row.allocated_capacity)>row.venue_capacity)missing.push("TICKET_CAPACITY_EXCEEDS_VENUE");
  return {ready:missing.length===0,missing};
}

export async function getAdminEventList(input:AdminEventListInput){const {rows,total}=await listAdminEvents(input);return {items:rows.map(map),meta:{total,page:input.page,limit:input.limit}};}
export async function getAdminEventById(id:number){const row=await findAdminEvent(id);if(!row)throw AppError.notFound("Event not found","EVENT_NOT_FOUND");return map(row);}
export async function createAdminEvent(input:CreateAdminEventInput,adminId:number){validateTimes(input);const id=await insertAdminEvent(input,slugify(input.name),adminId);return getAdminEventById(id);}
export async function updateAdminEvent(id:number,input:UpdateAdminEventInput){const current=await getAdminEventById(id);if(current.status!=="draft")throw new AppError(409,"Only draft events can be edited","EVENT_NOT_EDITABLE");validateTimes({...input,startTime:input.startTime??new Date(current.startTime).toISOString(),endTime:input.endTime??new Date(current.endTime).toISOString(),salesStartAt:input.salesStartAt===undefined?(current.salesStartAt?new Date(current.salesStartAt).toISOString():null):input.salesStartAt,salesEndAt:input.salesEndAt===undefined?(current.salesEndAt?new Date(current.salesEndAt).toISOString():null):input.salesEndAt});await updateAdminEventRecord(id,input);return getAdminEventById(id);}
export async function getPublishReadiness(id:number){return (await getAdminEventById(id)).readiness;}
export async function publishAdminEvent(id:number){const event=await getAdminEventById(id);if(event.status!=="draft")throw new AppError(409,"Only draft events can be published","EVENT_NOT_DRAFT");if(!event.readiness.ready)throw new AppError(409,`Event is missing publish requirements: ${event.readiness.missing.join(", ")}`,"EVENT_NOT_READY");await setEventPublished(id);return getAdminEventById(id);}
export async function scheduleAdminEvent(id:number,value:string|null){const event=await getAdminEventById(id);if(event.status!=="draft")throw new AppError(409,"Only draft events can be scheduled","EVENT_NOT_DRAFT");if(value&&(new Date(value)<=new Date()||new Date(value)>=new Date(event.startTime)))throw AppError.badRequest("Publish schedule must be in the future and before event start","INVALID_PUBLISH_SCHEDULE");await setPublishSchedule(id,value);return getAdminEventById(id);}
export async function cancelAdminEvent(id:number,reason:string){const event=await getAdminEventById(id);if(["completed","cancelled"].includes(event.status))throw new AppError(409,"Completed or cancelled events cannot be cancelled again","EVENT_NOT_CANCELLABLE");await setEventCancelled(id,reason);return getAdminEventById(id);}
export async function removeAdminEvent(id:number){const event=await getAdminEventById(id);if(event.status!=="draft"||event.soldQuantity>0)throw new AppError(409,"Only an unsold draft event can be permanently deleted","EVENT_NOT_DELETABLE");if(!await deleteDraftEvent(id))throw new AppError(409,"Event has related orders and cannot be deleted","EVENT_HAS_ORDERS");}
