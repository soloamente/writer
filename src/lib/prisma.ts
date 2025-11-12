import { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

// Configure Prisma with connection pooling settings
const prismaClientOptions: {
  log: Prisma.LogLevel[];
  datasources: { db: { url: string | undefined } };
  errorFormat: "pretty";
} = {
  log:
    process.env.NODE_ENV === "development"
      ? (["query", "error", "warn"] as Prisma.LogLevel[])
      : (["error"] as Prisma.LogLevel[]),
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Add connection timeout and pool settings
  errorFormat: "pretty",
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(prismaClientOptions)
    .$extends(withAccelerate())
    .$extends({
      query: {
        $allOperations: async ({ operation, model, args, query }) => {
          const start = Date.now();
          try {
            const result = await query(args);
            const duration = Date.now() - start;
            if (process.env.NODE_ENV === "development") {
              console.log(`[Prisma] ${model}.${operation} took ${duration}ms`);
            }
            return result;
          } catch (error) {
            const duration = Date.now() - start;
            console.error(
              `[Prisma Error] ${model}.${operation} failed after ${duration}ms:`,
              error,
            );
            throw error;
          }
        },
      },
    });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
