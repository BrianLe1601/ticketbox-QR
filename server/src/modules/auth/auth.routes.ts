import { Router } from "express";
import rateLimit from "express-rate-limit";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { requireStaffSchema } from "../../middlewares/require-staff-schema.js";
import { validateBody } from "../../middlewares/validate.js";
import {
  getMeController,
  googleLoginController,
  loginController,
  logoutController,
  refreshController,
  updateAdminProfileController,
  changeAdminPasswordController,
} from "./auth.controller.js";
import { changeAdminPasswordSchema, googleLoginSchema, loginSchema, updateAdminProfileSchema } from "./auth.schema.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn đăng nhập quá nhiều lần, vui lòng thử lại sau",
  },
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.authUser!.id),
  // Chỉ giới hạn một lần đổi thành công. Sai mật khẩu hiện tại hoặc payload
  // không hợp lệ không làm Admin bị khóa vì đó chưa phải là một lần đổi.
  skipFailedRequests: true,
  message: {
    success: false,
    message: "Bạn đổi mật khẩu quá nhiều lần, vui lòng thử lại sau",
    code: "PASSWORD_CHANGE_RATE_LIMIT",
  },
});

authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  loginController,
);

authRouter.post(
  "/google",
  loginLimiter,
  requireStaffSchema,
  validateBody(googleLoginSchema),
  googleLoginController,
);

authRouter.get("/me", authenticate, getMeController);
authRouter.patch("/admin/profile", authenticate, authorize("admin"), validateBody(updateAdminProfileSchema), updateAdminProfileController);
authRouter.patch("/admin/password", authenticate, authorize("admin"), passwordChangeLimiter, validateBody(changeAdminPasswordSchema), changeAdminPasswordController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);
