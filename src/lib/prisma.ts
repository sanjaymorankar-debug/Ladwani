import { PrismaClient } from "@prisma/client";
import { withConnectionDefaults } from "./db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DATABASE_URL is the pooled endpoint on Neon (see prisma/schema.prisma).
// withConnectionDefaults adds a longer connect timeout and an idle-connection
// lifetime, so the first requests after Neon suspends an idle compute do not
// fail (src/lib/db-url.ts).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withConnectionDefaults(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
