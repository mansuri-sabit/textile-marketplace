import { Types } from "mongoose";
import { AppError } from "../lib/api";
import { connectDB } from "../lib/db";
import { SupplierProfile, User } from "../models";
import type {
  BuyerAccountInput,
  SupplierProfileInput,
} from "../validators/profile";

/**
 * Field-by-field profile editing, after onboarding has run.
 *
 * Both writers drop empty strings rather than storing them: a cleared optional
 * field should read as absent everywhere downstream, not as `""` that renders
 * as a blank line on a public storefront.
 */

/** Turns `""` into "remove this key" and leaves everything else alone. */
function prune<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    out[key] = value === "" ? undefined : value;
  }
  return out as Partial<T>;
}

export async function updateBuyerAccount(userId: string, input: BuyerAccountInput) {
  await connectDB();

  const user = await User.findById(userId);
  if (!user) throw new AppError("NOT_FOUND", "Account not found.", 404);

  const fields = prune(input);
  if (fields.name !== undefined) user.name = fields.name;
  // An empty phone clears it rather than storing a blank string.
  if ("phone" in fields) user.phone = fields.phone;

  await user.save();

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    onboardingCompleted: user.onboardingCompleted ?? false,
    buyerPreferences: user.buyerPreferences ?? null,
  };
}

export async function updateSupplierProfile(
  userId: string,
  input: SupplierProfileInput,
) {
  await connectDB();

  const profile = await SupplierProfile.findOne({
    user: new Types.ObjectId(userId),
  });
  if (!profile) {
    throw new AppError(
      "PROFILE_INCOMPLETE",
      "Finish setting up your business profile first.",
      409,
    );
  }

  // The slug is deliberately not derived from a renamed business: it is the
  // public storefront URL, and every product page already links to it.
  profile.set(prune(input));
  await profile.save();

  return profile.toJSON();
}
