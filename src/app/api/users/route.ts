import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
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

      const users = await prisma.user.findMany({
        where: {
          id: {
            in: ids,
          },
          // Don't return banned users
          banned: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

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
      const whereClause = text
        ? {
            banned: false,
            OR: [
              {
                name: {
                  contains: text,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: text,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {
            banned: false,
          };

      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
        },
        take: text ? 10 : 50, // Limit results: 10 when searching, 50 when showing all
      });

      // Return just the user IDs for mention suggestions
      return Response.json(users.map((user) => user.id));
    }

    // If neither userIds nor text is provided, return empty array
    return Response.json([]);
  } catch (error) {
    console.error("Users API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

