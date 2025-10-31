"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from "@liveblocks/react/suspense";

const DEFAULT_ROOM_ID = "my-room";

// Types and runtime guards to avoid unsafe `any` from JSON parsing
interface LiveblocksUser {
  name: string;
  color: string;
  email: string;
  avatar: string | undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isLiveblocksCompatibleArray(value: unknown): value is Array<{
  name: string;
  color: string;
  email: string;
  avatar?: unknown;
}> {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        "name" in v &&
        typeof (v as { name?: unknown }).name === "string" &&
        "color" in v &&
        typeof (v as { color?: unknown }).color === "string" &&
        "email" in v &&
        typeof (v as { email?: unknown }).email === "string",
    )
  );
}

/**
 * Room component that provides Liveblocks context for collaborative editing
 * Includes user resolution and mention suggestions for the Text Editor
 */
export function Room({
  children,
  roomId,
}: {
  children: ReactNode;
  roomId?: string;
}) {
  const [isRoomReady, setIsRoomReady] = useState(false);

  // Initialize the room with permissions when component mounts
  useEffect(() => {
    async function initializeRoom() {
      try {
        const response = await fetch("/api/liveblocks-room", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId: roomId ?? DEFAULT_ROOM_ID }),
        });

        if (response.ok) {
          setIsRoomReady(true);
        } else {
          console.error("Failed to initialize room:", await response.text());
          // Still try to connect even if room creation fails
          setIsRoomReady(true);
        }
      } catch (error) {
        console.error("Error initializing room:", error);
        // Still try to connect even if room creation fails
        setIsRoomReady(true);
      }
    }

    void initializeRoom();
  }, [roomId]);

  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      resolveUsers={async ({ userIds }) => {
        // Fetch user information for the provided user IDs
        // This is used to display user names, colors, and avatars in cursors
        if (userIds.length === 0) {
          return [];
        }

        try {
          const response = await fetch(
            `/api/users?userIds=${userIds.join(",")}`,
          );
          if (!response.ok) {
            console.error("Failed to fetch users");
            return [];
          }
          const data: unknown = await response.json();
          if (isLiveblocksCompatibleArray(data)) {
            return (
              data as Array<{
                name: string;
                color: string;
                email: string;
                avatar?: unknown;
              }>
            ).map(
              (u) =>
                ({
                  name: u.name,
                  color: u.color,
                  email: u.email,
                  avatar: typeof u.avatar === "string" ? u.avatar : undefined,
                }) satisfies LiveblocksUser,
            );
          }
          console.error("Invalid users payload shape");
          return [];
        } catch (error) {
          console.error("Error fetching users:", error);
          return [];
        }
      }}
      resolveMentionSuggestions={async ({ text, roomId: _roomId }) => {
        // Search for users to suggest when typing @ mentions
        // If text is empty, return all users (you may want to limit this)
        try {
          const queryParam = text ? `?text=${encodeURIComponent(text)}` : "";
          const response = await fetch(`/api/users${queryParam}`);
          if (!response.ok) {
            console.error("Failed to fetch mention suggestions");
            return [];
          }
          // The endpoint returns user IDs when searching
          const data: unknown = await response.json();
          if (isStringArray(data)) {
            return data;
          }
          console.error("Invalid mention suggestions payload shape");
          return [];
        } catch (error) {
          console.error("Error fetching mention suggestions:", error);
          return [];
        }
      }}
    >
      <RoomProvider id={roomId ?? DEFAULT_ROOM_ID}>
        <ClientSideSuspense fallback={<div>Loading…</div>}>
          {isRoomReady ? children : <div>Initializing room…</div>}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
