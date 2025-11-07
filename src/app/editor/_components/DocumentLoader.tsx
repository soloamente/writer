"use client";

import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentLoaderProps {
  message?: string;
  variant?: "room" | "document" | "editor";
}

/**
 * DocumentLoader component provides a polished loading experience
 * for room initialization and document loading states.
 * Uses fast animations (200-300ms) with ease-out timing per workspace rules.
 */
export function DocumentLoader({
  message,
  variant = "document",
}: DocumentLoaderProps) {
  const defaultMessages = {
    room: "Initializing collaboration room…",
    document: "Loading document…",
    editor: "Preparing editor…",
  };

  const displayMessage = message ?? defaultMessages[variant];

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background">
      <div className="flex w-full max-w-4xl flex-col items-center gap-8 px-8">
        {/* Spinner and message */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative" style={{ willChange: "transform" }}>
            <Spinner className="size-8 text-foreground/60" />
          </div>
          <p
            className="text-sm font-medium text-foreground/70"
            style={{
              transition: "opacity 200ms cubic-bezier(.25, .46, .45, .94)",
            }}
          >
            {displayMessage}
          </p>
        </div>

        {/* Skeleton preview of editor */}
        <div className="w-full space-y-4 animate-fade-in">
          {/* Title skeleton */}
          <Skeleton className="h-8 w-64" />

          {/* Editor content skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-4/6" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * RoomInitializingLoader - Specific loader for room initialization
 */
export function RoomInitializingLoader() {
  return <DocumentLoader variant="room" />;
}

/**
 * DocumentLoadingLoader - Specific loader for document loading
 */
export function DocumentLoadingLoader() {
  return <DocumentLoader variant="document" />;
}

/**
 * EditorPreparingLoader - Specific loader for editor preparation
 */
export function EditorPreparingLoader() {
  return <DocumentLoader variant="editor" />;
}

