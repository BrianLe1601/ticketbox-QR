import type { NextFunction,Request,Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import { changeTicketSalesStatus,createTicketType,getTicketTypeList,removeTicketType,updateTicketType } from "./admin-ticket-types.service.js";
import type { CreateTicketTypeInput,UpdateTicketTypeInput } from "./admin-ticket-types.schema.js";
export async function list(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await getTicketTypeList(Number(req.query.eventId)));}catch(error){next(error);}}
export async function create(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await createTicketType(req.body as CreateTicketTypeInput),201);}catch(error){next(error);}}
export async function update(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await updateTicketType(Number(req.params.id),req.body as UpdateTicketTypeInput));}catch(error){next(error);}}
export async function salesStatus(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await changeTicketSalesStatus(Number(req.params.id),(req.body as {active:boolean}).active));}catch(error){next(error);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await removeTicketType(Number(req.params.id));res.status(204).send();}catch(error){next(error);}}
