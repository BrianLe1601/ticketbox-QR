import { Router } from "express";
import rateLimit from "express-rate-limit";

import { authenticate } from "../../middlewares/authenticate.js";
import { validateBody } from "../../middlewares/validate.js";
import {
  getMeController,
  loginController,
  logoutController,
  refreshController,
} from "./auth.controller.js";
import { loginSchema } from "./auth.schema.js";

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

authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  loginController,
);

authRouter.get("/me", authenticate, getMeController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);
