"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCommandPaletteState,
  setKeyboardShortcutsOpen,
} from "@/hooks/use-keyboard-shortcuts";
import { Command } from "cmdk";
import { api } from "@/trpc/react";
import {
  Search,
  Home,
  Plus,
  Settings,
  FileText,
  Users,
  Edit,
  Eye,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Label } from "@/components/ui/label";
import {
  FaAngleDown,
  FaAngleUp,
  FaQuestion,
  FaTurnDown,
} from "react-icons/fa6";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { toast } from "sonner";
import { toggleEditMode, getEditMode } from "@/app/editor/_components/editor";

interface CommandPaletteProps {
  documentId: string;
  documentTitle: string;
  isOwner: boolean;
  canWrite: boolean;
}

export function CommandPalette({
  documentId,
  documentTitle: _documentTitle,
  isOwner,
  canWrite,
}: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useCommandPaletteState();

  // Fetch documents for navigation
  const { data: documents } = api.document.getAll.useQuery(undefined, {
    enabled: open,
  });

  // Fetch members
  const { data: members } = api.document.getMembers.useQuery(
    { documentId },
    { enabled: open && isOwner },
  );

  const createMutation = api.document.create.useMutation({
    onSuccess: (doc) => {
      router.push(`/editor/${doc.id}`);
      setOpen(false);
      toast.success("Document created");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create document");
    },
  });

  // Prefetch all routes when component mounts for instant navigation
  useEffect(() => {
    if (documentId) {
      // Prefetch document routes
      router.prefetch(`/editor/${documentId}`);
    }
    router.prefetch("/editor");
  }, [router, documentId]);

  // Note: Cmd+K / Ctrl+K is now handled by the global keyboard shortcuts hook
  // This prevents conflicts and ensures consistent behavior
  const navigate = (path: string) => {
    // Navigate immediately, close in parallel
    router.push(path);
    setOpen(false);
  };

  const createNewDocument = () => {
    // Trigger immediately, close in parallel
    createMutation.mutate({});
  };

  const navigateToDocument = (docId: string) => {
    router.push(`/editor/${docId}`);
    setOpen(false);
  };

  const openKeyboardShortcuts = () => {
    // Open keyboard shortcuts dialog and close command palette
    setKeyboardShortcutsOpen(true);
    setOpen(false);
  };

  const handleToggleEditMode = () => {
    const result = toggleEditMode(documentId, canWrite);
    if (result === null) {
      toast.error("Editor not available");
    } else if (result === false) {
      toast.error("You don't have permission to edit this document");
    } else {
      setIsCurrentlyEditable(result);
      const mode = result ? "Edit" : "Read";
      toast.success(`Switched to ${mode} mode`, { duration: 1500 });
      setOpen(false);
    }
  };

  // Track current editable state and refresh when palette opens
  const [isCurrentlyEditable, setIsCurrentlyEditable] = useState(canWrite);

  useEffect(() => {
    if (open) {
      // Refresh editable state when palette opens
      const currentMode = getEditMode(documentId);
      setIsCurrentlyEditable(currentMode ?? canWrite);
    }
  }, [open, documentId, canWrite]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 max-w-[640px] overflow-hidden p-0 shadow-xl"
        onEscapeKeyDown={() => setOpen(false)}
        onInteractOutside={() => setOpen(false)}
        data-testid="command-palette"
      >
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>

        <Command className="overflow-hidden">
          {/* Search Input */}
          <Label className="bg-card mx-2 my-2 flex items-center gap-2 rounded-2xl border px-4 py-3">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" />
            <Command.Input
              placeholder="Type a command or search..."
              className="placeholder:text-muted-foreground flex w-full text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </Label>

          {/* Command List */}
          <Command.List className="custom-scrollbar mb-2 max-h-[400px] overflow-x-hidden overflow-y-auto p-2">
            <Command.Empty className="text-muted-foreground py-8 text-center text-sm">
              No results found.
            </Command.Empty>

            {/* Actions */}
            <Command.Group
              heading="Actions"
              className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
            >
              <Command.Item
                onSelect={createNewDocument}
                className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="flex-1">Create New Document</span>
                <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none items-center justify-center rounded-md px-1.5 font-normal select-none">
                  C
                </Kbd>
              </Command.Item>

              {canWrite && (
                <Command.Item
                  onSelect={() => {
                    // Trigger title edit event
                    const event = new CustomEvent("open-title-edit");
                    window.dispatchEvent(event);
                    setOpen(false);
                  }}
                  className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="flex-1">Edit Title</span>
                </Command.Item>
              )}

              <Command.Item
                onSelect={handleToggleEditMode}
                className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                {isCurrentlyEditable ? (
                  <>
                    <Eye className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Switch to Read Mode</span>
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {canWrite
                        ? "Switch to Edit Mode"
                        : "Switch to Edit Mode (No Permission)"}
                    </span>
                  </>
                )}
              </Command.Item>

              {isOwner && (
                <Command.Item
                  onSelect={() => {
                    // Trigger share dialog event
                    const event = new CustomEvent("open-share-dialog");
                    window.dispatchEvent(event);
                    setOpen(false);
                  }}
                  className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="flex-1">Share Document</span>
                </Command.Item>
              )}
            </Command.Group>

            {/* Navigation */}
            <Command.Group
              heading="Navigation"
              className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
            >
              <Command.Item
                onSelect={() => navigate("/editor")}
                onMouseEnter={() => router.prefetch("/editor")}
                className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <Home className="h-4 w-4 shrink-0" />
                <span className="flex-1">Documents List</span>
                <Kbd className="bg-background group-aria-selected:bg-accent-foreground/20 pointer-events-none items-center justify-center rounded-md px-1.5 font-normal select-none">
                  G then H
                </Kbd>
              </Command.Item>
            </Command.Group>

            {/* Documents */}
            {documents && documents.length > 0 && (
              <Command.Group
                heading="Documents"
                className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
              >
                {documents.map((doc) => (
                  <Command.Item
                    key={doc.id}
                    onSelect={() => navigateToDocument(doc.id)}
                    onMouseEnter={() => router.prefetch(`/editor/${doc.id}`)}
                    className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {doc.title ?? "Untitled"}
                      {!doc.isOwner && (
                        <span className="ml-2 text-xs opacity-70">
                          (Shared)
                        </span>
                      )}
                    </span>
                    {doc.id === documentId && (
                      <div className="text-primary h-2 w-2 shrink-0 rounded-full bg-current" />
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Members (Owner only) */}
            {isOwner && members && members.length > 0 && (
              <Command.Group
                heading="Members"
                className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
              >
                {members.map((member) => (
                  <Command.Item
                    key={member.id}
                    className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {member.user.name ?? member.user.email} ({member.role})
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* General */}
            <Command.Group
              heading="General"
              className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
            >
              <Command.Item
                onSelect={() => navigate("/editor")}
                onMouseEnter={() => router.prefetch("/editor")}
                className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <Home className="h-4 w-4 shrink-0" />
                <span className="flex-1">Dashboard</span>
              </Command.Item>
            </Command.Group>

            {/* Help */}
            <Command.Group
              heading="Help"
              className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
            >
              <Command.Item
                onSelect={openKeyboardShortcuts}
                className="group aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="flex-1">Keyboard Shortcuts</span>
                <Kbd className="bg-background group-aria-selected:bg-accent-foreground/20 pointer-events-none items-center justify-center rounded-md px-1 font-normal select-none">
                  <FaQuestion size={12} className="text-icon-button" />
                </Kbd>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer with hint */}
          <div className="text-muted-foreground border-t px-4 py-3 text-xs">
            <div className="flex items-center justify-between gap-4">
              {/* Escape hint */}
              <div className="flex items-center gap-1.5">
                <KbdGroup className="flex items-center gap-0.5">
                  <Kbd className="bg-background border-border pointer-events-none items-center justify-center rounded-md px-1.5 select-none">
                    esc
                  </Kbd>
                </KbdGroup>
                close
              </div>
              <div className="flex items-center gap-4">
                {/* Navigation hints */}
                <div className="flex items-center gap-1.5">
                  <KbdGroup className="flex items-center gap-0.5">
                    <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md select-none">
                      <FaAngleDown size={12} className="text-icon-button" />
                    </Kbd>
                    <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md select-none">
                      <FaAngleUp size={12} className="text-icon-button" />
                    </Kbd>
                  </KbdGroup>
                  to navigate
                </div>
                {/* Select hint */}
                <div className="flex items-center gap-1.5">
                  <KbdGroup className="flex items-center gap-0.5">
                    <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md px-1.5 select-none">
                      <FaTurnDown
                        size={12}
                        className="text-icon-button -mb-0.5 rotate-90"
                      />
                    </Kbd>
                  </KbdGroup>
                  to select
                </div>
              </div>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
