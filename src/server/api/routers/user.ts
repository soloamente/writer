import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  update: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100).optional(),
        username: z.string().trim().min(1).max(50).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Check if username is already taken by another user
      if (input.username !== undefined && input.username !== null) {
        const [existingUser] = await db
          .select({ id: user.id })
          .from(user)
          .where(
            and(
              eq(user.username, input.username),
              ne(user.id, session.user.id)
            )
          )
          .limit(1);

        if (existingUser) {
          throw new Error("Username is already taken");
        }
      }

      const updateData: { name?: string; username?: string | null; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.username !== undefined) {
        updateData.username = input.username;
      }

      const [updated] = await db
        .update(user)
        .set(updateData)
        .where(eq(user.id, session.user.id))
        .returning({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          updatedAt: user.updatedAt,
        });

      return updated;
    }),
});





