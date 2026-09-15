import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";

export interface SessionRow extends RowDataPacket { id:string;user_id:number;token_hash:string;expires_at:Date;revoked_at:Date|null }

export async function createSession(id:string,userId:number,tokenHash:string,expiresAt:Date,userAgent:string|null,ip:string|null){
  await pool.execute("INSERT INTO auth_sessions (id,user_id,token_hash,expires_at,user_agent,ip_address) VALUES (?,?,?,?,?,?)",[id,userId,tokenHash,expiresAt,userAgent,ip]);
}
export async function lockSession(connection:PoolConnection,id:string){const [rows]=await connection.execute<SessionRow[]>("SELECT id,user_id,token_hash,expires_at,revoked_at FROM auth_sessions WHERE id=? FOR UPDATE",[id]);return rows[0]??null;}
export async function replaceSession(connection:PoolConnection,oldId:string,newId:string,userId:number,hash:string,expiresAt:Date,userAgent:string|null,ip:string|null){
  await connection.execute("INSERT INTO auth_sessions (id,user_id,token_hash,expires_at,user_agent,ip_address) VALUES (?,?,?,?,?,?)",[newId,userId,hash,expiresAt,userAgent,ip]);
  await connection.execute("UPDATE auth_sessions SET revoked_at=NOW(3),last_used_at=NOW(3),replaced_by=? WHERE id=?",[newId,oldId]);
}
export async function revokeSession(id:string){await pool.execute("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW(3)) WHERE id=?",[id]);}
export { pool };
