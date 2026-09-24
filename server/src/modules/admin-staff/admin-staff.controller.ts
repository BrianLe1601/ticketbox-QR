import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../utils/app-error.js";
import {
  assignStaff, changeStaffStatus, listAdminStaff, revokeStaffAssignment,
  updateStaffProfile,
} from "./admin-staff.service.js";

function adminId(req: Request) {
  if (!req.authUser) throw new AppError(401, "Bạn chưa đăng nhập", "UNAUTHORIZED");
  return req.authUser.id;
}

export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    adminId(req);
    res.json({ success: true, data: await listAdminStaff() });
  } catch (error) { next(error); }
}

export async function setStaffStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await changeStaffStatus(Number(req.params.staffId), adminId(req), req.body.action);
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

export async function editStaff(req: Request, res: Response, next: NextFunction) {
  try {
    adminId(req);
    res.json({ success: true, data: await updateStaffProfile(Number(req.params.staffId), req.body.fullName) });
  } catch (error) { next(error); }
}

export async function createAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await assignStaff(Number(req.params.staffId), req.body.eventId, adminId(req));
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
}

export async function removeAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    adminId(req);
    res.json({ success: true, data: await revokeStaffAssignment(
      Number(req.params.staffId), Number(req.params.assignmentId),
    ) });
  } catch (error) { next(error); }
}
