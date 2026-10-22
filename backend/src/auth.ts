import jwt from "jsonwebtoken";
import { config } from "./config.js";

const pendingOtps = new Map<string, { code: string; expiresAt: number }>();

export function createOtp(phone: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  pendingOtps.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
  console.log(`[MiniLedger] Mock OTP for ${phone}: ${code}`);
  return code;
}

export function verifyOtp(phone: string, code: string): boolean {
  const pending = pendingOtps.get(phone);
  if (!pending || pending.expiresAt < Date.now() || pending.code !== code) return false;
  pendingOtps.delete(phone);
  return true;
}

export function createToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
}

export function userIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return typeof decoded === "object" && typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

