import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { cancel,create,detail,list,publish,readiness,remove,schedule,update } from "./admin-events.controller.js";
import { adminEventIdSchema,adminEventListSchema,cancelEventSchema,createAdminEventSchema,schedulePublishSchema,updateAdminEventSchema } from "./admin-events.schema.js";

export const adminEventsRouter=Router();
adminEventsRouter.use(authenticate,authorize("admin"));
adminEventsRouter.get("/",validate(adminEventListSchema,"query"),list);
adminEventsRouter.post("/",validate(createAdminEventSchema,"body"),create);
adminEventsRouter.get("/:id",validate(adminEventIdSchema,"params"),detail);
adminEventsRouter.patch("/:id",validate(adminEventIdSchema,"params"),validate(updateAdminEventSchema,"body"),update);
adminEventsRouter.delete("/:id",validate(adminEventIdSchema,"params"),remove);
adminEventsRouter.get("/:id/publish-readiness",validate(adminEventIdSchema,"params"),readiness);
adminEventsRouter.post("/:id/publish",validate(adminEventIdSchema,"params"),publish);
adminEventsRouter.patch("/:id/publish-schedule",validate(adminEventIdSchema,"params"),validate(schedulePublishSchema,"body"),schedule);
adminEventsRouter.post("/:id/cancel",validate(adminEventIdSchema,"params"),validate(cancelEventSchema,"body"),cancel);
