"use client";

import { useThreads } from "@liveblocks/react/suspense";
import {
  AnchoredThreads,
  FloatingComposer,
  FloatingThreads,
} from "@liveblocks/react-lexical";

export function Threads() {
  // The room should be initialized before threads are rendered
  // If there's an error, it will be caught by the Suspense boundary
  const { threads } = useThreads();

  return (
    <>
      <div className="anchored-threads">
        <AnchoredThreads threads={threads} />
      </div>
      <FloatingThreads className="floating-threads" threads={threads} />
      <FloatingComposer className="floating-composer" />
    </>
  );
}
