import "dotenv/config";

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/miniledger",
  jwtSecret: process.env.JWT_SECRET ?? "development-only-secret",
  port: Number(process.env.PORT ?? 4000),
};

