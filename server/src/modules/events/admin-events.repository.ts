import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { AdminEventListInput, CreateAdminEventInput, UpdateAdminEventInput } from "./admin-events.schema.js";

export interface AdminEventRow extends RowDataPacket {
  id:number; name:string; slug:string; description:string|null; category:string;
  venue:string; address:string; city:string; venue_capacity:number;
  cover_image_url:string|null; cover_image_public_id:string|null; cover_image_alt:string|null; start_time:Date; end_time:Date;
  sales_start_at:Date; sales_end_at:Date; checkin_start_at:Date;
  checkin_end_at:Date; status:"draft"|"published"|"ongoing"|"completed"|"cancelled";
  visibility:"visible"|"hidden"; hidden_at:Date|null; hidden_reason:string|null; hidden_by:number|null;
  scheduled_publish_at:Date|null; published_at:Date|null; cancelled_at:Date|null;
  cancellation_reason:string|null; completed_at:Date|null; publish_failure_reason:string|null;
  ticket_type_count:number; valid_ticket_type_count:number; allocated_capacity:number; sold_quantity:number;
  pending_order_count:number; confirmed_order_count:number;
}

const SELECT = `e.*,
  COUNT(DISTINCT tt.id) ticket_type_count,
  COUNT(DISTINCT CASE WHEN tt.is_active=TRUE AND tt.capacity>0 AND tt.max_per_order>0
    AND (tt.sales_start_at IS NULL OR tt.sales_end_at IS NULL OR tt.sales_start_at < tt.sales_end_at)
    AND (tt.sales_end_at IS NULL OR tt.sales_end_at <= e.end_time) THEN tt.id END) valid_ticket_type_count,
  COALESCE(SUM(tt.capacity),0) allocated_capacity,
  COALESCE(SUM(tt.sold_quantity),0) sold_quantity,
  (SELECT COUNT(*) FROM orders po WHERE po.event_id=e.id AND po.status='pending_payment') pending_order_count,
  (SELECT COUNT(*) FROM orders co WHERE co.event_id=e.id AND co.status='confirmed') confirmed_order_count`;

function toDatabaseDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const bangkokOffsetMilliseconds = 7 * 60 * 60 * 1000;
  return new Date(new Date(value).getTime() + bangkokOffsetMilliseconds)
    .toISOString()
    .slice(0, 23)
    .replace("T", " ");
}

export async function listAdminEvents(input: AdminEventListInput) {
  const conditions:string[]=[]; const params:unknown[]=[];
  if(input.q){conditions.push("(e.name LIKE ? OR e.venue LIKE ? OR e.city LIKE ?)");params.push(`%${input.q}%`,`%${input.q}%`,`%${input.q}%`);}
  if(input.status){conditions.push("e.status=?");params.push(input.status);}
  const where=conditions.length?`WHERE ${conditions.join(" AND ")}`:"";
  const offset=(input.page-1)*input.limit;
  const [rows]=await pool.query<AdminEventRow[]>(`SELECT ${SELECT} FROM events e LEFT JOIN ticket_types tt ON tt.event_id=e.id ${where} GROUP BY e.id ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,[...params,input.limit,offset]);
  const [counts]=await pool.query<RowDataPacket[]>(`SELECT COUNT(*) total FROM events e ${where}`,params);
  return {rows,total:Number(counts[0]?.total??0)};
}

export async function findAdminEvent(id:number, forUpdate=false, connection=pool) {
  const suffix=forUpdate?" FOR UPDATE":"";
  const [rows]=await connection.query<AdminEventRow[]>(`SELECT ${SELECT} FROM events e LEFT JOIN ticket_types tt ON tt.event_id=e.id WHERE e.id=? GROUP BY e.id${suffix}`,[id]);
  return rows[0]??null;
}

function dbValues(input:CreateAdminEventInput|UpdateAdminEventInput){
  return {
    name:input.name, description:input.description, category:input.category, venue:input.venue,
    address:input.address, city:input.city, venue_capacity:input.venueCapacity,
    cover_image_url:input.coverImageUrl, cover_image_public_id:input.coverImagePublicId,
    cover_image_alt:input.coverImageAlt,
    start_time:toDatabaseDate(input.startTime), end_time:toDatabaseDate(input.endTime),
    sales_start_at:toDatabaseDate(input.salesStartAt), sales_end_at:toDatabaseDate(input.salesEndAt),
    checkin_start_at:toDatabaseDate(input.checkinStartAt), checkin_end_at:toDatabaseDate(input.checkinEndAt),
    scheduled_publish_at:toDatabaseDate(input.scheduledPublishAt),
  };
}

export async function insertAdminEvent(input:CreateAdminEventInput, slug:string, adminId:number){
  const [result]=await pool.execute<ResultSetHeader>(`INSERT INTO events
    (name,slug,description,category,venue,address,city,venue_capacity,cover_image_url,cover_image_public_id,cover_image_alt,start_time,end_time,sales_start_at,sales_end_at,checkin_start_at,checkin_end_at,status,scheduled_publish_at,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)`,
    [input.name,slug,input.description??null,input.category,input.venue,input.address,input.city,input.venueCapacity,input.coverImageUrl??null,input.coverImagePublicId??null,input.coverImageAlt??null,toDatabaseDate(input.startTime)!,toDatabaseDate(input.endTime)!,toDatabaseDate(input.salesStartAt)!,toDatabaseDate(input.salesEndAt)!,toDatabaseDate(input.checkinStartAt)!,toDatabaseDate(input.checkinEndAt)!,toDatabaseDate(input.scheduledPublishAt)??null,adminId]);
  return result.insertId;
}

export async function updateAdminEventRecord(id:number,input:UpdateAdminEventInput){
  const values=dbValues(input); const sets:string[]=[]; const params:(string|number|null)[]=[];
  for(const [column,value] of Object.entries(values)){if(value!==undefined){sets.push(`${column}=?`);params.push(value as string|number|null);}}
  if(!sets.length)return;
  await pool.execute(`UPDATE events SET ${sets.join(", ")}, publish_failure_reason=NULL WHERE id=?`,[...params,id]);
}

export async function deleteDraftEvent(id:number){
  const connection=await pool.getConnection();
  try{await connection.beginTransaction();
    const [orders]=await connection.query<RowDataPacket[]>("SELECT COUNT(*) total FROM orders WHERE event_id=?",[id]);
    if(Number(orders[0]?.total??0)>0){await connection.rollback();return false;}
    await connection.execute("DELETE FROM event_staff WHERE event_id=?",[id]);
    await connection.execute("DELETE FROM ticket_types WHERE event_id=?",[id]);
    const [result]=await connection.execute<ResultSetHeader>("DELETE FROM events WHERE id=? AND status='draft'",[id]);
    await connection.commit(); return result.affectedRows===1;
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}

export async function setEventPublished(id:number){await pool.execute("UPDATE events SET status='published', published_at=NOW(3), scheduled_publish_at=NULL, last_publish_attempt_at=NOW(3), publish_failure_reason=NULL WHERE id=? AND status='draft'",[id]);}
export async function setPublishSchedule(id:number,value:string|null){await pool.execute("UPDATE events SET scheduled_publish_at=?, publish_failure_reason=NULL WHERE id=? AND status='draft'",[toDatabaseDate(value)??null,id]);}
export interface EventCancellationImpact {cancelledPendingOrders:number;confirmedOrders:number;refundRecords:number;notificationLogs:number}
export async function setEventCancelled(id:number,reason:string,adminId:number):Promise<EventCancellationImpact>{
  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    const [eventResult]=await connection.execute<ResultSetHeader>("UPDATE events SET status='cancelled', visibility='hidden', hidden_at=NOW(3), hidden_reason=?, hidden_by=?, cancelled_at=NOW(3), cancellation_reason=?, scheduled_publish_at=NULL WHERE id=? AND status IN ('published','ongoing')",[reason,adminId,reason,id]);
    if(eventResult.affectedRows!==1)throw new Error("Event is no longer cancellable");
    const [mailResult]=await connection.execute<ResultSetHeader>(`INSERT INTO email_logs(order_id,recipient,email_type,status)
      SELECT recipients.order_id,recipients.recipient,'order_cancelled','pending' FROM (
        SELECT o.id order_id,o.buyer_email recipient FROM orders o
          WHERE o.event_id=? AND o.status IN ('pending_payment','confirmed')
        UNION
        SELECT o.id,t.holder_email FROM orders o JOIN order_items oi ON oi.order_id=o.id
          JOIN tickets t ON t.order_item_id=oi.id
          WHERE o.event_id=? AND o.status='confirmed' AND t.holder_email IS NOT NULL
      ) recipients WHERE NOT EXISTS(SELECT 1 FROM email_logs el WHERE el.order_id=recipients.order_id
        AND el.email_type='order_cancelled' AND el.recipient=recipients.recipient)`,[id,id]);
    const [holds]=await connection.query<RowDataPacket[]>(`SELECT oi.ticket_type_id,SUM(oi.quantity) quantity FROM order_items oi
      JOIN orders o ON o.id=oi.order_id WHERE o.event_id=? AND o.status='pending_payment' GROUP BY oi.ticket_type_id`,[id]);
    for(const hold of holds)await connection.execute("UPDATE ticket_types SET reserved_quantity=GREATEST(0,reserved_quantity-?) WHERE id=?",[Number(hold.quantity),Number(hold.ticket_type_id)]);
    await connection.execute("UPDATE payments p JOIN orders o ON o.id=p.order_id SET p.status='cancelled' WHERE o.event_id=? AND o.status='pending_payment' AND p.status='pending'",[id]);
    const [pendingResult]=await connection.execute<ResultSetHeader>("UPDATE orders SET status='cancelled',cancelled_at=NOW(3) WHERE event_id=? AND status='pending_payment'",[id]);
    const [confirmedRows]=await connection.query<RowDataPacket[]>("SELECT COUNT(*) total FROM orders WHERE event_id=? AND status='confirmed'",[id]);
    const [refundResult]=await connection.execute<ResultSetHeader>(`INSERT INTO refunds(order_id,amount,status,reason)
      SELECT id,total_amount,IF(total_amount=0,'not_required','pending'),? FROM orders WHERE event_id=? AND status='confirmed'
      ON DUPLICATE KEY UPDATE reason=VALUES(reason)`,[reason,id]);
    await connection.execute(`UPDATE tickets t JOIN order_items oi ON oi.id=t.order_item_id JOIN orders o ON o.id=oi.order_id
      SET t.status='cancelled',t.cancelled_at=NOW(3),t.cancelled_by=?,t.cancel_reason=?
      WHERE o.event_id=? AND o.status='confirmed' AND t.status IN ('issued','checked_in')`,[adminId,reason,id]);
    await connection.execute("UPDATE ticket_types SET is_active=FALSE WHERE event_id=?",[id]);
    await connection.commit();
    return {cancelledPendingOrders:pendingResult.affectedRows,confirmedOrders:Number(confirmedRows[0]?.total??0),refundRecords:refundResult.affectedRows,notificationLogs:mailResult.affectedRows};
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}

export async function setEventVisibility(id:number,visible:boolean,reason:string|null,adminId:number){
  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    if(visible){
      await connection.execute("UPDATE events SET visibility='visible', hidden_at=NULL, hidden_reason=NULL, hidden_by=NULL WHERE id=? AND status IN ('draft','published','ongoing')",[id]);
    }else{
      await connection.execute("UPDATE events SET visibility='hidden', hidden_at=NOW(3), hidden_reason=?, hidden_by=? WHERE id=? AND status IN ('draft','published','ongoing')",[reason,adminId,id]);
    }
    await connection.commit();
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
