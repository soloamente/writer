import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq, and, or, like, inArray, not } from "drizzle-orm";
import { type NextRequest } from "next/server";

/**
 * Helper function to generate a consistent color based on user ID
 * This ensures each user gets the same color across sessions
 */
function getUserColor(userId: string): string {
  const colors = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#14b8a6", // teal
  ];
  const colorIndex = parseInt(userId.slice(-2) || "0", 16) % colors.length;
  return colors[colorIndex] ?? colors[0]!;
}

/**
 * API endpoint to fetch users by IDs for Liveblocks resolveUsers
 * Also supports search for resolveMentionSuggestions
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the session to ensure the user is authenticated
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userIds = searchParams.get("userIds");
    const text = searchParams.get("text"); // For mention suggestions

    // If userIds are provided, fetch those specific users
    if (userIds) {
      const ids = userIds.split(",").filter(Boolean);
      if (ids.length === 0) {
        return Response.json([]);
      }

      const users = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        })
        .from(user)
        .where(and(inArray(user.id, ids), eq(user.banned, false)));

      // Return users in the same order as requested IDs
      const userMap = new Map(users.map((user) => [user.id, user]));
      const orderedUsers = ids
        .map((id) => userMap.get(id))
        .filter((user): user is NonNullable<typeof user> => user !== undefined)
        .map((user) => ({
          name: user.name ?? user.email,
          color: getUserColor(user.id),
          avatar: user.image ?? undefined,
          email: user.email,
        }));

      return Response.json(orderedUsers);
    }

    // If text is provided (including empty string), search for users
    if (text !== null) {
      const users = text
        ? await db
            .select({ id: user.id })
            .from(user)
            .where(
              and(
                eq(user.banned, false),
                or(
                  like(user.name, `%${text}%`),
                  like(user.email, `%${text}%`)
                )
              )
            )
            .limit(10)
        : await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.banned, false))
            .limit(50);

      // Return just the user IDs for mention suggestions
      return Response.json(users.map((u) => u.id));
    }

    // If neither userIds nor text is provided, return empty array
    return Response.json([]);
  } catch (error) {
    console.error("Users API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

