import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export async function uploadEventCover(file: File, onProgress?: (value: number) => void) {
  const { data: signed } = await apiRequest<UploadSignature>(
    "/admin/uploads/image-signature",
    { method: "POST" },
    getStoredToken(),
  );

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signed.apiKey);
  body.append("timestamp", String(signed.timestamp));
  body.append("folder", signed.folder);
  body.append("signature", signed.signature);

  return new Promise<UploadedImage>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", signed.uploadUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The image upload was interrupted. Please try again."));
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText) as {
          secure_url?: string; public_id?: string; width?: number; height?: number; error?: { message?: string };
        };
        if (request.status < 200 || request.status >= 300 || !result.secure_url || !result.public_id) {
          reject(new Error(result.error?.message ?? "Cloudinary could not upload this image."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id, width: result.width ?? 0, height: result.height ?? 0 });
      } catch {
        reject(new Error("Cloudinary returned an invalid response."));
      }
    };
    request.send(body);
  });
}
