import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { show, updateCategoryScope, updateVenue } from "./platform-settings.controller.js";
import { categoryScopeSchema, venueSchema } from "./platform-settings.schema.js";

export const adminPlatformSettingsRouter = Router();
adminPlatformSettingsRouter.use(authenticate, authorize("admin"));
adminPlatformSettingsRouter.get("/", show);
adminPlatformSettingsRouter.put("/venue", validate(venueSchema, "body"), updateVenue);
adminPlatformSettingsRouter.put("/category-scope", validate(categoryScopeSchema, "body"), updateCategoryScope);
