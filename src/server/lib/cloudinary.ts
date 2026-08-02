import { v2 as cloudinary } from "cloudinary";
import { env, integrations } from "./env";

let configured = false;

function configure() {
  if (configured) return;
  const e = env();
  cloudinary.config({
    cloud_name: e.CLOUDINARY_CLOUD_NAME,
    api_key: e.CLOUDINARY_API_KEY,
    api_secret: e.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

/**
 * Credentials for a browser-direct upload.
 *
 * The file goes straight from the browser to Cloudinary rather than through a
 * route handler — which sidesteps the serverless request body limit entirely
 * and keeps a large image off the function's memory. The secret never leaves
 * the server; only a short-lived signature does.
 */
export function signUpload(): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  configure();
  const e = env();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = e.CLOUDINARY_UPLOAD_FOLDER;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    e.CLOUDINARY_API_SECRET as string,
  );

  return {
    signature,
    timestamp,
    apiKey: e.CLOUDINARY_API_KEY as string,
    cloudName: e.CLOUDINARY_CLOUD_NAME as string,
    folder,
  };
}

export type UploadedImage = { url: string; publicId: string };

/**
 * Cloudinary fetches the remote file itself, so seeding never downloads image
 * bytes through this process. `overwrite: false` makes re-seeding idempotent:
 * an existing publicId is returned as-is instead of burning upload credits.
 */
export async function uploadFromUrl(
  remoteUrl: string,
  publicId: string,
): Promise<UploadedImage> {
  configure();
  const result = await cloudinary.uploader.upload(remoteUrl, {
    folder: env().CLOUDINARY_UPLOAD_FOLDER,
    public_id: publicId,
    overwrite: false,
    resource_type: "image",
    transformation: [{ width: 1200, height: 1200, crop: "fill", quality: "auto" }],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Builds a derived URL at the size actually needed. Serving a 1200px master
 * into a 300px grid cell is the single biggest wasted-bytes mistake on a
 * catalog page, and the brief calls out loading performance explicitly.
 */
export function imageUrl(
  source: string,
  opts: { width: number; height?: number } = { width: 600 },
): string {
  if (!integrations.cloudinary()) return source;

  const marker = "/upload/";
  const at = source.indexOf(marker);
  if (at === -1) return source;

  const dims = opts.height
    ? `w_${opts.width},h_${opts.height},c_fill`
    : `w_${opts.width},c_limit`;

  return (
    source.slice(0, at + marker.length) +
    `${dims},q_auto,f_auto/` +
    source.slice(at + marker.length)
  );
}
