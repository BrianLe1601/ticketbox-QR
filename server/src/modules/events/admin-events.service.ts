import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import type { AdminEventListInput, CreateAdminEventInput, UpdateAdminEventInput } from "./admin-events.schema.js";
import { deleteDraftEvent, findAdminEvent, insertAdminEvent, listAdminEvents, setEventCancelled, setEventPublished, setEventVisibility, setPublishSchedule, updateAdminEventRecord } from "./admin-events.repository.js";

function slugify(name:string){
  const base=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180)||"event";
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

function validateTimes(input:CreateAdminEventInput|UpdateAdminEventInput){
  if(input.startTime&&input.endTime&&new Date(input.endTime)<=new Date(input.startTime))throw AppError.badRequest("Event end time must be after start time","INVALID_EVENT_TIME");
  if(input.salesStartAt&&input.salesEndAt&&new Date(input.salesEndAt)<=new Date(input.salesStartAt))throw AppError.badRequest("Sales end time must be after sales start time","INVALID_SALES_TIME");
  if(input.salesStartAt&&input.startTime&&new Date(input.salesStartAt)>=new Date(input.startTime))throw AppError.badRequest("Sales must start before the Event starts","SALES_START_NOT_BEFORE_EVENT");
  if(input.salesEndAt&&input.endTime&&new Date(input.salesEndAt)>new Date(input.endTime))throw AppError.badRequest("Sales cannot end after the Event ends","SALES_AFTER_EVENT_END");
  if(input.checkinStartAt&&input.checkinEndAt&&new Date(input.checkinEndAt)<=new Date(input.checkinStartAt))throw AppError.badRequest("Check-in end time must be after check-in start time","INVALID_CHECKIN_TIME");
  if(input.checkinEndAt&&input.endTime&&new Date(input.checkinEndAt)>new Date(input.endTime))throw AppError.badRequest("Check-in cannot end after the event ends","CHECKIN_AFTER_EVENT_END");
  if(input.checkinStartAt&&input.startTime&&new Date(input.checkinStartAt).getTime()>new Date(input.startTime).getTime()-30*60*1000)throw AppError.badRequest("Check-in must start at least 30 minutes before the Event","CHECKIN_TOO_LATE");
  if(input.scheduledPublishAt&&input.startTime&&new Date(input.scheduledPublishAt)>=new Date(input.startTime))throw AppError.badRequest("Scheduled publishing must occur before event start","INVALID_PUBLISH_SCHEDULE");
}

function map(row:NonNullable<Awaited<ReturnType<typeof findAdminEvent>>>) {
  const readiness=getReadiness(row);
  return {id:row.id,name:row.name,slug:row.slug,description:row.description,category:row.category,venue:row.venue,address:row.address,city:row.city,venueCapacity:row.venue_capacity,coverImageUrl:row.cover_image_url,coverImagePublicId:row.cover_image_public_id,coverImageAlt:row.cover_image_alt,startTime:row.start_time,endTime:row.end_time,salesStartAt:row.sales_start_at,salesEndAt:row.sales_end_at,checkinStartAt:row.checkin_start_at,checkinEndAt:row.checkin_end_at,status:row.status,visibility:row.visibility,hiddenAt:row.hidden_at,hiddenReason:row.hidden_reason,scheduledPublishAt:row.scheduled_publish_at,publishedAt:row.published_at,cancelledAt:row.cancelled_at,cancellationReason:row.cancellation_reason,completedAt:row.completed_at,publishFailureReason:row.publish_failure_reason,ticketTypeCount:Number(row.ticket_type_count),validTicketTypeCount:Number(row.valid_ticket_type_count),allocatedCapacity:Number(row.allocated_capacity),soldQuantity:Number(row.sold_quantity),pendingOrderCount:Number(row.pending_order_count),confirmedOrderCount:Number(row.confirmed_order_count),readiness};
}

function getReadiness(row:NonNullable<Awaited<ReturnType<typeof findAdminEvent>>>) {
  const missing:string[]=[];
  if(!row.name.trim())missing.push("EVENT_NAME_REQUIRED");
  if(!row.venue.trim()||!row.address.trim()||!row.city.trim())missing.push("COMPLETE_LOCATION_REQUIRED");
  if(!row.cover_image_url)missing.push("COVER_IMAGE_REQUIRED");
  if(!row.venue_capacity||row.venue_capacity<=0)missing.push("VENUE_CAPACITY_REQUIRED");
  if(!row.sales_start_at||!row.sales_end_at)missing.push("SALES_WINDOW_REQUIRED");
  if(!row.checkin_start_at||!row.checkin_end_at)missing.push("CHECKIN_WINDOW_REQUIRED");
  if(row.end_time<=row.start_time)missing.push("INVALID_EVENT_TIME");
  if(row.start_time<=new Date())missing.push("EVENT_START_MUST_BE_FUTURE");
  if(row.sales_end_at&&row.sales_end_at>row.end_time)missing.push("SALES_END_AFTER_EVENT_END");
  if(row.sales_start_at&&row.sales_start_at>=row.start_time)missing.push("SALES_START_NOT_BEFORE_EVENT");
  if(row.checkin_start_at&&row.checkin_start_at.getTime()>row.start_time.getTime()-30*60*1000)missing.push("CHECKIN_TOO_LATE");
  if(Number(row.valid_ticket_type_count)<1)missing.push("VALID_TICKET_TYPE_REQUIRED");
  if(row.venue_capacity&&Number(row.allocated_capacity)>row.venue_capacity)missing.push("TICKET_CAPACITY_EXCEEDS_VENUE");
  return {ready:missing.length===0,missing};
}

export async function getAdminEventList(input:AdminEventListInput){const {rows,total}=await listAdminEvents(input);return {items:rows.map(map),meta:{total,page:input.page,limit:input.limit}};}
export async function getAdminEventById(id:number){const row=await findAdminEvent(id);if(!row)throw AppError.notFound("Event not found","EVENT_NOT_FOUND");return map(row);}
export async function createAdminEvent(input:CreateAdminEventInput,adminId:number){validateTimes(input);const id=await insertAdminEvent(input,slugify(input.name),adminId);return getAdminEventById(id);}
export async function updateAdminEvent(id:number,input:UpdateAdminEventInput){const current=await getAdminEventById(id);if(["completed","cancelled"].includes(current.status))throw new AppError(409,"Completed or cancelled Events are read-only","EVENT_NOT_EDITABLE");const merged={...input,startTime:input.startTime??new Date(current.startTime).toISOString(),endTime:input.endTime??new Date(current.endTime).toISOString(),salesStartAt:input.salesStartAt??new Date(current.salesStartAt).toISOString(),salesEndAt:input.salesEndAt??new Date(current.salesEndAt).toISOString(),checkinStartAt:input.checkinStartAt??new Date(current.checkinStartAt).toISOString(),checkinEndAt:input.checkinEndAt??new Date(current.checkinEndAt).toISOString()};validateTimes(merged);if(current.status!=="draft"){if(input.venueCapacity!==undefined&&(input.venueCapacity<current.venueCapacity||input.venueCapacity<current.allocatedCapacity))throw new AppError(409,"Venue capacity may only increase and cannot be below allocated Ticket capacity","VENUE_CAPACITY_CANNOT_DECREASE");const scheduleChanged=(input.startTime!==undefined&&new Date(input.startTime).getTime()!==new Date(current.startTime).getTime())||(input.endTime!==undefined&&new Date(input.endTime).getTime()!==new Date(current.endTime).getTime());if(scheduleChanged&&current.soldQuantity>0)throw new AppError(409,"Event schedule changes with sold Tickets require the attendee email notification workflow","SCHEDULE_NOTIFICATION_REQUIRED");}await updateAdminEventRecord(id,input);return getAdminEventById(id);}
export async function getPublishReadiness(id:number){return (await getAdminEventById(id)).readiness;}
export async function publishAdminEvent(id:number){const event=await getAdminEventById(id);if(event.status!=="draft")throw new AppError(409,"Only draft events can be published","EVENT_NOT_DRAFT");if(!event.readiness.ready)throw new AppError(409,`Event is missing publish requirements: ${event.readiness.missing.join(", ")}`,"EVENT_NOT_READY");await setEventPublished(id);return getAdminEventById(id);}
export async function scheduleAdminEvent(id:number,value:string|null){const event=await getAdminEventById(id);if(event.status!=="draft")throw new AppError(409,"Only draft events can be scheduled","EVENT_NOT_DRAFT");if(value&&(new Date(value)<=new Date()||new Date(value)>=new Date(event.startTime)))throw AppError.badRequest("Publish schedule must be in the future and before event start","INVALID_PUBLISH_SCHEDULE");await setPublishSchedule(id,value);return getAdminEventById(id);}
export async function cancelAdminEvent(id:number,reason:string,adminId:number){const event=await getAdminEventById(id);if(!["published","ongoing"].includes(event.status))throw new AppError(409,"Only published or ongoing Events can be cancelled; delete an unused Draft instead","EVENT_NOT_CANCELLABLE");if(reason.trim().length<10)throw AppError.badRequest("A cancellation reason of at least 10 characters is required","CANCELLATION_REASON_REQUIRED");const cancellationImpact=await setEventCancelled(id,reason.trim(),adminId);return {...await getAdminEventById(id),cancellationImpact};}
export async function removeAdminEvent(id:number){const event=await getAdminEventById(id);if(event.status!=="draft"||event.soldQuantity>0)throw new AppError(409,"Only an unsold draft event can be permanently deleted","EVENT_NOT_DELETABLE");if(!await deleteDraftEvent(id))throw new AppError(409,"Event has related orders and cannot be deleted","EVENT_HAS_ORDERS");}
export async function changeAdminEventVisibility(id:number,visible:boolean,reason:string|null,adminId:number){const event=await getAdminEventById(id);if(["completed","cancelled"].includes(event.status))throw new AppError(409,"Completed or cancelled Events cannot change visibility","EVENT_VISIBILITY_LOCKED");if(visible&&["published","ongoing"].includes(event.status)&&event.validTicketTypeCount<1)throw new AppError(409,"Activate at least one valid Ticket Type before showing this Event","EVENT_NOT_READY_TO_SHOW");if(!visible&&(!reason||reason.trim().length<5))throw AppError.badRequest("A reason of at least 5 characters is required when hiding an Event","HIDE_REASON_REQUIRED");await setEventVisibility(id,visible,reason,adminId);return getAdminEventById(id);}
