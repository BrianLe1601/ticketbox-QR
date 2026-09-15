import type { NextFunction,Request,Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import type { CreateCategoryInput,UpdateCategoryInput } from "./admin-categories.schema.js";
import { createCategory,getCategories,removeCategory,updateCategory } from "./admin-categories.service.js";

export async function list(req:Request,res:Response,next:NextFunction){try{const query=req.query as unknown as {includeInactive:boolean};sendSuccess(res,await getCategories(query.includeInactive));}catch(error){next(error);}}
export async function create(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await createCategory(req.body as CreateCategoryInput),201);}catch(error){next(error);}}
export async function update(req:Request,res:Response,next:NextFunction){try{sendSuccess(res,await updateCategory(Number(req.params.id),req.body as UpdateCategoryInput));}catch(error){next(error);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await removeCategory(Number(req.params.id));res.status(204).send();}catch(error){next(error);}}
