"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export function InviteUserButton({ documentId }: { documentId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"read" | "write">("write");
  const [isOpen, setIsOpen] = useState(false);
  const utils = api.useUtils?.();
  const inviteMutation = api.document.inviteUser.useMutation({
    onSuccess: () => {
      toast.success("User invited successfully");
      setEmail("");
      setIsOpen(false);
      void utils?.document.getMembers.invalidate({ documentId });
      void utils?.document.getAll.invalidate();
    },
    onError: (error: { message?: string }) => {
      toast.error(
        error?.message ?? "Failed to invite user. Please try again.",
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMutation.mutate({ documentId, userEmail: email.trim(), role });
  }

  if (!isOpen) {
    return (
      <button
        className="btn btn-sm btn-outline"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Invite User
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="user@example.com"
        className="input input-sm input-bordered flex-1"
        required
        disabled={inviteMutation.isPending}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "read" | "write")}
        className="select select-sm select-bordered"
        disabled={inviteMutation.isPending}
      >
        <option value="read">Read</option>
        <option value="write">Write</option>
      </select>
      <button
        type="submit"
        className="btn btn-sm btn-primary"
        disabled={inviteMutation.isPending || !email.trim()}
      >
        {inviteMutation.isPending ? "Inviting..." : "Invite"}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => {
          setIsOpen(false);
          setEmail("");
        }}
        disabled={inviteMutation.isPending}
      >
        Cancel
      </button>
    </form>
  );
}


