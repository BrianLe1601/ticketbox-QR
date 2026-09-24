import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { requireStaffSchema } from "../../middlewares/require-staff-schema.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import {
  createAssignment, editStaff, listStaff, removeAssignment, setStaffStatus,
} from "./admin-staff.controller.js";
import {
  assignmentParamsSchema, staffAssignmentSchema, staffIdParamsSchema,
  staffProfileSchema, staffStatusSchema,
} from "./admin-staff.schema.js";

export const adminStaffRouter = Router();
adminStaffRouter.use(authenticate, authorize("admin"), requireStaffSchema);
adminStaffRouter.get("/", listStaff);
adminStaffRouter.patch("/:staffId", validate(staffIdParamsSchema, "params"),
  validate(staffProfileSchema, "body"), editStaff);
adminStaffRouter.patch("/:staffId/status", validate(staffIdParamsSchema, "params"),
  validate(staffStatusSchema, "body"), setStaffStatus);
adminStaffRouter.post("/:staffId/assignments", validate(staffIdParamsSchema, "params"),
  validate(staffAssignmentSchema, "body"), createAssignment);
adminStaffRouter.delete("/:staffId/assignments/:assignmentId",
  validate(assignmentParamsSchema, "params"), removeAssignment);
