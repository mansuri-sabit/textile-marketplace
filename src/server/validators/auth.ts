import { z } from "zod";
import { USER_ROLES } from "../constants/marketplace";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

/**
 * Deliberately not a maximum-strength policy — this is a prototype and judges
 * will be creating throwaway accounts. It still blocks the genuinely weak
 * cases (too short, no letter, no digit).
 */
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be under 72 characters") // bcrypt truncates past 72
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  email,
  password,
  role: z.enum(USER_ROLES, {
    message: "Choose whether you are buying or selling",
  }),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number")
    .optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
