import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { catalogFixed,list,update } from "./admin-categories.controller.js";
import { categoryIdSchema,categoryListSchema,updateCategorySchema } from "./admin-categories.schema.js";

export const adminCategoriesRouter=Router();
adminCategoriesRouter.use(authenticate,authorize("admin"));
adminCategoriesRouter.get("/",validate(categoryListSchema,"query"),list);
adminCategoriesRouter.patch("/:id",validate(categoryIdSchema,"params"),validate(updateCategorySchema,"body"),update);
// The genre catalogue is fixed: creating or deleting a Category is refused (409 CATEGORY_CATALOG_FIXED).
adminCategoriesRouter.post("/",catalogFixed);
adminCategoriesRouter.delete("/:id",validate(categoryIdSchema,"params"),catalogFixed);
