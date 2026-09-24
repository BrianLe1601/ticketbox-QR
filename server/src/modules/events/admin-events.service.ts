import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { findCategoryBySlug } from "../categories/admin-categories.repository.js";
import type { AdminEventListInput, CreateAdminEventInput, UpdateAdminEventInput } from "./admin-events.schema.js";
import { deleteDraftEvent, findAdminEvent, findDueScheduledEvents, insertAdminEvent, listAdminEvents, setEventCancelled, setEventPublished, setEventVisibility, setPublishAttemptFailure, setPublishSchedule, updateAdminEventRecord } from "./admin-events.repository.js";
import { deriveEventLifecycleStatus } from "./event-lifecycle.service.js";
import { publishEventStatusChanges } from "./event-status.publisher.js";

function slugify(name:string){
  const base=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180)||"event";
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

const eventDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function eventCalendarDay(value: string | Date) {
  const parts = eventDayFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function validateEventTimes(input:CreateAdminEventInput|UpdateAdminEventInput){
  if(input.startTime&&input.endTime&&new Date(input.endTime)<=new Date(input.startTime))throw AppError.badRequest("Event end time must be after start time","INVALID_EVENT_TIME");
  if(input.salesStartAt&&input.salesEndAt&&new Date(input.salesEndAt)<=new Date(input.salesStartAt))throw AppError.badRequest("Sales end time must be after sales start time","INVALID_SALES_TIME");
  if(input.salesStartAt&&input.startTime&&new Date(input.salesStartAt)>=new Date(input.startTime))throw AppError.badRequest("Sales must start before the Event starts","SALES_START_NOT_BEFORE_EVENT");
  if(input.salesEndAt&&input.endTime&&new Date(input.salesEndAt)>new Date(input.endTime))throw AppError.badRequest("Sales cannot end after the Event ends","SALES_AFTER_EVENT_END");
  if(input.checkinStartAt&&input.checkinEndAt&&new Date(input.checkinEndAt)<=new Date(input.checkinStartAt))throw AppError.badRequest("Check-in end time must be after check-in start time","INVALID_CHECKIN_TIME");
  if(input.checkinStartAt&&input.endTime&&new Date(input.checkinStartAt)>new Date(input.endTime))throw AppError.badRequest("Thời gian bắt đầu check-in không được sau khi sự kiện kết thúc","CHECKIN_START_AFTER_EVENT_END");
  if(input.checkinEndAt&&input.endTime&&new Date(input.checkinEndAt)>new Date(input.endTime))throw AppError.badRequest("Check-in cannot end after the event ends","CHECKIN_AFTER_EVENT_END");
  if(input.checkinStartAt&&input.startTime&&eventCalendarDay(input.checkinStartAt)!==eventCalendarDay(input.startTime))throw AppError.badRequest("Thời gian bắt đầu check-in phải cùng ngày bắt đầu sự kiện","CHECKIN_START_WRONG_DAY");
  if(input.checkinStartAt&&input.startTime&&new Date(input.checkinStartAt).getTime()>new Date(input.startTime).getTime()-30*60*1000)throw AppError.badRequest("Check-in must start at least 30 minutes before the Event","CHECKIN_TOO_LATE");
  if(input.scheduledPublishAt&&input.startTime&&new Date(input.scheduledPublishAt)>=new Date(input.startTime))throw AppError.badRequest("Scheduled publishing must occur before event start","INVALID_PUBLISH_SCHEDULE");
}

function map(row:NonNullable<Awaited<ReturnType<typeof findAdminEvent>>>) {
  const readiness=getReadiness(row);
  const status=deriveEventLifecycleStatus({status:row.status,startTime:row.start_time,endTime:row.end_time});
  return {id:row.id,name:row.name,slug:row.slug,description:row.description,categoryId:row.category_id,category:row.category,venue:row.venue,address:row.address,city:row.city,venueCapacity:row.venue_capacity,coverImageUrl:row.cover_image_url,coverImagePublicId:row.cover_image_public_id,coverImageAlt:row.cover_image_alt,startTime:row.start_time,endTime:row.end_time,salesStartAt:row.sales_start_at,salesEndAt:row.sales_end_at,checkinStartAt:row.checkin_start_at,checkinEndAt:row.checkin_end_at,status,visibility:row.visibility,hiddenAt:row.hidden_at,hiddenReason:row.hidden_reason,scheduledPublishAt:row.scheduled_publish_at,publishedAt:row.published_at,cancelledAt:row.cancelled_at,cancellationReason:row.cancellation_reason,completedAt:row.completed_at,publishFailureReason:row.publish_failure_reason,ticketTypeCount:Number(row.ticket_type_count),validTicketTypeCount:Number(row.valid_ticket_type_count),allocatedCapacity:Number(row.allocated_capacity),soldQuantity:Number(row.sold_quantity),pendingOrderCount:Number(row.pending_order_count),confirmedOrderCount:Number(row.confirmed_order_count),activeStaffCount:Number(row.active_staff_count??0),readiness};
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
  if(row.checkin_start_at&&eventCalendarDay(row.checkin_start_at)!==eventCalendarDay(row.start_time))missing.push("CHECKIN_START_WRONG_DAY");
  if(row.checkin_start_at&&row.checkin_start_at>row.end_time)missing.push("CHECKIN_START_AFTER_EVENT_END");
  if(row.checkin_end_at&&row.checkin_end_at>row.end_time)missing.push("CHECKIN_END_AFTER_EVENT_END");
  if(row.checkin_start_at&&row.checkin_start_at.getTime()>row.start_time.getTime()-30*60*1000)missing.push("CHECKIN_TOO_LATE");
  if(Number(row.valid_ticket_type_count)<1)missing.push("VALID_TICKET_TYPE_REQUIRED");
  if(row.venue_capacity&&Number(row.allocated_capacity)>row.venue_capacity)missing.push("TICKET_CAPACITY_EXCEEDS_VENUE");
  return {ready:missing.length===0,missing};
}

export async function getAdminEventList(input:AdminEventListInput){const {rows,total}=await listAdminEvents(input);return {items:rows.map(map),meta:{total,page:input.page,limit:input.limit}};}
export async function getAdminEventById(id:number){const row=await findAdminEvent(id);if(!row)throw AppError.notFound("Event not found","EVENT_NOT_FOUND");return map(row);}
async function activeCategoryId(slug:string){const category=await findCategoryBySlug(slug);if(!category||!category.is_active)throw AppError.badRequest("Select an active Category","CATEGORY_NOT_ACTIVE");return category.id;}
export async function createAdminEvent(input:CreateAdminEventInput,adminId:number){validateEventTimes(input);const id=await insertAdminEvent(input,await activeCategoryId(input.category),slugify(input.name),adminId);return getAdminEventById(id);}
export async function updateAdminEvent(id:number,input:UpdateAdminEventInput){const current=await getAdminEventById(id);if(["completed","cancelled"].includes(current.status))throw new AppError(409,"Completed or cancelled Events are read-only","EVENT_NOT_EDITABLE");const merged={...input,startTime:input.startTime??new Date(current.startTime).toISOString(),endTime:input.endTime??new Date(current.endTime).toISOString(),salesStartAt:input.salesStartAt??new Date(current.salesStartAt).toISOString(),salesEndAt:input.salesEndAt??new Date(current.salesEndAt).toISOString(),checkinStartAt:input.checkinStartAt??new Date(current.checkinStartAt).toISOString(),checkinEndAt:input.checkinEndAt??new Date(current.checkinEndAt).toISOString()};validateEventTimes(merged);if(current.status!=="draft"){if(input.venueCapacity!==undefined&&(input.venueCapacity<current.venueCapacity||input.venueCapacity<current.allocatedCapacity))throw new AppError(409,"Venue capacity may only increase and cannot be below allocated Ticket capacity","VENUE_CAPACITY_CANNOT_DECREASE");const scheduleChanged=(input.startTime!==undefined&&new Date(input.startTime).getTime()!==new Date(current.startTime).getTime())||(input.endTime!==undefined&&new Date(input.endTime).getTime()!==new Date(current.endTime).getTime());if(scheduleChanged&&current.soldQuantity>0)throw new AppError(409,"Event schedule changes with sold Tickets require the attendee email notification workflow","SCHEDULE_NOTIFICATION_REQUIRED");}const categoryId=input.category?(input.category===current.category?current.categoryId:await activeCategoryId(input.category)):undefined;await updateAdminEventRecord(id,input,categoryId);return getAdminEventById(id);}
export async function getPublishReadiness(id:number){return (await getAdminEventById(id)).readiness;}
export async function publishAdminEvent(id:number){const event=await getAdminEventById(id);if(event.status!=="draft")throw new AppError(409,"Only draft events can be published","EVENT_NOT_DRAFT");if(!event.readiness.ready)throw new AppError(409,`Event is missing publish requirements: ${event.readiness.missing.join(", ")}`,"EVENT_NOT_READY");await setEventPublished(id);const published=await getAdminEventById(id);publishEventStatusChanges([{eventId:id,status:published.status}]);return published;}
export async function scheduleAdminEvent(id:number,value:string|null){const event=await getAdminEventById(id);if(event.status!=="draft")throw new AppError(409,"Only draft events can be scheduled","EVENT_NOT_DRAFT");if(value&&(new Date(value)<=new Date()||new Date(value)>=new Date(event.startTime)))throw AppError.badRequest("Publish schedule must be in the future and before event start","INVALID_PUBLISH_SCHEDULE");await setPublishSchedule(id,value);return getAdminEventById(id);}
export async function cancelAdminEvent(id:number,reason:string,adminId:number){const event=await getAdminEventById(id);if(!["published","ongoing"].includes(event.status))throw new AppError(409,"Only published or ongoing Events can be cancelled; delete an unused Draft instead","EVENT_NOT_CANCELLABLE");if(reason.trim().length<10)throw AppError.badRequest("A cancellation reason of at least 10 characters is required","CANCELLATION_REASON_REQUIRED");const cancellationImpact=await setEventCancelled(id,reason.trim(),adminId);const cancelled=await getAdminEventById(id);publishEventStatusChanges([{eventId:id,status:cancelled.status}]);return {...cancelled,cancellationImpact};}
export async function removeAdminEvent(id:number){const event=await getAdminEventById(id);if(event.status!=="draft"||event.soldQuantity>0)throw new AppError(409,"Only an unsold draft event can be permanently deleted","EVENT_NOT_DELETABLE");if(!await deleteDraftEvent(id))throw new AppError(409,"Event has related orders and cannot be deleted","EVENT_HAS_ORDERS");}
export async function changeAdminEventVisibility(id:number,visible:boolean,reason:string|null,adminId:number){const event=await getAdminEventById(id);if(["completed","cancelled"].includes(event.status))throw new AppError(409,"Completed or cancelled Events cannot change visibility","EVENT_VISIBILITY_LOCKED");if(visible&&["published","ongoing"].includes(event.status)&&event.validTicketTypeCount<1)throw new AppError(409,"Activate at least one valid Ticket Type before showing this Event","EVENT_NOT_READY_TO_SHOW");if(!visible&&(!reason||reason.trim().length<5))throw AppError.badRequest("A reason of at least 5 characters is required when hiding an Event","HIDE_REASON_REQUIRED");await setEventVisibility(id,visible,reason,adminId);return getAdminEventById(id);}

export async function processDueScheduledEvents(): Promise<{ processed: number; published: number; failed: number }> {
  const dueIds = (await findDueScheduledEvents(10)) ?? [];
  let published = 0;
  let failed = 0;

  for (const id of dueIds) {
    try {
      const event = await getAdminEventById(id);
      if (event.status !== "draft") continue;
      if (!event.readiness.ready) {
        const reason = `Missing publish requirements: ${event.readiness.missing.join(", ")}`;
        await setPublishAttemptFailure(id, reason);
        failed += 1;
        continue;
      }
      await setEventPublished(id);
      publishEventStatusChanges([{ eventId: id, status: "published" }]);
      published += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publish error";
      await setPublishAttemptFailure(id, message);
      failed += 1;
    }
  }

  return { processed: dueIds.length, published, failed };
}
