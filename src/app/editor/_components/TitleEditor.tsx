"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export function TitleEditor({
  documentId,
  initialTitle,
  canEdit = true,
}: {
  documentId: string;
  initialTitle: string;
  canEdit?: boolean;
}) {
  const [title, setTitle] = useState<string>(initialTitle);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(initialTitle);

  const updateMutation = api.document.updateTitle.useMutation({
    onError: (error) => {
      toast.error(error.message ?? "Failed to save title");
    },
    onSuccess: () => {
      toast.success("Title saved", {
        id: `title-saved-${documentId}`,
        duration: 1500,
      });
    },
  });

  // Debounced autosave on title change
  useEffect(() => {
    if (!canEdit || title.trim().length === 0 || title === lastSavedRef.current)
      return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastSavedRef.current = title;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      updateMutation.mutate({ id: documentId, title: title.trim() });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, documentId, updateMutation, canEdit]);

  return (
    <input
      className="input input-bordered w-full text-xl font-semibold"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Untitled"
      aria-label="Document title"
      readOnly={!canEdit}
      disabled={!canEdit}
    />
  );
}


