import { Liveblocks } from "@liveblocks/node";
import { auth } from "@/lib/auth";
import { env } from "@/env";
import { type NextRequest } from "next/server";

const liveblocks = new Liveblocks({
  secret: env.LIVEBLOCKS_SECRET_KEY,
});

/**
 * Liveblocks authentication endpoint
 * This endpoint verifies the user's Better Auth session and creates a Liveblocks token
 * for them. The token allows the user to connect to Liveblocks rooms.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the current session from Better Auth
    // Better Auth will verify the session cookie automatically
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Debug logging (remove in production)
    if (!session?.user) {
      console.log("No session found. Headers:", {
        cookie: request.headers.get("cookie")?.substring(0, 100),
        "set-cookie": request.headers.get("set-cookie"),
      });
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please sign in first" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { user } = session;

    // Generate a consistent color based on user ID
    // This ensures each user gets the same color across sessions
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
    const colorIndex = parseInt(user.id.slice(-2) || "0", 16) % colors.length;
    const userColor = colors[colorIndex] ?? colors[0]!;

    // Identify the user in Liveblocks and get a token
    // This creates an ID token that Liveblocks uses for authentication
    const { status, body } = await liveblocks.identifyUser(
      {
        userId: user.id,
        groupIds: [], // Optional: add group IDs if you have groups
      },
      {
        // Pass user metadata that will be available in Liveblocks
        // name, color, and avatar are required for Text Editor cursors
        userInfo: {
          name: user.name ?? user.email,
          color: userColor,
          avatar: user.image ?? undefined,
          email: user.email,
        },
      },
    );

    return new Response(body, { status });
  } catch (error) {
    console.error("Liveblocks auth error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
