import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { createOtp, createToken, userIdFromToken, verifyOtp } from "./auth.js";
import { loanInputSchema, phoneSchema } from "./validation.js";

type AuthenticatedRequest = Request & { userId?: string };

const app = express();
app.use(cors());
app.use(express.json());

function auth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const userId = header?.startsWith("Bearer ") ? userIdFromToken(header.slice(7)) : null;
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  req.userId = userId;
  next();
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/request-otp", (req, res) => {
  const parsed = phoneSchema.safeParse(req.body?.phone);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid phone number" });
  createOtp(parsed.data);
  res.json({ message: "OTP generated. Check the server log." });
});

app.post("/auth/verify-otp", async (req, res, next) => {
  try {
    const phone = phoneSchema.parse(req.body?.phone);
    const code = String(req.body?.code ?? "").trim();
    if (!/^\d{6}$/.test(code) || !verifyOtp(phone, code)) return res.status(401).json({ error: "Invalid or expired OTP" });
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (id, phone) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id`,
      [crypto.randomUUID(), phone],
    );
    res.json({ token: createToken(user.rows[0].id) });
  } catch (error) {
    next(error);
  }
});

app.get("/loans", auth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, friend_name AS "friendName", amount_cents AS "amountCents",
              due_date AS "dueDate", repaid_at AS "repaidAt", created_at AS "createdAt"
       FROM loans WHERE user_id = $1 ORDER BY due_date ASC, created_at DESC`,
      [req.userId],
    );
    res.json({ loans: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/loans", auth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = loanInputSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO loans (id, user_id, friend_name, amount_cents, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, friend_name AS "friendName", amount_cents AS "amountCents",
                 due_date AS "dueDate", repaid_at AS "repaidAt", created_at AS "createdAt"`,
      [crypto.randomUUID(), req.userId, input.friendName, Math.round(input.amount * 100), input.dueDate],
    );
    res.status(201).json({ loan: result.rows[0] });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return res.status(400).json({ error: "Invalid loan details" });
    next(error);
  }
});

app.patch("/loans/:id/repaid", auth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE loans SET repaid_at = NOW()
       WHERE id = $1 AND user_id = $2 AND repaid_at IS NULL
       RETURNING id`,
      [req.params.id, req.userId],
    );
    if (!result.rowCount) return res.status(404).json({ error: "Loan not found or already repaid" });
    res.json({ message: "Loan marked as repaid" });
  } catch (error) {
    next(error);
  }
});

app.get("/summary", auth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
        COALESCE(SUM(amount_cents), 0)::integer AS "totalLentCents",
        COALESCE(SUM(amount_cents) FILTER (WHERE repaid_at IS NOT NULL), 0)::integer AS "totalRepaidCents",
        COALESCE(SUM(amount_cents) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE), 0)::integer AS "overdueCents"
       FROM loans WHERE user_id = $1`,
      [req.userId],
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

export default app;

