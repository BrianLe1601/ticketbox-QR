import type { NextFunction,Request,Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import type { UpdateCategoryInput } from "./admin-categories.schema.js";
import { catalogFixedError,getAdminCategories,updateCategory } from "./admin-categories.service.js";

export async function list(req:Request,res:Response,next:NextFunction){try{const query=req.query as unknown as {includeInactive:boolean};sendSuccess(res,await getAdminCategories(query.includeInactive));}catch(error){next(error);}}
export async function update(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await updateCategory(Number(req.params.id),req.body as UpdateCategoryInput));}catch(error){next(error);}}
/** POST/DELETE stay routed so old clients get a stable code instead of a generic 404. */
export function catalogFixed(_req:Request,_res:Response,next:NextFunction){next(catalogFixedError());}
