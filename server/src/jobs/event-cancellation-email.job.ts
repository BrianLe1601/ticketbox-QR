import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../database/pool.js";
import { sendEventCancellationEmail } from "../services/mail.service.js";

interface CancellationMailRow extends RowDataPacket {
  id:number; recipient:string; attempt_count:number; order_code:string; buyer_name:string;
  event_name:string; venue:string; start_time:Date; cancellation_reason:string;
}

const INTERVAL_MS=60_000;
const MAX_ATTEMPTS=3;

async function processBatch(){
  const connection=await pool.getConnection();
  let rows:CancellationMailRow[]=[];
  try{
    await connection.beginTransaction();
    const [claimed]=await connection.query<CancellationMailRow[]>(`SELECT el.id,el.recipient,el.attempt_count,o.order_code,o.buyer_name,
      e.name event_name,e.venue,e.start_time,e.cancellation_reason FROM email_logs el
      JOIN orders o ON o.id=el.order_id JOIN events e ON e.id=o.event_id
      WHERE el.email_type='order_cancelled' AND el.status='pending'
      AND (el.next_attempt_at IS NULL OR el.next_attempt_at<=NOW(3))
      ORDER BY el.created_at LIMIT 20 FOR UPDATE SKIP LOCKED`);
    rows=claimed;
    if(rows.length)await connection.query("UPDATE email_logs SET status='processing' WHERE id IN (?)",[rows.map(row=>row.id)]);
    await connection.commit();
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}

  for(const row of rows){
    try{
      const result=await sendEventCancellationEmail({recipient:row.recipient,buyerName:row.buyer_name,orderCode:row.order_code,eventName:row.event_name,venue:row.venue,startTime:row.start_time,cancellationReason:row.cancellation_reason});
      await pool.execute("UPDATE email_logs SET status='sent',provider_id=?,sent_at=NOW(3),attempt_count=attempt_count+1,error_message=NULL WHERE id=?",[result.messageId??null,row.id]);
    }catch(error){
      const message=error instanceof Error?error.message:"Unknown mail delivery error";
      const finalAttempt=row.attempt_count+1>=MAX_ATTEMPTS;
      await pool.execute(`UPDATE email_logs SET status=?,attempt_count=attempt_count+1,error_message=?,
        next_attempt_at=IF(?,NULL,DATE_ADD(NOW(3),INTERVAL 5 MINUTE)) WHERE id=?`,[finalAttempt?"failed":"pending",message.slice(0,500),finalAttempt,row.id]);
    }
  }
}

export function startEventCancellationEmailJob(){
  let stopped=false;let timer:NodeJS.Timeout|undefined;
  const run=async()=>{try{await processBatch();}catch(error){console.error("[event-cancellation-email] Delivery failed:",error);}finally{if(!stopped)timer=setTimeout(()=>void run(),INTERVAL_MS);}};
  void run();
  console.log("[event-cancellation-email] Scheduled every 60s");
  return ()=>{stopped=true;if(timer)clearTimeout(timer);};
}
