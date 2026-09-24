import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { getSummary } from "./admin-dashboard.controller.js";

export const adminDashboardRouter = Router();

adminDashboardRouter.use(authenticate, authorize("admin"));
adminDashboardRouter.get("/summary", getSummary);

