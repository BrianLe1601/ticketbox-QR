import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { create,list,remove,update } from "./admin-categories.controller.js";
import { categoryIdSchema,categoryListSchema,createCategorySchema,updateCategorySchema } from "./admin-categories.schema.js";

export const adminCategoriesRouter=Router();
adminCategoriesRouter.use(authenticate,authorize("admin"));
adminCategoriesRouter.get("/",validate(categoryListSchema,"query"),list);
adminCategoriesRouter.post("/",validate(createCategorySchema,"body"),create);
adminCategoriesRouter.patch("/:id",validate(categoryIdSchema,"params"),validate(updateCategorySchema,"body"),update);
adminCategoriesRouter.delete("/:id",validate(categoryIdSchema,"params"),remove);
