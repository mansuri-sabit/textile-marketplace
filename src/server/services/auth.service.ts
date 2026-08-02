import { connectDB } from "../lib/db";
import { AppError } from "../lib/api";
import { hashPassword, verifyPassword } from "../lib/password";
import { signAccessToken, signRefreshToken } from "../lib/tokens";
import { User } from "../models";
import type { LoginInput, RegisterInput } from "../validators/auth";

export type AuthedUser = {
  id: string;
  name: string;
  email: string;
  role: "buyer" | "supplier";
  onboardingCompleted: boolean;
  avatarUrl?: string;
};

type TokenPair = { accessToken: string; refreshToken: string };

async function issueTokens(user: {
  _id: unknown;
  role: "buyer" | "supplier";
  name: string;
  onboardingCompleted: boolean;
  tokenVersion: number;
}): Promise<TokenPair> {
  const sub = String(user._id);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({
      sub,
      role: user.role,
      name: user.name,
      onboardingCompleted: user.onboardingCompleted,
    }),
    signRefreshToken({ sub, tv: user.tokenVersion }),
  ]);
  return { accessToken, refreshToken };
}

export async function registerUser(
  input: RegisterInput,
): Promise<{ user: AuthedUser; tokens: TokenPair }> {
  await connectDB();

  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) {
    throw new AppError(
      "EMAIL_TAKEN",
      "An account with this email already exists.",
      409,
    );
  }

  const passwordHash = await hashPassword(input.password);

  const created = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: input.role,
    phone: input.phone,
    onboardingCompleted: false,
    lastLoginAt: new Date(),
  });

  const tokens = await issueTokens({
    _id: created._id,
    role: created.role as "buyer" | "supplier",
    name: created.name,
    onboardingCompleted: created.onboardingCompleted ?? false,
    tokenVersion: created.tokenVersion ?? 0,
  });

  return {
    user: {
      id: String(created._id),
      name: created.name,
      email: created.email,
      role: created.role as "buyer" | "supplier",
      onboardingCompleted: created.onboardingCompleted ?? false,
    },
    tokens,
  };
}

export async function loginUser(
  input: LoginInput,
): Promise<{ user: AuthedUser; tokens: TokenPair }> {
  await connectDB();

  // passwordHash is select:false on the schema, so it must be asked for.
  const user = await User.findOne({ email: input.email }).select(
    "+passwordHash",
  );

  // Same message and a real hash comparison either way, so response timing and
  // wording cannot be used to discover which emails are registered.
  const invalid = new AppError(
    "INVALID_CREDENTIALS",
    "Email or password is incorrect.",
    401,
  );
  if (!user) {
    await verifyPassword(
      input.password,
      "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    throw invalid;
  }

  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) throw invalid;

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens({
    _id: user._id,
    role: user.role as "buyer" | "supplier",
    name: user.name,
    onboardingCompleted: user.onboardingCompleted ?? false,
    tokenVersion: user.tokenVersion ?? 0,
  });

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as "buyer" | "supplier",
      onboardingCompleted: user.onboardingCompleted ?? false,
      avatarUrl: user.avatarUrl ?? undefined,
    },
    tokens,
  };
}

/**
 * Re-mints the token pair from current user state, without a refresh token.
 *
 * The access token carries `onboardingCompleted`, which the edge proxy reads on
 * every navigation. Anything that changes a claim has to call this and re-set
 * the cookies, otherwise the guard keeps acting on the stale copy until the
 * 15-minute access token expires.
 */
export async function reissueSession(
  userId: string,
): Promise<{ user: AuthedUser; tokens: TokenPair }> {
  await connectDB();

  const user = await User.findById(userId);
  if (!user) throw new AppError("SESSION_EXPIRED", "Please sign in again.", 401);

  const tokens = await issueTokens({
    _id: user._id,
    role: user.role as "buyer" | "supplier",
    name: user.name,
    onboardingCompleted: user.onboardingCompleted ?? false,
    tokenVersion: user.tokenVersion ?? 0,
  });

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as "buyer" | "supplier",
      onboardingCompleted: user.onboardingCompleted ?? false,
      avatarUrl: user.avatarUrl ?? undefined,
    },
    tokens,
  };
}

/**
 * Exchanges a refresh token for a new pair. `tokenVersion` is re-checked
 * against the database so a logout-everywhere can invalidate tokens that have
 * not expired yet.
 */
export async function refreshSession(
  userId: string,
  tokenVersion: number,
): Promise<{ user: AuthedUser; tokens: TokenPair }> {
  await connectDB();

  const user = await User.findById(userId);
  if (!user || (user.tokenVersion ?? 0) !== tokenVersion) {
    throw new AppError("SESSION_EXPIRED", "Please sign in again.", 401);
  }

  const tokens = await issueTokens({
    _id: user._id,
    role: user.role as "buyer" | "supplier",
    name: user.name,
    onboardingCompleted: user.onboardingCompleted ?? false,
    tokenVersion: user.tokenVersion ?? 0,
  });

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as "buyer" | "supplier",
      onboardingCompleted: user.onboardingCompleted ?? false,
      avatarUrl: user.avatarUrl ?? undefined,
    },
    tokens,
  };
}
