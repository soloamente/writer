import { z } from "zod";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const documentRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // If no title provided, generate next available "Untitled N" title
      let finalTitle = input.title;
      if (!finalTitle) {
        // Get all documents owned by the user
        const userDocs = await prisma.document.findMany({
          where: { userId: session.user.id },
          select: { title: true },
        });

        // Extract all "Untitled" titles and their numbers
        const untitledPattern = /^Untitled(\s+(\d+))?$/i;
        const untitledNumbers: number[] = [];

        for (const doc of userDocs) {
          const match = doc.title.match(untitledPattern);
          if (match) {
            if (match[2]) {
              // Has a number (e.g., "Untitled 2")
              untitledNumbers.push(parseInt(match[2], 10));
            } else {
              // Just "Untitled" (counts as 1)
              untitledNumbers.push(1);
            }
          }
        }

        // Find the next available number
        if (untitledNumbers.length === 0) {
          // No untitled documents exist, use "Untitled"
          finalTitle = "Untitled";
        } else {
          // Sort numbers and find the first gap or next number
          untitledNumbers.sort((a, b) => a - b);
          let nextNumber = 1;
          for (const num of untitledNumbers) {
            if (num === nextNumber) {
              nextNumber++;
            } else {
              break;
            }
          }
          finalTitle = nextNumber === 1 ? "Untitled" : `Untitled ${nextNumber}`;
        }
      }

      const doc = await prisma.document.create({
        data: {
          userId: session.user.id,
          title: finalTitle,
          content: {},
        },
        select: { id: true, title: true, updatedAt: true },
      });
      return doc;
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });
    if (!session?.user) {
      throw new Error("Unauthorized");
    }
    // Get both owned documents and shared documents
    const [ownedDocs, sharedMembers, favoriteMemberships] = await Promise.all([
      prisma.document.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.documentMember.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          documentId: true,
          userId: true,
          role: true,
          favorite: true,
          document: {
            select: {
              id: true,
              title: true,
              content: true,
              updatedAt: true,
              userId: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      // Get favorite memberships for owned documents (where user favorites their own doc)
      prisma.documentMember.findMany({
        where: {
          userId: session.user.id,
          favorite: true,
          document: {
            userId: session.user.id, // Owned documents
          },
        },
        select: { documentId: true },
      }),
    ]);

    // Create a Set of favorite document IDs for owned documents
    const favoriteOwnedSet = new Set(
      favoriteMemberships.map((m) => m.documentId),
    );

    // Format owned docs with isOwner flag and isFavorite
    const owned = ownedDocs.map((doc) => ({
      ...doc,
      isOwner: true,
      isFavorite: favoriteOwnedSet.has(doc.id),
    }));

    // Format shared docs with isOwner flag, role, and isFavorite
    const shared = sharedMembers.map((member) => ({
      ...member.document,
      isOwner: false,
      role: member.role,
      isFavorite: member.favorite,
    }));

    // Combine and sort by updatedAt
    const allDocs = [...owned, ...shared].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    return allDocs;
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }
      // Check if user owns the document or has access via membership
      const [doc, membership] = await Promise.all([
        prisma.document.findFirst({
          where: { id: input.id, userId: session.user.id },
          select: {
            id: true,
            title: true,
            content: true,
            updatedAt: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.documentMember.findFirst({
          where: {
            documentId: input.id,
            userId: session.user.id,
          },
          include: {
            document: {
              select: {
                id: true,
                title: true,
                content: true,
                updatedAt: true,
                userId: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
      ]);

      if (doc) {
        return { ...doc, isOwner: true };
      }
      if (membership) {
        return { ...membership.document, isOwner: false, role: membership.role };
      }
      throw new Error("Not found");
    }),

  updateContent: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        content: z.string().min(2).max(10 * 1024 * 1024), // stringified JSON, max 10MB
        title: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Validate content size (10MB limit)
      if (input.content.length > 10 * 1024 * 1024) {
        throw new Error("Content too large. Maximum size is 10MB.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(input.content);
      } catch {
        throw new Error("Invalid content JSON");
      }

      // Check if user owns the document or has write access
      const [owner, membership] = await Promise.all([
        prisma.document.findFirst({
          where: { id: input.id, userId: session.user.id },
          select: { id: true },
        }),
        prisma.documentMember.findFirst({
          where: {
            documentId: input.id,
            userId: session.user.id,
            role: "write",
          },
          select: { id: true },
        }),
      ]);
      if (!owner && !membership) throw new Error("Forbidden");

      const updated = await prisma.document.update({
        where: { id: input.id },
        data: {
          title: input.title ?? undefined,
          content: parsed as Prisma.InputJsonValue,
        },
        select: { id: true, updatedAt: true },
      });

      return updated;
    }),

  updateTitle: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(200),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Check if user owns the document or has write access
      const [owner, membership] = await Promise.all([
        prisma.document.findFirst({
          where: { id: input.id, userId: session.user.id },
          select: { id: true },
        }),
        prisma.documentMember.findFirst({
          where: { documentId: input.id, userId: session.user.id, role: "write" },
          select: { id: true },
        }),
      ]);
      if (!owner && !membership) throw new Error("Forbidden");

      const updated = await prisma.document.update({
        where: { id: input.id },
        data: { title: input.title },
        select: { id: true, title: true, updatedAt: true },
      });

      return updated;
    }),

  inviteUser: publicProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        userEmail: z.string().email(),
        role: z.enum(["read", "write"]).default("read"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Verify user owns the document
      const doc = await prisma.document.findFirst({
        where: { id: input.documentId, userId: session.user.id },
        select: { id: true },
      });
      if (!doc) throw new Error("Document not found or access denied");

      // Find user by email
      const invitedUser = await prisma.user.findUnique({
        where: { email: input.userEmail },
        select: { id: true, name: true, email: true },
      });
      if (!invitedUser) {
        throw new Error("User not found");
      }

      // Prevent inviting yourself
      if (invitedUser.id === session.user.id) {
        throw new Error("Cannot invite yourself");
      }

      // Create or update membership
      const member = await prisma.documentMember.upsert({
        where: {
          documentId_userId: {
            documentId: input.documentId,
            userId: invitedUser.id,
          },
        },
        create: {
          documentId: input.documentId,
          userId: invitedUser.id,
          role: input.role,
          invitedBy: session.user.id,
        },
        update: {
          role: input.role,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return member;
    }),

  removeAccess: publicProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Verify user owns the document
      const doc = await prisma.document.findFirst({
        where: { id: input.documentId, userId: session.user.id },
        select: { id: true },
      });
      if (!doc) throw new Error("Document not found or access denied");

      // Remove membership
      await prisma.documentMember.deleteMany({
        where: {
          documentId: input.documentId,
          userId: input.userId,
        },
      });

      return { success: true };
    }),

  getMembers: publicProcedure
    .input(z.object({ documentId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Check if user owns or has access to the document
      const [doc, membership] = await Promise.all([
        prisma.document.findFirst({
          where: { id: input.documentId, userId: session.user.id },
          select: { id: true },
        }),
        prisma.documentMember.findFirst({
          where: {
            documentId: input.documentId,
            userId: session.user.id,
          },
          select: { id: true },
        }),
      ]);

      if (!doc && !membership) {
        throw new Error("Document not found or access denied");
      }

      // Get all members
      const members = await prisma.documentMember.findMany({
        where: { documentId: input.documentId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return members;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Verify user owns the document
      const doc = await prisma.document.findFirst({
        where: { id: input.id, userId: session.user.id },
        select: { id: true },
      });

      if (!doc) {
        throw new Error("Document not found or access denied");
      }

      // Delete the document (cascade will handle related records)
      await prisma.document.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  toggleFavorite: publicProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }

      // Check if user owns the document or has access via membership
      const [doc, membership] = await Promise.all([
        prisma.document.findFirst({
          where: { id: input.documentId, userId: session.user.id },
          select: { id: true },
        }),
        prisma.documentMember.findUnique({
          where: {
            documentId_userId: {
              documentId: input.documentId,
              userId: session.user.id,
            },
          },
          select: { favorite: true },
        }),
      ]);

      // Verify user has access (either owns the document or has membership)
      if (!doc && membership === null) {
        throw new Error("Document not found or access denied");
      }

      // If membership exists (for shared docs or owner's favorite entry), update it
      if (membership !== null) {
        const updated = await prisma.documentMember.update({
          where: {
            documentId_userId: {
              documentId: input.documentId,
              userId: session.user.id,
            },
          },
          data: {
            favorite: !membership.favorite,
          },
        });
        return { isFavorite: updated.favorite };
      }

      // If user owns the document but no membership exists, create one for favorite
      if (doc) {
        const created = await prisma.documentMember.create({
          data: {
            documentId: input.documentId,
            userId: session.user.id,
            role: "read", // Default role for owner's favorite entry
            invitedBy: session.user.id,
            favorite: true,
          },
        });
        return { isFavorite: created.favorite };
      }

      throw new Error("Unexpected error");
    }),
});


