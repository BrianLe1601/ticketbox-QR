import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { AdminEventListInput, CreateAdminEventInput, UpdateAdminEventInput } from "./admin-events.schema.js";

export interface AdminEventRow extends RowDataPacket {
  id:number; name:string; slug:string; description:string|null; category:string;
  venue:string; address:string; city:string; venue_capacity:number|null;
  cover_image_url:string|null; start_time:Date; end_time:Date;
  sales_start_at:Date|null; sales_end_at:Date|null; checkin_start_at:Date|null;
  checkin_end_at:Date|null; status:"draft"|"published"|"ongoing"|"completed"|"cancelled";
  scheduled_publish_at:Date|null; published_at:Date|null; cancelled_at:Date|null;
  cancellation_reason:string|null; completed_at:Date|null; publish_failure_reason:string|null;
  ticket_type_count:number; valid_ticket_type_count:number; allocated_capacity:number; sold_quantity:number;
}

const SELECT = `e.*,
  COUNT(DISTINCT tt.id) ticket_type_count,
  COUNT(DISTINCT CASE WHEN tt.is_active=TRUE AND tt.capacity>0 AND tt.max_per_order>0
    AND (tt.sales_start_at IS NULL OR tt.sales_end_at IS NULL OR tt.sales_start_at < tt.sales_end_at)
    AND (tt.sales_end_at IS NULL OR tt.sales_end_at <= e.start_time) THEN tt.id END) valid_ticket_type_count,
  COALESCE(SUM(tt.capacity),0) allocated_capacity,
  COALESCE(SUM(tt.sold_quantity),0) sold_quantity`;

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
    cover_image_url:input.coverImageUrl, start_time:input.startTime, end_time:input.endTime,
    sales_start_at:input.salesStartAt, sales_end_at:input.salesEndAt,
    checkin_start_at:input.checkinStartAt, checkin_end_at:input.checkinEndAt,
    scheduled_publish_at:input.scheduledPublishAt,
  };
}

export async function insertAdminEvent(input:CreateAdminEventInput, slug:string, adminId:number){
  const [result]=await pool.execute<ResultSetHeader>(`INSERT INTO events
    (name,slug,description,category,venue,address,city,venue_capacity,cover_image_url,start_time,end_time,sales_start_at,sales_end_at,checkin_start_at,checkin_end_at,status,scheduled_publish_at,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)`,
    [input.name,slug,input.description??null,input.category,input.venue,input.address,input.city,input.venueCapacity??null,input.coverImageUrl??null,input.startTime,input.endTime,input.salesStartAt??null,input.salesEndAt??null,input.checkinStartAt??null,input.checkinEndAt??null,input.scheduledPublishAt??null,adminId]);
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
export async function setPublishSchedule(id:number,value:string|null){await pool.execute("UPDATE events SET scheduled_publish_at=?, publish_failure_reason=NULL WHERE id=? AND status='draft'",[value,id]);}
export async function setEventCancelled(id:number,reason:string){
  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    await connection.execute("UPDATE events SET status='cancelled', cancelled_at=NOW(3), cancellation_reason=?, scheduled_publish_at=NULL WHERE id=? AND status IN ('draft','published','ongoing')",[reason,id]);
    await connection.execute("UPDATE ticket_types SET is_active=FALSE WHERE event_id=?",[id]);
    await connection.commit();
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
