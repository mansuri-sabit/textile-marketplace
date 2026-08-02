import { AppError, ok, route } from "@/server/lib/api";
import { signUpload } from "@/server/lib/cloudinary";
import { integrations } from "@/server/lib/env";
import { requireSupplier } from "@/server/middleware/session";

export const runtime = "nodejs";

/**
 * POST /api/supplier/upload-signature
 *
 * Issues short-lived credentials so the browser can upload a product image
 * straight to Cloudinary. Supplier-only: an open signature endpoint would let
 * anyone fill the account's storage quota.
 */
export const POST = route(async () => {
  await requireSupplier();

  if (!integrations.cloudinary()) {
    throw new AppError(
      "UPLOADS_UNAVAILABLE",
      "Image uploads are not configured on this deployment.",
      503,
    );
  }

  return ok(signUpload());
});
