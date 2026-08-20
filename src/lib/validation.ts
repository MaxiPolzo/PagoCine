import { z } from "zod";
import { courses } from "@/config/payment";

export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
export const acceptedMimeTypes = ["application/pdf"];

export const registrationSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresá tu nombre").max(60),
  lastName: z.string().trim().min(2, "Ingresá tu apellido").max(60),
  whatsappPhone: z
    .string()
    .trim()
    .min(8, "Ingresá un WhatsApp válido")
    .max(30)
    .regex(/^[0-9+() .-]+$/, "Ingresá solo números y símbolos válidos"),
  course: z.enum(courses, { errorMap: () => ({ message: "Seleccioná un curso" }) })
});

export const reviewSchema = z.object({
  status: z.enum(["approved", "rejected", "manual_review", "pending"]),
  notes: z.string().trim().max(1000).optional()
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
