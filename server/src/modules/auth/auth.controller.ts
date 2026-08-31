import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../utils/app-error.js";
import type { LoginInput } from "./auth.schema.js";
import {
  getCurrentUser,
  login,
  logoutSession,
  refreshSession,
} from "./auth.service.js";
import { env } from "../../config/env.js";
import { REFRESH_COOKIE } from "./refresh-token.js";

const cookieOptions={httpOnly:true,secure:env.NODE_ENV==="production",sameSite:"strict" as const,path:"/api/auth",maxAge:env.REFRESH_TOKEN_DAYS*86400000};
const metadata=(req:Request)=>({userAgent:req.get("user-agent")?.slice(0,500)??null,ip:req.ip??null});
function assertTrustedOrigin(req:Request){const origin=req.get("origin");if(origin&&origin!==env.CLIENT_URL)throw new AppError(403,"Untrusted request origin","UNTRUSTED_ORIGIN");}

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await login(req.body as LoginInput,metadata(req));
    res.cookie(REFRESH_COOKIE,result.refreshToken,cookieOptions);

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: {accessToken:result.accessToken,user:result.user},
    });
  } catch (error: unknown) {
    next(error);
  }
}

export async function getMeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.authUser) {
      throw new AppError(401, "Bạn chưa đăng nhập", "UNAUTHORIZED");
    }

    const user = await getCurrentUser(req.authUser.id);

    res.status(200).json({
      success: true,
      message: "Lấy thông tin tài khoản thành công",
      data: { user },
    });
  } catch (error: unknown) {
    next(error);
  }
}

export async function refreshController(req:Request,res:Response,next:NextFunction){try{assertTrustedOrigin(req);const result=await refreshSession(req.cookies?.[REFRESH_COOKIE],metadata(req));res.cookie(REFRESH_COOKIE,result.refreshToken,cookieOptions);res.status(200).json({success:true,message:"Session renewed",data:{accessToken:result.accessToken,user:result.user}});}catch(error){res.clearCookie(REFRESH_COOKIE,{...cookieOptions,maxAge:undefined});next(error);}}
export async function logoutController(req:Request,res:Response,next:NextFunction){try{assertTrustedOrigin(req);await logoutSession(req.cookies?.[REFRESH_COOKIE]);res.clearCookie(REFRESH_COOKIE,{httpOnly:true,secure:env.NODE_ENV==="production",sameSite:"strict",path:"/api/auth"});res.status(204).send();}catch(error){next(error);}}
