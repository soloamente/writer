"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useCommandPaletteState,
  setKeyboardShortcutsOpen,
} from "@/hooks/use-keyboard-shortcuts";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
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
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Label } from "@/components/ui/label";
import {
  FaAngleDown,
  FaAngleUp,
  FaArrowRight,
  FaEye,
  FaFile,
  FaFileInvoice,
  FaGear,
  FaHouse,
  FaMoon,
  FaPen,
  FaPencil,
  FaPenToSquare,
  FaPlus,
  FaQuestion,
  FaSun,
  FaTurnDown,
  FaUser,
} from "react-icons/fa6";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { toast } from "sonner";
import { toggleEditMode, getEditMode } from "@/app/editor/_components/editor";
import { InviteUserButton } from "@/app/editor/_components/InviteUserButton";
import { Spinner } from "@/components/ui/spinner";
import { AnimatePresence, motion } from "motion/react";

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
  const { setTheme, resolvedTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const page = pages[pages.length - 1];
  const [selectedValue, setSelectedValue] = useState<string | undefined>(
    undefined,
  );
  const [documentTitle, setDocumentTitle] = useState<string>(_documentTitle);
  const [titleInput, setTitleInput] = useState<string>("");

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

  const utils = api.useUtils?.();
  const updateTitleMutation = api.document.updateTitle.useMutation({
    onSuccess: (res) => {
      toast.success("Title updated", { duration: 1200 });
      setDocumentTitle(res.title);
      setTitleInput(res.title);
      void utils?.document.getAll.invalidate();
      void utils?.document.getById.invalidate({ id: documentId });
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update title");
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
      // Reset nested pages and search when opened
      setPages([]);
      setSearch("");
      setSelectedValue(undefined);
      setTitleInput(documentTitle ?? "");
    }
  }, [open, documentId, canWrite]);

  // When entering a page, set a sensible default selection
  useEffect(() => {
    if (page === "theme") {
      setSelectedValue("theme.dark");
    } else {
      setSelectedValue(undefined);
    }
  }, [page]);

  // Refocus Command.Input when exiting nested pages to restore keyboard navigation
  const prevPagesLength = useRef(pages.length);
  useEffect(() => {
    // If we went back (pages.length decreased), refocus Command.Input
    if (pages.length < prevPagesLength.current && !page) {
      // Small delay to ensure the DOM has updated
      const timer = setTimeout(() => {
        // Find the Command.Input element using the cmdk-input attribute
        const commandInput = document.querySelector(
          "[cmdk-input]",
        ) as HTMLInputElement;
        commandInput?.focus();
      }, 0);
      prevPagesLength.current = pages.length;
      return () => clearTimeout(timer);
    }
    prevPagesLength.current = pages.length;
  }, [page, pages.length]);

  const variants = {
    hidden: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-tooltips max-w-[640px] overflow-hidden rounded-3xl! p-0 shadow-xl"
        onEscapeKeyDown={(e) => {
          if (pages.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setPages((prev) => prev.slice(0, -1));
            return;
          }
          setOpen(false);
        }}
        onInteractOutside={() => setOpen(false)}
        data-testid="command-palette"
      >
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>

        <Command
          className="overflow-hidden"
          loop
          value={selectedValue}
          onValueChange={setSelectedValue}
          onKeyDown={(e) => {
            const target = e.target as HTMLElement | null;
            const isTypingInField =
              !!target &&
              (target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                (target as HTMLElement).isContentEditable);

            // Backspace: go back when search is empty, but NOT while typing in a field
            if (e.key === "Backspace" && !search && !isTypingInField) {
              e.preventDefault();
              e.stopPropagation();
              setPages((prev) => prev.slice(0, -1));
              return;
            }

            // Escape: close nested page first; dialog handler also handles this
            if (e.key === "Escape" && pages.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              setPages((prev) => prev.slice(0, -1));
              return;
            }
          }}
        >
          {/* Search Input */}
          <Label className="bg-card items- mx-2 my-2 flex gap-2! rounded-2xl border px-4 py-3">
            <Search className="text-primary/50 size-5 shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="placeholder:text-primary/50 flex w-full text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </Label>

          {/* Command List */}
          <Command.List className="custom-scrollbar max-h-[400px] overflow-x-hidden overflow-y-auto p-2">
            {!page && (
              <Command.Empty className="text-primary/50 py-8 text-center text-sm">
                No results found.
              </Command.Empty>
            )}

            {/* Actions */}
            <Command.Group
              heading={
                page === "openDocument"
                  ? "Documents"
                  : page === "members"
                    ? "Members"
                    : page === "title"
                      ? "Title"
                      : page === "theme"
                        ? "Theme"
                        : "Actions"
              }
              className="**:[[cmdk-group-heading]]:text-primary/50 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
            >
              {!page && (
                <>
                  <Command.Item
                    value="change theme"
                    onSelect={() => {
                      setPages((prev) => [...prev, "theme"]);
                      setSearch("");
                    }}
                    className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                      <FaGear
                        size={13}
                        className="text-icon-button group-aria-selected:text-primary shrink-0"
                      />
                    </span>
                    <span className="flex-1">Change theme…</span>
                    <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-1 font-normal select-none">
                      <FaArrowRight
                        size={12}
                        className="text-icon-button group-aria-selected:text-primary"
                      />
                    </Kbd>
                  </Command.Item>

                  {canWrite && (
                    <Command.Item
                      value="change title"
                      onSelect={() => {
                        setPages((prev) => [...prev, "title"]);
                        setSearch("");
                        setTitleInput(documentTitle ?? "");
                      }}
                      className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                    >
                      <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                        <FaPenToSquare
                          size={13}
                          className="text-icon-button group-aria-selected:text-primary shrink-0"
                        />
                      </span>
                      <span className="flex-1">Change title…</span>
                      <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-1 font-normal select-none">
                        <FaArrowRight
                          size={12}
                          className="text-icon-button group-aria-selected:text-primary"
                        />
                      </Kbd>
                    </Command.Item>
                  )}

                  <Command.Item
                    value="open document"
                    onSelect={() => {
                      setPages((prev) => [...prev, "openDocument"]);
                      setSearch("");
                    }}
                    className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                      <FaFile
                        size={13}
                        className="text-icon-button group-aria-selected:text-primary shrink-0"
                      />
                    </span>
                    <span className="flex-1">Open document…</span>
                    <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-1 font-normal select-none">
                      <FaArrowRight
                        size={12}
                        className="text-icon-button group-aria-selected:text-primary"
                      />
                    </Kbd>
                  </Command.Item>

                  {isOwner && (
                    <Command.Item
                      value="manage members"
                      onSelect={() => {
                        setPages((prev) => [...prev, "members"]);
                        setSearch("");
                      }}
                      className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                    >
                      <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                        <FaUser
                          size={13}
                          className="text-icon-button group-aria-selected:text-primary shrink-0"
                        />
                      </span>
                      <span className="flex-1">Manage members…</span>
                      <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-1 font-normal select-none">
                        <FaArrowRight
                          size={12}
                          className="text-icon-button group-aria-selected:text-primary"
                        />
                      </Kbd>
                    </Command.Item>
                  )}

                  <Command.Item
                    value="action.create"
                    onSelect={createNewDocument}
                    className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                      <FaPlus
                        size={13}
                        className="text-icon-button group-aria-selected:text-primary shrink-0"
                      />
                    </span>
                    <span className="flex-1">Create New Document</span>
                    <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-0.5 font-normal select-none">
                      C
                    </Kbd>
                  </Command.Item>
                </>
              )}

              {page === "theme" && (
                <>
                  <Command.Group className="mb-8">
                    <Command.Item
                      value="theme.dark"
                      onSelect={() => {
                        setTheme("dark");
                        setOpen(false);
                      }}
                      className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-3 pl-2 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                    >
                      <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                        <FaMoon
                          size={13}
                          className="text-primary/50 shrink-0"
                        />
                      </span>
                      <span className="flex-1">Dark theme</span>
                      {resolvedTheme === "dark" && (
                        <div className="text-primary size-2 shrink-0 rounded-full bg-current" />
                      )}
                    </Command.Item>
                    <Command.Item
                      value="theme.light"
                      onSelect={() => {
                        setTheme("light");
                        setOpen(false);
                      }}
                      className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-3 pl-2 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                    >
                      <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                        <FaSun size={13} className="text-primary/50 shrink-0" />
                      </span>
                      <span className="flex-1">Light theme</span>
                      {resolvedTheme === "light" && (
                        <div className="text-primary h-2 w-2 shrink-0 rounded-full bg-current" />
                      )}
                    </Command.Item>
                  </Command.Group>
                </>
              )}

              {page === "openDocument" && documents && documents.length > 0 && (
                <>
                  <Command.Group className="mb-8">
                    {documents.map((doc) => (
                      <Command.Item
                        key={`open-${doc.id}`}
                        onSelect={() => navigateToDocument(doc.id)}
                        onMouseEnter={() =>
                          router.prefetch(`/editor/${doc.id}`)
                        }
                        className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-3 pl-2 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                      >
                        <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                          <FileText
                            size={13}
                            className="text-primary/50 shrink-0"
                          />
                        </span>
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
                </>
              )}

              {page === "members" && isOwner && (
                <>
                  {/* Invite Section - Separated with visual distinction */}

                  {/* Members List Section - Separated */}
                  {members && members.length > 0 && (
                    <Command.Group className="**:[[cmdk-group-heading]]:text-primary/50 mb-8 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase">
                      <InviteUserButton
                        documentId={documentId}
                        autoOpen={false}
                        onClose={() => {
                          // Refocus command input after closing invite form
                          setTimeout(() => {
                            const commandInput = document.querySelector(
                              "[cmdk-input]",
                            ) as HTMLInputElement;
                            commandInput?.focus();
                          }, 0);
                        }}
                      />
                      {members.map((member) => (
                        <Command.Item
                          key={`member-${member.id}`}
                          className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-default items-center gap-3 rounded-xl px-2 py-1.5 text-sm select-none"
                        >
                          <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                            {member.role === "write" ? (
                              <FaPen
                                size={13}
                                className="text-primary/50 shrink-0"
                              />
                            ) : (
                              <FaEye
                                size={13}
                                className="text-primary/50 shrink-0"
                              />
                            )}
                          </span>
                          <span className="flex-1">
                            {member.user.name ?? member.user.email}
                          </span>
                          <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                            {member.role === "write" ? "can write" : "can read"}
                          </Kbd>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                </>
              )}

              {page === "title" && canWrite && (
                <div className="bg-card mx-2 my-1 mb-8 flex items-center gap-2 rounded-2xl border py-2 pr-2 pl-3">
                  <input
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (titleInput.trim().length > 0) {
                          updateTitleMutation.mutate({
                            id: documentId,
                            title: titleInput.trim(),
                          });
                        }
                      }
                      // Escape: exit title page and refocus Command.Input
                      if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setPages((prev) => prev.slice(0, -1));
                        // Refocus Command.Input after exiting
                        setTimeout(() => {
                          const commandInput = document.querySelector(
                            "[cmdk-input]",
                          ) as HTMLInputElement;
                          commandInput?.focus();
                        }, 0);
                      }
                      // Backspace: exit title page ONLY if input is empty AND cursor is at the start
                      // Otherwise, let normal backspace work for deleting characters
                      if (e.key === "Backspace" && !search) {
                        const target = e.target as HTMLInputElement;
                        const cursorPosition = target.selectionStart ?? 0;
                        const hasText = titleInput.length > 0;

                        // Only exit if: input is empty AND cursor is at position 0
                        if (!hasText && cursorPosition === 0) {
                          e.preventDefault();
                          e.stopPropagation();
                          setPages((prev) => prev.slice(0, -1));
                          // Refocus Command.Input after exiting
                          setTimeout(() => {
                            const commandInput = document.querySelector(
                              "[cmdk-input]",
                            ) as HTMLInputElement;
                            commandInput?.focus();
                          }, 0);
                        }
                        // Otherwise, let the default backspace behavior work
                      }
                    }}
                    placeholder="Enter new title"
                    aria-label="Document title"
                    className="placeholder:text-primary/50 flex w-full text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    autoFocus
                  />
                  <AnimatePresence mode="wait" initial={false}>
                    {updateTitleMutation.isPending ? (
                      <motion.span
                        key="loading"
                        variants={variants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="flex items-center justify-center"
                      >
                        <Spinner />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="enter"
                        variants={variants}
                        initial="hidden"
                        animate="visible"
                        className="flex items-center justify-center"
                        exit="hidden"
                      >
                        <Kbd className="bg-cmdk-kbd-disabled pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                          <FaTurnDown
                            size={12}
                            className="text-icon-button -mb-0.5 rotate-90"
                          />
                        </Kbd>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {!page && (
                <Command.Item
                  value="action.toggleEdit"
                  onSelect={handleToggleEditMode}
                  className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  {isCurrentlyEditable ? (
                    <>
                      <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                        <FaEye
                          size={13}
                          className="text-icon-button group-aria-selected:text-primary shrink-0"
                        />
                      </span>
                      <span className="flex-1">Switch to Read Mode</span>
                    </>
                  ) : (
                    <>
                      <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                        <FaPencil className="text-primary/50 shrink-0" />
                      </span>
                      <span className="flex-1">
                        {canWrite
                          ? "Switch to Edit Mode"
                          : "Switch to Edit Mode (No Permission)"}
                      </span>
                    </>
                  )}
                </Command.Item>
              )}
            </Command.Group>

            {/* Documents list moved to nested page; top-level group removed */}

            {/* General */}
            {!page && (
              <Command.Group
                heading="General"
                className="**:[[cmdk-group-heading]]:text-primary/50 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
              >
                <Command.Item
                  onSelect={() => navigate("/editor")}
                  onMouseEnter={() => router.prefetch("/editor")}
                  className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                    <FaHouse
                      size={13}
                      className="text-icon-button group-aria-selected:text-primary shrink-0"
                    />
                  </span>
                  <span className="flex-1">Dashboard</span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Help */}
            {!page && (
              <Command.Group
                heading="Help"
                className="**:[[cmdk-group-heading]]:text-primary/50 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:uppercase"
              >
                <Command.Item
                  onSelect={openKeyboardShortcuts}
                  className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                    <FaQuestion
                      size={13}
                      className="text-icon-button group-aria-selected:text-primary shrink-0"
                    />
                  </span>
                  <span className="flex-1">Keyboard Shortcuts</span>
                  <Kbd className="bg-background group-aria-selected:bg-accent-foreground/20 pointer-events-none items-center justify-center rounded-md border-none px-1 py-1 select-none">
                    <FaQuestion
                      size={12}
                      className="text-icon-button group-aria-selected:text-primary"
                    />
                  </Kbd>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>

          {/* Footer with hint */}
          <div className="text-primary/50 bg-card z-1 mx-2 mb-2 rounded-2xl px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-4">
              {/* Escape hint */}
              <div className="flex items-center gap-1.5">
                {!page ? (
                  <>
                    <KbdGroup className="flex items-center gap-0.5">
                      <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                        esc
                      </Kbd>
                    </KbdGroup>
                    to close
                  </>
                ) : (
                  <>
                    <KbdGroup className="flex items-center gap-0.5">
                      <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                        esc
                      </Kbd>
                    </KbdGroup>
                    to go back
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* Navigation hints */}
                <div className="flex items-center gap-1.5">
                  {page == "title" ? (
                    <></>
                  ) : (
                    <>
                      <KbdGroup className="flex items-center gap-0.5">
                        <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none py-1 select-none">
                          <FaAngleDown size={12} className="text-icon-button" />
                        </Kbd>
                        <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none py-1 select-none">
                          <FaAngleUp size={12} className="text-icon-button" />
                        </Kbd>
                      </KbdGroup>
                      to navigate
                    </>
                  )}
                </div>
                {/* Select hint */}
                <div className="flex items-center gap-1.5">
                  {page == "title" ? (
                    <>
                      <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                        <FaTurnDown
                          size={12}
                          className="text-icon-button -mb-0.5 rotate-90"
                        />
                      </Kbd>
                      to change title
                    </>
                  ) : page == "openDocument" ? (
                    <>
                      <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                        <FaTurnDown
                          size={12}
                          className="text-icon-button -mb-0.5 rotate-90"
                        />
                      </Kbd>
                      to select document
                    </>
                  ) : page == "theme" ? (
                    <>
                      <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                        <FaTurnDown
                          size={12}
                          className="text-icon-button -mb-0.5 rotate-90"
                        />
                      </Kbd>
                      to select theme
                    </>
                  ) : (
                    <>
                      <>
                        <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                          <FaTurnDown
                            size={12}
                            className="text-icon-button -mb-0.5 rotate-90"
                          />
                        </Kbd>
                        to select
                      </>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
