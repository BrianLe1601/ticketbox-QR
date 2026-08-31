import crypto from "node:crypto";
import { env } from "../../config/env.js";

export const REFRESH_COOKIE = "ticketbox_refresh";
export function hashToken(value:string){return crypto.createHash("sha256").update(value).digest("hex");}
export function newRefreshToken(){const id=crypto.randomUUID();const secret=crypto.randomBytes(32).toString("base64url");return {id,secret,value:`${id}.${secret}`,hash:hashToken(secret)};}
export function parseRefreshToken(value:string|undefined){if(!value)return null;const [id,secret,...rest]=value.split(".");return id&&secret&&!rest.length?{id,secret}:null;}
export function refreshExpiry(){return new Date(Date.now()+env.REFRESH_TOKEN_DAYS*86400000);}
