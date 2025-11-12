import { z } from "zod";
import prisma from "@/lib/prisma";
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
        const existingUser = await prisma.user.findFirst({
          where: {
            username: input.username,
            id: { not: session.user.id },
          },
          select: { id: true },
        });
        if (existingUser) {
          throw new Error("Username is already taken");
        }
      }

      const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.username !== undefined && { username: input.username }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          updatedAt: true,
        },
      });

      return updated;
    }),
});





