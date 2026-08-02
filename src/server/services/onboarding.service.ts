import { Types } from "mongoose";
import { AppError } from "../lib/api";
import { connectDB } from "../lib/db";
import { slugify } from "../lib/slug";
import { OPERATING_HOURS_PRESETS } from "../constants/marketplace";
import { SupplierProfile, User } from "../models";
import type {
  BuyerOnboardingInput,
  SupplierOnboardingInput,
} from "../validators/onboarding";

/**
 * Onboarding is the only place `onboardingCompleted` flips to true, and the
 * flag lives on the access token as well as the user document — `proxy.ts`
 * reads it on every navigation and has no database access. Callers must
 * therefore re-issue the token pair after either of these succeeds, or the
 * edge guard will keep bouncing the user back here with their answers already
 * saved. `reissueSession` in auth.service exists for exactly that.
 */

async function loadUser(userId: string, role: "buyer" | "supplier") {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw new AppError("NOT_FOUND", "Account not found.", 404);
  if (user.role !== role) {
    throw new AppError(
      "FORBIDDEN",
      `This onboarding is for ${role} accounts.`,
      403,
    );
  }
  return user;
}

export async function completeBuyerOnboarding(
  userId: string,
  input: BuyerOnboardingInput,
) {
  const user = await loadUser(userId, "buyer");

  user.set("buyerPreferences", {
    businessType: input.businessType,
    industry: input.industry,
    interestedCategories: input.interestedCategories,
    preferredFabricTypes: input.preferredFabricTypes,
    typicalOrderQuantity: input.typicalOrderQuantity,
    budgetRange: input.budgetRange,
    notes: input.notes,
  });
  user.onboardingCompleted = true;
  await user.save();

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as "buyer",
    onboardingCompleted: true,
    buyerPreferences: user.buyerPreferences ?? null,
  };
}

/** Storefront slugs are public URLs, so they must be globally unique. */
async function uniqueProfileSlug(name: string, keepId?: string): Promise<string> {
  const base = slugify(name) || "supplier";
  let candidate = base;
  let n = 2;

  for (;;) {
    const clash = await SupplierProfile.findOne({ slug: candidate })
      .select("_id")
      .lean();
    if (!clash || (keepId && String(clash._id) === keepId)) return candidate;
    candidate = `${base}-${n++}`;
  }
}

export async function completeSupplierOnboarding(
  userId: string,
  input: SupplierOnboardingInput,
) {
  const user = await loadUser(userId, "supplier");

  const existing = await SupplierProfile.findOne({
    user: new Types.ObjectId(userId),
  });

  const fields = {
    businessName: input.businessName,
    businessType: input.businessType,
    description: input.description,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    website: input.website,
    address: input.address,
    operatingHours: OPERATING_HOURS_PRESETS[input.operatingHours].hours,
    categories: input.categories,
    fabricTypes: input.fabricTypes,
    minimumOrderQuantity: input.minimumOrderQuantity,
    gstNumber: input.gstNumber,
    yearEstablished: input.yearEstablished,
  };

  let profile;
  if (existing) {
    // Re-running onboarding edits the profile but keeps the slug — product URLs
    // and storefront links already point at it.
    existing.set(fields);
    await existing.save();
    profile = existing;
  } else {
    profile = await SupplierProfile.create({
      ...fields,
      user: new Types.ObjectId(userId),
      slug: await uniqueProfileSlug(input.businessName),
    });
  }

  // Only after the profile exists — a supplier past onboarding with no profile
  // would reach the inventory screens and fail on every write.
  user.onboardingCompleted = true;
  if (!user.phone) user.phone = input.contactPhone;
  await user.save();

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as "supplier",
    onboardingCompleted: true,
    profile: {
      id: String(profile._id),
      businessName: profile.businessName,
      slug: profile.slug,
    },
  };
}

/**
 * Existing answers, so re-entering onboarding to change something starts from
 * what was said last time rather than from an empty chat.
 */
export async function getOnboardingState(userId: string) {
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError("NOT_FOUND", "Account not found.", 404);

  if (user.role === "supplier") {
    const profile = await SupplierProfile.findOne({
      user: new Types.ObjectId(userId),
    }).lean();
    return {
      role: "supplier" as const,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      onboardingCompleted: user.onboardingCompleted ?? false,
      profile: profile ?? null,
    };
  }

  return {
    role: "buyer" as const,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    onboardingCompleted: user.onboardingCompleted ?? false,
    buyerPreferences: user.buyerPreferences ?? null,
  };
}
