import { z } from "zod";

export const phoneSchema = z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number");

export const loanInputSchema = z.object({
  friendName: z.string().trim().min(1, "Friend name is required").max(80),
  amount: z.coerce.number().positive("Amount must be greater than zero").finite(),
  dueDate: z.string().date("Due date must be a valid YYYY-MM-DD date"),
});

export type LoanInput = z.infer<typeof loanInputSchema>;

