"use client";

import { api } from "@/trpc/react";
import { toast } from "sonner";

export function DocumentMembers({
  documentId,
  isOwner,
}: {
  documentId: string;
  isOwner: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const { data: members, isLoading } = api.document.getMembers.useQuery({
    documentId,
  });
  const utils = api.useUtils?.();
  const removeMutation = api.document.removeAccess.useMutation({
    onSuccess: () => {
      toast.success("User removed");
      void utils?.document.getMembers.invalidate({ documentId });
      void utils?.document.getAll.invalidate();
    },
    onError: (error: { message?: string }) => {
      toast.error(
        error?.message ?? "Failed to remove user. Please try again.",
      );
    },
  });

  if (!isOwner) return null;

  if (isLoading) {
    return <div className="text-sm opacity-70">Loading members...</div>;
  }

  if (!members || members.length === 0) {
    return (
      <div className="text-sm opacity-70">No members yet. Invite someone!</div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Members</h3>
      <ul className="space-y-1">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between rounded p-2 text-sm hover:bg-base-200"
          >
            <div>
              <span className="font-medium">{member.user.name}</span>
              <span className="ml-2 text-xs opacity-70">
                ({member.user.email}) - {member.role}
              </span>
            </div>
            <button
              className="btn btn-xs btn-ghost text-error"
              onClick={() => {
                if (
                  confirm(
                    `Remove ${member.user.name} from this document?`,
                  )
                ) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                  removeMutation.mutate({
                    documentId,
                    userId: member.userId,
                  });
                }
              }}
              disabled={removeMutation.isPending}
              type="button"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


