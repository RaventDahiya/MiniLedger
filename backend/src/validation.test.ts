import { describe, expect, it } from "vitest";
import { loanInputSchema, phoneSchema } from "./validation.js";

describe("validation", () => {
  it("accepts an international phone number", () => {
    expect(phoneSchema.parse("+14155552671")).toBe("+14155552671");
  });

  it("rejects an invalid phone number", () => {
    expect(phoneSchema.safeParse("not-a-phone").success).toBe(false);
  });

  it("accepts a valid loan", () => {
    expect(loanInputSchema.parse({ friendName: "Alex", amount: 25, dueDate: "2026-12-31" })).toEqual({
      friendName: "Alex",
      amount: 25,
      dueDate: "2026-12-31",
    });
  });

  it("rejects zero or negative amounts", () => {
    expect(loanInputSchema.safeParse({ friendName: "Alex", amount: 0, dueDate: "2026-12-31" }).success).toBe(false);
  });
});

