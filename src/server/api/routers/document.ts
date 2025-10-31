import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const documentRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ ctx }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user) {
        throw new Error("Unauthorized");
      }
      const doc = await prisma.document.create({
        data: {
          userId: session.user.id,
          title: "Untitled",
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
    const [ownedDocs, sharedMembers] = await Promise.all([
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

    // Format owned docs with isOwner flag
    const owned = ownedDocs.map((doc) => ({
      ...doc,
      isOwner: true,
    }));

    // Format shared docs with isOwner flag and role
    const shared = sharedMembers.map((member) => ({
      ...member.document,
      isOwner: false,
      role: member.role,
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
          content: parsed as Record<string, unknown>,
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
});


