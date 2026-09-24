import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import { getAdminDashboardSummary } from "./admin-dashboard.service.js";

export async function getSummary(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const summary = await getAdminDashboardSummary();
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
}

