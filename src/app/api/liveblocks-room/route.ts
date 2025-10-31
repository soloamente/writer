import { Liveblocks } from "@liveblocks/node";
import { auth } from "@/lib/auth";
import { env } from "@/env";
import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

const liveblocks = new Liveblocks({
  secret: env.LIVEBLOCKS_SECRET_KEY,
});

/**
 * API endpoint to create or update a Liveblocks room with proper permissions
 * This ensures the authenticated user has access to the room
 */
export async function POST(request: NextRequest) {
  try {
    // Get the current session from Better Auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { user } = session;
    const { roomId } = await request.json();

    if (!roomId || typeof roomId !== "string") {
      return new Response(
        JSON.stringify({ error: "roomId is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Extract document ID from room ID (format: writer-doc-{documentId})
    const documentId = roomId.replace("writer-doc-", "");
    
    // Check user's permission level for this document
    const [doc, membership] = await Promise.all([
      prisma.document.findFirst({
        where: { id: documentId, userId: user.id },
        select: { id: true },
      }),
      prisma.documentMember.findFirst({
        where: {
          documentId,
          userId: user.id,
        },
        select: { role: true },
      }),
    ]);

    const isOwner = !!doc;
    const canWrite = isOwner || membership?.role === "write";
    // Liveblocks requires exact permission sets:
    // - write: ["room:write"]
    // - read: ["room:read", "room:presence:write"]
    const userPermissions = canWrite
      ? ([("room:write" as const)] as readonly ["room:write"]) 
      : (["room:read", "room:presence:write"] as const);

    // Check if room exists, if not create it with permissions
    let roomExists = false;
    try {
      await liveblocks.getRoom(roomId);
      roomExists = true;
    } catch (error: any) {
      // Room doesn't exist if we get a 404 or similar
      if (error?.status !== 404) {
        // Some other error occurred, rethrow it
        throw error;
      }
    }

    if (!roomExists) {
      // Room doesn't exist, create it
      try {
        await liveblocks.createRoom(roomId, {
          // Give the current user appropriate access based on their permission
          usersAccesses: {
            [user.id]: userPermissions as unknown as string[],
          },
          // Make the room private by default; grant explicit access via usersAccesses
          defaultAccesses: [],
        });
      } catch (error: any) {
        // If room already exists (409), that's fine - just update permissions
        if (error?.status !== 409) {
          throw error;
        }
      }
    }

    // Ensure current user has appropriate access (for both new and existing rooms)
    await liveblocks.updateRoom(roomId, {
      usersAccesses: {
        [user.id]: userPermissions as unknown as string[],
      },
    });

    return Response.json({ success: true, roomId });
  } catch (error) {
    console.error("Room creation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}



