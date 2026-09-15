import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { env } from "../../config/env.js";

export const adminUploadsRouter = Router();

adminUploadsRouter.use(authenticate, authorize("admin"));

adminUploadsRouter.post("/image-signature", (req, res) => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    res.status(503).json({
      success: false,
      code: "CLOUDINARY_NOT_CONFIGURED",
      message: "Cloudinary is not configured on the server.",
    });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = env.CLOUDINARY_EVENT_FOLDER;
  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    env.CLOUDINARY_API_SECRET,
  );

  res.status(200).json({
    success: true,
    data: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    },
  });
});
