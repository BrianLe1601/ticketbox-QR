import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import type { CategoryScopeInput, VenueInput } from "./platform-settings.schema.js";
import { getPlatformSettings, saveCategoryScope, saveVenue } from "./platform-settings.service.js";

export async function show(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getPlatformSettings()); } catch (error) { next(error); }
}
export async function updateVenue(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await saveVenue(req.authUser!.id, req.body as VenueInput)); } catch (error) { next(error); }
}
export async function updateCategoryScope(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await saveCategoryScope(req.authUser!.id, req.body as CategoryScopeInput)); } catch (error) { next(error); }
}
