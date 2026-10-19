import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { show, updateVenue } from "./platform-settings.controller.js";
import { venueSchema } from "./platform-settings.schema.js";

export const adminPlatformSettingsRouter = Router();
adminPlatformSettingsRouter.use(authenticate, authorize("admin"));
adminPlatformSettingsRouter.get("/", show);
adminPlatformSettingsRouter.put("/venue", validate(venueSchema, "body"), updateVenue);
// New Events may only use the fixed genre catalogue, so there is no Category scope to change.
