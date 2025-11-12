"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { toastManager } from "@/components/ui/toast";

export function CreateDocumentButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const utils = api.useUtils?.();
  const createMutation = api.document.create.useMutation({
    onError: (error) => {
      toastManager.add({
        title: error.message ?? "Failed to create document. Please try again.",
        type: "error",
      });
    },
  });

  async function handleCreate() {
    if (creating) return;
    try {
      setCreating(true);
      const doc = await createMutation.mutateAsync({});
      if (!doc) {
        throw new Error("Failed to create document");
      }
      await utils?.document.getAll.invalidate();
      router.push(`/editor/${doc.id}`);
    } catch (error) {
      // Error already handled by onError callback
    } finally {
      setCreating(false);
    }
  }

  return (
    <button
      className="btn btn-primary"
      onClick={handleCreate}
      disabled={creating}
      aria-disabled={creating}
      type="button"
    >
      {creating ? "Creating…" : "New Document"}
    </button>
  );
}
