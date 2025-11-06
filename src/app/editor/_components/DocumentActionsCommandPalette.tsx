"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { api } from "@/trpc/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Label } from "@/components/ui/label";
import {
  FaTrash,
  FaStar,
  FaRegStar,
  FaFile,
  FaArrowRight,
  FaAngleDown,
  FaAngleUp,
} from "react-icons/fa6";
import { Search } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { toastManager } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { dispatchOpenDocumentActions } from "@/lib/lexical/command-helpers";

// Store for document actions command palette state
const useDocumentActionsPaletteStore = (() => {
  let store: { open: boolean } = {
    open: false,
  };
  const listeners = new Set<() => void>();

  return {
    getState: () => store,
    setState: (updates: Partial<typeof store>) => {
      store = { ...store, ...updates };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

export function useDocumentActionsPaletteState() {
  const [state, setState] = useState(() =>
    useDocumentActionsPaletteStore.getState(),
  );

  useEffect(() => {
    const unsubscribe = useDocumentActionsPaletteStore.subscribe(() => {
      setState(useDocumentActionsPaletteStore.getState());
    });
    return unsubscribe;
  }, []);

  return {
    open: state.open,
    setOpen: (open: boolean) => {
      useDocumentActionsPaletteStore.setState({ open });
    },
  };
}

export function openDocumentActionsPalette() {
  useDocumentActionsPaletteStore.setState({ open: true });
}

export function DocumentActionsCommandPalette() {
  const router = useRouter();
  const { open, setOpen } = useDocumentActionsPaletteState();
  const [search, setSearch] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );

  // Fetch documents for navigation
  const { data: documents, isLoading } = api.document.getAll.useQuery(
    undefined,
    {
      enabled: open,
    },
  );

  const utils = api.useUtils?.();

  const deleteMutation = api.document.delete.useMutation({
    onSuccess: () => {
      toastManager.add({
        title: "Document deleted",
        type: "success",
      });
      void utils?.document.getAll.invalidate();
      setOpen(false);
      setSelectedDocumentId(null);
      router.push("/editor");
    },
    onError: (error) => {
      toastManager.add({
        title: error.message ?? "Failed to delete document",
        type: "error",
      });
    },
  });

  const toggleFavoriteMutation = api.document.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toastManager.add({
        title: data.isFavorite ? "Document favorited" : "Document unfavorited",
        type: "success",
      });
      void utils?.document.getAll.invalidate();
    },
    onError: (error) => {
      toastManager.add({
        title: error.message ?? "Failed to update favorite",
        type: "error",
      });
    },
  });

  // Handle Ctrl+B keyboard shortcut
  // Note: This is a global shortcut that works even when editor is not focused
  // We keep it as a DOM listener for global access, but also try to dispatch Lexical command
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B (Windows/Linux) or Cmd+B (Mac)
      // Allow it even when editor is focused (contentEditable)
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        // Check if we're in a command palette input or textarea (not editor)
        const target = e.target as HTMLElement;
        const isCommandInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target.closest('[cmdk-input]') !== null);
        
        // Only prevent if we're NOT in a command input (allow in editor)
        if (!isCommandInput) {
          e.preventDefault();
          e.stopPropagation();
          
          // Try to dispatch Lexical command first (if editor is available)
          // Fall back to direct state manipulation for global access
          const commandDispatched = dispatchOpenDocumentActions();
          if (!commandDispatched) {
            // No editor available, toggle palette directly
            setOpen(!open);
          }
          // Note: If command was dispatched, EditorCommandsPlugin will handle state update
        }
      }
      // Escape to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setSelectedDocumentId(null);
      }
    };

    // Use capture phase to catch events before they bubble
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, setOpen]);

  // Reset state when palette opens/closes
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedDocumentId(null);
    }
  }, [open]);

  const handleDelete = (docId: string, isOwner: boolean) => {
    if (!isOwner) {
      toastManager.add({
        title: "Only document owners can delete documents",
        type: "error",
      });
      return;
    }
    if (
      confirm(
        "Are you sure you want to delete this document? This action cannot be undone.",
      )
    ) {
      deleteMutation.mutate({ id: docId });
    }
  };

  const handleToggleFavorite = (docId: string) => {
    toggleFavoriteMutation.mutate({ documentId: docId });
  };

  const navigateToDocument = (docId: string) => {
    router.push(`/editor/${docId}`);
    setOpen(false);
    setSelectedDocumentId(null);
  };

  const selectedDoc = documents?.find((d) => d.id === selectedDocumentId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="bg-tooltips p-0 max-w-2xl sm:max-w-2xl sm:rounded-3xl sm:border sm:shadow-lg !fixed !bottom-8 !left-1/2 !-translate-x-1/2 !top-auto !translate-y-0 sm:data-starting-style:translate-y-4 sm:data-ending-style:translate-y-0 sm:data-starting-style:opacity-0 sm:data-ending-style:opacity-100 origin-bottom"
        data-testid="document-actions-palette"
      >
        <VisuallyHidden>
          <DialogTitle>Document Actions</DialogTitle>
        </VisuallyHidden>

        <Command
          className="overflow-hidden"
          value={search}
          onValueChange={setSearch}
          onKeyDown={(e) => {
            // Backspace: go back to document list when search is empty
            if (e.key === "Backspace" && !search && selectedDocumentId) {
              e.preventDefault();
              setSelectedDocumentId(null);
            }
          }}
        >
          {/* Search Input */}
          <Label className="bg-card items- mx-2 my-2 flex gap-2! rounded-2xl border px-4 py-3">
            <Search className="text-primary/50 size-5 shrink-0" />
            <Command.Input
              placeholder={
                selectedDocumentId
                  ? "Type to search actions..."
                  : "Type to search documents..."
              }
              className="placeholder:text-primary/50 flex w-full text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </Label>

          {/* Command List */}
          <Command.List className="custom-scrollbar max-h-[400px] overflow-x-hidden overflow-y-auto p-2">
            <Command.Empty className="text-primary/50 py-8 text-center text-sm">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="size-4" />
                  <span>Loading documents...</span>
                </div>
              ) : (
                "No documents found."
              )}
            </Command.Empty>

            {!selectedDocumentId && documents && documents.length > 0 && (
              <Command.Group
                heading="Documents"
                className="**:[[cmdk-group-heading]]:text-primary/50 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
              >
                {documents.map((doc) => (
                  <Command.Item
                    key={`doc-${doc.id}`}
                    value={doc.title ?? "Untitled"}
                    onSelect={() => setSelectedDocumentId(doc.id)}
                    onMouseEnter={() => router.prefetch(`/editor/${doc.id}`)}
                    className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-3 pl-2 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                      {doc.isFavorite ? (
                        <FaStar
                          size={13}
                          className="text-primary/50 shrink-0"
                        />
                      ) : (
                        <FaFile
                          size={13}
                          className="text-primary/50 shrink-0"
                        />
                      )}
                    </span>
                    <span className="flex-1">
                      {doc.title ?? "Untitled"}
                      {!doc.isOwner && (
                        <span className="ml-2 text-xs opacity-70">
                          (Shared)
                        </span>
                      )}
                    </span>
                    <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-1 font-normal select-none">
                      <FaArrowRight
                        size={12}
                        className="text-icon-button group-aria-selected:text-primary"
                      />
                    </Kbd>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions for Selected Document */}
            {selectedDoc && (
              <Command.Group
                heading={`Actions for "${selectedDoc.title ?? "Untitled"}"`}
                className="**:[[cmdk-group-heading]]:text-primary/50 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
              >
                <Command.Item
                  value="open"
                  onSelect={() => navigateToDocument(selectedDoc.id)}
                  className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                    <FaFile
                      size={13}
                      className="text-icon-button group-aria-selected:text-primary shrink-0"
                    />
                  </span>
                  <span className="flex-1">Open document</span>
                </Command.Item>

                <Command.Item
                  value={selectedDoc.isFavorite ? "unfavorite" : "favorite"}
                  onSelect={() => handleToggleFavorite(selectedDoc.id)}
                  disabled={toggleFavoriteMutation.isPending}
                  className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                    {selectedDoc.isFavorite ? (
                      <FaStar
                        size={13}
                        className="text-icon-button group-aria-selected:text-primary shrink-0"
                      />
                    ) : (
                      <FaRegStar
                        size={13}
                        className="text-icon-button group-aria-selected:text-primary shrink-0"
                      />
                    )}
                  </span>
                  <span className="flex-1">
                    {selectedDoc.isFavorite ? "Unfavorite" : "Favorite"}
                  </span>
                  {toggleFavoriteMutation.isPending && (
                    <Spinner className="size-4" />
                  )}
                </Command.Item>

                {selectedDoc.isOwner && (
                  <Command.Item
                    value="delete"
                    onSelect={() => handleDelete(selectedDoc.id, true)}
                    disabled={deleteMutation.isPending}
                    className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                      <FaTrash
                        size={13}
                        className="text-icon-button group-aria-selected:text-primary shrink-0"
                      />
                    </span>
                    <span className="flex-1">Delete document</span>
                    {deleteMutation.isPending && <Spinner className="size-4" />}
                  </Command.Item>
                )}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer with hint */}
          <div className="text-primary/50 bg-card z-1 mx-2 mb-2 rounded-2xl px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-4">
              {/* Escape hint */}
              <div className="flex items-center gap-1.5">
                <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                  esc
                </Kbd>
                to close
                {selectedDocumentId && (
                  <>
                    <span className="mx-1">•</span>
                    <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                      backspace
                    </Kbd>
                    to go back
                  </>
                )}
              </div>
              <div className="flex items-center gap-6">
                {/* Navigation hints */}
                <div className="flex items-center gap-1.5">
                  <KbdGroup className="flex items-center gap-0.5">
                    <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none py-1 select-none">
                      <FaAngleDown size={12} className="text-icon-button" />
                    </Kbd>
                    <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none py-1 select-none">
                      <FaAngleUp size={12} className="text-icon-button" />
                    </Kbd>
                  </KbdGroup>
                  to navigate
                </div>
                {/* Select hint */}
                <div className="flex items-center gap-1.5">
                  <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                    <FaArrowRight size={12} className="text-icon-button" />
                  </Kbd>
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
