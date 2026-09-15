import { Router } from "express";
import { sendSuccess } from "../../utils/response.js";
import { getCategories } from "./admin-categories.service.js";

export const categoriesRouter=Router();
categoriesRouter.get("/",async(_req,res,next)=>{try{sendSuccess(res,await getCategories(false));}catch(error){next(error);}});
