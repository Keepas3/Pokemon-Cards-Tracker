import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Standard Next.js dev-mode singleton so hot-reload doesn't open a new
// SQLite connection (and hit "too many connections") on every file save.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 requires an explicit driver adapter — there's no more bare
// url-based client. DATABASE_URL (from .env, e.g. "file:./prisma/dev.db")
// is loaded by Next.js automatically; for standalone scripts, load dotenv first.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
