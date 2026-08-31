import type { NextFunction,Request,Response } from "express";
import { sendPaginated,sendSuccess } from "../../utils/response.js";
import type { AdminEventListInput,CreateAdminEventInput,UpdateAdminEventInput } from "./admin-events.schema.js";
import { cancelAdminEvent,changeAdminEventVisibility,createAdminEvent,getAdminEventById,getAdminEventList,getPublishReadiness,publishAdminEvent,removeAdminEvent,scheduleAdminEvent,updateAdminEvent } from "./admin-events.service.js";

export async function list(req:Request,res:Response,next:NextFunction){try{const result=await getAdminEventList(req.query as unknown as AdminEventListInput);sendPaginated(res,result.items,result.meta);}catch(error){next(error);}}
export async function detail(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await getAdminEventById(Number(req.params.id)));}catch(error){next(error);}}
export async function create(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await createAdminEvent(req.body as CreateAdminEventInput,req.authUser!.id),201);}catch(error){next(error);}}
export async function update(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await updateAdminEvent(Number(req.params.id),req.body as UpdateAdminEventInput));}catch(error){next(error);}}
export async function readiness(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await getPublishReadiness(Number(req.params.id)));}catch(error){next(error);}}
export async function publish(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await publishAdminEvent(Number(req.params.id)));}catch(error){next(error);}}
export async function schedule(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await scheduleAdminEvent(Number(req.params.id),(req.body as {scheduledPublishAt:string|null}).scheduledPublishAt));}catch(error){next(error);}}
export async function cancel(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await cancelAdminEvent(Number(req.params.id),(req.body as {reason:string}).reason,req.authUser!.id));}catch(error){next(error);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await removeAdminEvent(Number(req.params.id));res.status(204).send();}catch(error){next(error);}}
export async function visibility(req:Request,res:Response,next:NextFunction){try{const body=req.body as {visible:boolean;reason?:string|null};sendSuccess(res,await changeAdminEventVisibility(Number(req.params.id),body.visible,body.reason??null,req.authUser!.id));}catch(error){next(error);}}
