import { z } from "zod";
import { db } from "@/db";
import { document, documentMember, user } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createId } from "@paralleldrive/cuid2";

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
        const userDocs = await db
          .select({ title: document.title })
          .from(document)
          .where(eq(document.userId, session.user.id));

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

      const [doc] = await db
        .insert(document)
        .values({
          id: createId(),
          userId: session.user.id,
          title: finalTitle,
          content: {},
        })
        .returning({
          id: document.id,
          title: document.title,
          updatedAt: document.updatedAt,
        });

      return doc;
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    // Get both owned documents and shared documents
    const [ownedDocsData, sharedMembersData, favoriteMemberships] =
      await Promise.all([
        db
          .select({
            id: document.id,
            title: document.title,
            content: document.content,
            updatedAt: document.updatedAt,
            userId: document.userId,
            userName: user.name,
            userEmail: user.email,
            userIdField: user.id,
          })
          .from(document)
          .innerJoin(user, eq(document.userId, user.id))
          .where(eq(document.userId, session.user.id))
          .orderBy(desc(document.updatedAt)),
        db
          .select({
            id: documentMember.id,
            documentId: documentMember.documentId,
            userId: documentMember.userId,
            role: documentMember.role,
            favorite: documentMember.favorite,
            docId: document.id,
            docTitle: document.title,
            docContent: document.content,
            docUpdatedAt: document.updatedAt,
            docUserId: document.userId,
            userName: user.name,
            userEmail: user.email,
            userIdField: user.id,
          })
          .from(documentMember)
          .innerJoin(document, eq(documentMember.documentId, document.id))
          .innerJoin(user, eq(document.userId, user.id))
          .where(eq(documentMember.userId, session.user.id)),
        // Get favorite memberships for owned documents (where user favorites their own doc)
        db
          .select({ documentId: documentMember.documentId })
          .from(documentMember)
          .innerJoin(document, eq(documentMember.documentId, document.id))
          .where(
            and(
              eq(documentMember.userId, session.user.id),
              eq(documentMember.favorite, true),
              eq(document.userId, session.user.id),
            ),
          ),
      ]);

    // Create a Set of favorite document IDs for owned documents
    const favoriteOwnedSet = new Set(
      favoriteMemberships.map((m) => m.documentId),
    );

    // Format owned docs with isOwner flag and isFavorite
    const owned = ownedDocsData.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      updatedAt: doc.updatedAt,
      userId: doc.userId,
      user: {
        id: doc.userIdField,
        name: doc.userName,
        email: doc.userEmail,
      },
      isOwner: true,
      isFavorite: favoriteOwnedSet.has(doc.id),
    }));

    // Format shared docs with isOwner flag, role, and isFavorite
    const shared = sharedMembersData.map((member) => ({
      id: member.docId,
      title: member.docTitle,
      content: member.docContent,
      updatedAt: member.docUpdatedAt,
      userId: member.docUserId,
      user: {
        id: member.userIdField,
        name: member.userName,
        email: member.userEmail,
      },
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
      const [docData, membershipData] = await Promise.all([
        db
          .select({
            id: document.id,
            title: document.title,
            content: document.content,
            updatedAt: document.updatedAt,
            userId: document.userId,
            userName: user.name,
            userEmail: user.email,
            userIdField: user.id,
          })
          .from(document)
          .innerJoin(user, eq(document.userId, user.id))
          .where(
            and(
              eq(document.id, input.id),
              eq(document.userId, session.user.id),
            ),
          )
          .limit(1),
        db
          .select({
            id: documentMember.id,
            role: documentMember.role,
            docId: document.id,
            docTitle: document.title,
            docContent: document.content,
            docUpdatedAt: document.updatedAt,
            docUserId: document.userId,
            userName: user.name,
            userEmail: user.email,
            userIdField: user.id,
          })
          .from(documentMember)
          .innerJoin(document, eq(documentMember.documentId, document.id))
          .innerJoin(user, eq(document.userId, user.id))
          .where(
            and(
              eq(documentMember.documentId, input.id),
              eq(documentMember.userId, session.user.id),
            ),
          )
          .limit(1),
      ]);

      if (docData && docData[0]) {
        const doc = docData[0];
        return {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          updatedAt: doc.updatedAt,
          userId: doc.userId,
          user: {
            id: doc.userIdField,
            name: doc.userName,
            email: doc.userEmail,
          },
          isOwner: true,
        };
      }
      if (membershipData && membershipData[0]) {
        const member = membershipData[0];
        return {
          id: member.docId,
          title: member.docTitle,
          content: member.docContent,
          updatedAt: member.docUpdatedAt,
          userId: member.docUserId,
          user: {
            id: member.userIdField,
            name: member.userName,
            email: member.userEmail,
          },
          isOwner: false,
          role: member.role,
        };
      }
      throw new Error("Not found");
    }),

  updateContent: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        content: z
          .string()
          .min(2)
          .max(10 * 1024 * 1024), // stringified JSON, max 10MB
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
        db
          .select({ id: document.id })
          .from(document)
          .where(
            and(
              eq(document.id, input.id),
              eq(document.userId, session.user.id),
            ),
          )
          .limit(1),
        db
          .select({ id: documentMember.id })
          .from(documentMember)
          .where(
            and(
              eq(documentMember.documentId, input.id),
              eq(documentMember.userId, session.user.id),
              eq(documentMember.role, "write"),
            ),
          )
          .limit(1),
      ]);

      if (!owner[0] && !membership[0]) throw new Error("Forbidden");

      const updateData: { title?: string; content: unknown; updatedAt: Date } =
        {
          content: parsed,
          updatedAt: new Date(),
        };
      if (input.title !== undefined) {
        updateData.title = input.title;
      }

      const [updated] = await db
        .update(document)
        .set(updateData)
        .where(eq(document.id, input.id))
        .returning({
          id: document.id,
          updatedAt: document.updatedAt,
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
        db
          .select({ id: document.id })
          .from(document)
          .where(
            and(
              eq(document.id, input.id),
              eq(document.userId, session.user.id),
            ),
          )
          .limit(1),
        db
          .select({ id: documentMember.id })
          .from(documentMember)
          .where(
            and(
              eq(documentMember.documentId, input.id),
              eq(documentMember.userId, session.user.id),
              eq(documentMember.role, "write"),
            ),
          )
          .limit(1),
      ]);

      if (!owner[0] && !membership[0]) throw new Error("Forbidden");

      const [updated] = await db
        .update(document)
        .set({ title: input.title, updatedAt: new Date() })
        .where(eq(document.id, input.id))
        .returning({
          id: document.id,
          title: document.title,
          updatedAt: document.updatedAt,
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
      const [doc] = await db
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.id, input.documentId),
            eq(document.userId, session.user.id),
          ),
        )
        .limit(1);

      if (!doc) throw new Error("Document not found or access denied");

      // Find user by email
      const [invitedUser] = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
        })
        .from(user)
        .where(eq(user.email, input.userEmail))
        .limit(1);

      if (!invitedUser) {
        throw new Error("User not found");
      }

      // Prevent inviting yourself
      if (invitedUser.id === session.user.id) {
        throw new Error("Cannot invite yourself");
      }

      // Create or update membership (upsert)
      const [existing] = await db
        .select()
        .from(documentMember)
        .where(
          and(
            eq(documentMember.documentId, input.documentId),
            eq(documentMember.userId, invitedUser.id),
          ),
        )
        .limit(1);

      let member;
      if (existing) {
        const [updated] = await db
          .update(documentMember)
          .set({ role: input.role })
          .where(eq(documentMember.id, existing.id))
          .returning({
            id: documentMember.id,
            documentId: documentMember.documentId,
            userId: documentMember.userId,
            role: documentMember.role,
            favorite: documentMember.favorite,
          });

        if (!updated) {
          throw new Error("Failed to update membership");
        }

        member = {
          ...updated,
          user: {
            id: invitedUser.id,
            name: invitedUser.name,
            email: invitedUser.email,
          },
        };
      } else {
        const [created] = await db
          .insert(documentMember)
          .values({
            id: createId(),
            documentId: input.documentId,
            userId: invitedUser.id,
            role: input.role,
            invitedBy: session.user.id,
          })
          .returning({
            id: documentMember.id,
            documentId: documentMember.documentId,
            userId: documentMember.userId,
            role: documentMember.role,
            favorite: documentMember.favorite,
          });

        if (!created) {
          throw new Error("Failed to create membership");
        }

        member = {
          ...created,
          user: {
            id: invitedUser.id,
            name: invitedUser.name,
            email: invitedUser.email,
          },
        };
      }

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
      const [doc] = await db
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.id, input.documentId),
            eq(document.userId, session.user.id),
          ),
        )
        .limit(1);

      if (!doc) throw new Error("Document not found or access denied");

      // Remove membership
      await db
        .delete(documentMember)
        .where(
          and(
            eq(documentMember.documentId, input.documentId),
            eq(documentMember.userId, input.userId),
          ),
        );

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
        db
          .select({ id: document.id })
          .from(document)
          .where(
            and(
              eq(document.id, input.documentId),
              eq(document.userId, session.user.id),
            ),
          )
          .limit(1),
        db
          .select({ id: documentMember.id })
          .from(documentMember)
          .where(
            and(
              eq(documentMember.documentId, input.documentId),
              eq(documentMember.userId, session.user.id),
            ),
          )
          .limit(1),
      ]);

      if (!doc[0] && !membership[0]) {
        throw new Error("Document not found or access denied");
      }

      // Get all members
      const membersData = await db
        .select({
          id: documentMember.id,
          documentId: documentMember.documentId,
          userId: documentMember.userId,
          role: documentMember.role,
          favorite: documentMember.favorite,
          userName: user.name,
          userEmail: user.email,
          userIdField: user.id,
        })
        .from(documentMember)
        .innerJoin(user, eq(documentMember.userId, user.id))
        .where(eq(documentMember.documentId, input.documentId));

      const members = membersData.map((m) => ({
        id: m.id,
        documentId: m.documentId,
        userId: m.userId,
        role: m.role,
        favorite: m.favorite,
        user: {
          id: m.userIdField,
          name: m.userName,
          email: m.userEmail,
        },
      }));

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
      const [doc] = await db
        .select({ id: document.id })
        .from(document)
        .where(
          and(eq(document.id, input.id), eq(document.userId, session.user.id)),
        )
        .limit(1);

      if (!doc) {
        throw new Error("Document not found or access denied");
      }

      // Delete the document (cascade will handle related records)
      await db.delete(document).where(eq(document.id, input.id));

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
        db
          .select({ id: document.id })
          .from(document)
          .where(
            and(
              eq(document.id, input.documentId),
              eq(document.userId, session.user.id),
            ),
          )
          .limit(1),
        db
          .select({ favorite: documentMember.favorite })
          .from(documentMember)
          .where(
            and(
              eq(documentMember.documentId, input.documentId),
              eq(documentMember.userId, session.user.id),
            ),
          )
          .limit(1),
      ]);

      // Verify user has access (either owns the document or has membership)
      if (!doc[0] && !membership[0]) {
        throw new Error("Document not found or access denied");
      }

      // If membership exists (for shared docs or owner's favorite entry), update it
      if (membership[0]) {
        const updated = await db
          .update(documentMember)
          .set({
            favorite: !membership[0].favorite,
          })
          .where(
            and(
              eq(documentMember.documentId, input.documentId),
              eq(documentMember.userId, session.user.id),
            ),
          )
          .returning({ favorite: documentMember.favorite });

        if (!updated[0]) {
          throw new Error("Failed to update favorite");
        }

        return { isFavorite: updated[0].favorite };
      }

      // If user owns the document but no membership exists, create one for favorite
      if (doc[0]) {
        const created = await db
          .insert(documentMember)
          .values({
            id: createId(),
            documentId: input.documentId,
            userId: session.user.id,
            role: "read", // Default role for owner's favorite entry
            invitedBy: session.user.id,
            favorite: true,
          })
          .returning({ favorite: documentMember.favorite });

        if (!created[0]) {
          throw new Error("Failed to create favorite");
        }

        return { isFavorite: created[0].favorite };
      }

      throw new Error("Unexpected error");
    }),
});
