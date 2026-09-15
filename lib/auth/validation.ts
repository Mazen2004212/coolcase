import { z } from "zod";

const requiredText = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
export const passwordSchema = z.string().min(8, "Use at least 8 characters").regex(/[A-Za-z]/, "Include at least one letter").regex(/[0-9]/, "Include at least one number");

export const signupSchema = z.object({
  fullName: requiredText("Full name", 120), phone: requiredText("Phone", 32),
  email: z.email("Enter a valid email address"), password: passwordSchema, confirmPassword: z.string(),
  governorate: requiredText("Governorate", 80), city: requiredText("City", 100), area: requiredText("Area", 100),
  street: requiredText("Street", 200), building: requiredText("Building", 50),
  floor: z.string().trim().max(50).default(""), apartment: z.string().trim().max(50).default(""), landmark: z.string().trim().max(160).default(""),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const loginSchema = z.object({ email: z.email("Enter a valid email address"), password: z.string().min(1, "Password is required") });
export const forgotPasswordSchema = z.object({ email: z.email("Enter a valid email address") });
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
