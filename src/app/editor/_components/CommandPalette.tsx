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
import { Popover, PopoverTrigger, PopoverPopup } from "@/components/ui/popover";
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
  FaStar,
  FaRegStar,
  FaSun,
  FaTrash,
  FaTurnDown,
  FaUser,
} from "react-icons/fa6";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { toast } from "sonner";
import { toggleEditMode, getEditMode, getEditorInstance } from "@/app/editor/_components/editor";
import { TOGGLE_EDIT_MODE_COMMAND } from "@/lib/lexical/commands";
import { InviteUserButton } from "@/app/editor/_components/InviteUserButton";
import { Spinner } from "@/components/ui/spinner";
import { AnimatePresence, motion } from "motion/react";
import { isValidEmailFormat, validateEmail } from "@/lib/email-validation";
import { FaChevronDown, FaCheck, FaXmark } from "react-icons/fa6";

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
  const { open, setOpen } = useCommandPaletteState();
  const { setTheme, resolvedTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const page = pages[pages.length - 1];
  const [selectedValue, setSelectedValue] = useState<string | undefined>(
    undefined,
  );
  const [documentTitle, setDocumentTitle] = useState<string>(_documentTitle);
  const [titleInput, setTitleInput] = useState<string>("");
  // State for create document form
  const [newDocTitle, setNewDocTitle] = useState<string>("");
  const [newDocMembers, setNewDocMembers] = useState<
    Array<{ email: string; role: "read" | "write" }>
  >([]);
  const [newMemberEmail, setNewMemberEmail] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<"read" | "write">("write");
  const [showRoleOptions, setShowRoleOptions] = useState(false);
  const [selectedDocumentForActions, setSelectedDocumentForActions] = useState<
    string | null
  >(null);
  const [showDocumentActions, setShowDocumentActions] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [triggerPosition, setTriggerPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const selectedDocumentIdRef = useRef<string | null>(null);
  const newDocTitleInputRef = useRef<HTMLInputElement>(null);
  const newMemberEmailInputRef = useRef<HTMLInputElement>(null);
  const roleSelectorButtonRef = useRef<HTMLButtonElement>(null);
  const addMemberButtonRef = useRef<HTMLButtonElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const firstRoleOptionRef = useRef<HTMLButtonElement>(null);

  // Fetch documents for navigation
  const { data: documents } = api.document.getAll.useQuery(undefined, {
    enabled: open,
  });

  // Fetch members
  const { data: members } = api.document.getMembers.useQuery(
    { documentId },
    { enabled: open && isOwner },
  );

  const utils = api.useUtils?.();
  const inviteMutation = api.document.inviteUser.useMutation();

  const deleteMutation = api.document.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      void utils?.document.getAll.invalidate();
      setShowDocumentActions(false);
      setSelectedDocumentForActions(null);
      setOpen(false);
      router.push("/editor");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete document");
    },
  });

  const toggleFavoriteMutation = api.document.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.isFavorite ? "Document favorited" : "Document unfavorited",
      );
      void utils?.document.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update favorite");
    },
  });

  const createMutation = api.document.create.useMutation({
    onSuccess: async (doc) => {
      // Invite all members after document creation
      if (newDocMembers.length > 0) {
        const invitePromises = newDocMembers.map((member) =>
          inviteMutation.mutateAsync({
            documentId: doc.id,
            userEmail: member.email,
            role: member.role,
          }),
        );
        try {
          await Promise.all(invitePromises);
        } catch (error) {
          // Some invites might fail, but document is created
          toast.warning(
            "Document created, but some invitations may have failed",
          );
        }
      }
      router.push(`/editor/${doc.id}`);
      setOpen(false);
      toast.success("Document created");
      // Reset form
      setNewDocTitle("");
      setNewDocMembers([]);
      setNewMemberEmail("");
      setNewMemberRole("write");
      void utils?.document.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create document");
    },
  });
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
    // Navigate to create document page
    setPages((prev) => [...prev, "createDocument"]);
    setSearch("");
  };

  const handleCreateDocument = async () => {
    if (createMutation.isPending) return;
    const title = newDocTitle.trim() || undefined;
    createMutation.mutate({ title });
  };

  const addMember = async () => {
    const trimmedEmail = newMemberEmail.trim();
    if (!trimmedEmail) return;

    // Check if already added
    if (newDocMembers.some((m) => m.email === trimmedEmail)) {
      toast.error("This email is already added");
      return;
    }

    // Validate email format
    if (!isValidEmailFormat(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate with mail.so API
    const validationResult = await validateEmail(trimmedEmail);
    if (!validationResult.valid) {
      toast.error(
        validationResult.reason ?? "Please enter a valid email address",
      );
      return;
    }

    // Warn about disposable emails but allow them
    if (validationResult.disposable) {
      toast.warning(
        "This email address appears to be from a disposable email service",
      );
    }

    setNewDocMembers((prev) => [
      ...prev,
      { email: trimmedEmail, role: newMemberRole },
    ]);
    setNewMemberEmail("");
    setNewMemberRole("write");
    // Focus back to email input after state updates
    setTimeout(() => {
      newMemberEmailInputRef.current?.focus();
    }, 0);
  };

  const removeMember = (email: string) => {
    setNewDocMembers((prev) => prev.filter((m) => m.email !== email));
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
    // Dispatch Lexical command instead of calling function directly
    const editor = getEditorInstance(documentId);
    if (editor) {
      editor.dispatchCommand(TOGGLE_EDIT_MODE_COMMAND, {
        documentId,
        canWrite,
      });
      // Update state based on command result
      // The command handler will update the editor state, so we refresh here
      const currentMode = getEditMode(documentId);
      setIsCurrentlyEditable(currentMode ?? canWrite);
      const mode = currentMode ? "Edit" : "Read";
      toast.success(`Switched to ${mode} mode`, { duration: 1500 });
      setOpen(false);
    } else {
      // Fallback to direct function call if editor not available
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
      // Reset create document form
      setNewDocTitle("");
      setNewDocMembers([]);
      setNewMemberEmail("");
      setNewMemberRole("write");
      setShowRoleOptions(false);
    }
  }, [open, documentId, canWrite]);

  // Auto-focus title input when createDocument page opens
  useEffect(() => {
    if (page === "createDocument" && newDocTitleInputRef.current) {
      const timer = setTimeout(() => {
        newDocTitleInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [page]);

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
        className="bg-tooltips p-0"
        data-testid="command-palette"
      >
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>

        <Command
          className="overflow-hidden"
          value={selectedValue}
          onValueChange={(value) => {
            setSelectedValue(value);
            // Update the ref when value changes
            if (documents && value) {
              const doc = documents.find(
                (d) => (d.title ?? "Untitled") === value,
              );
              if (doc) {
                selectedDocumentIdRef.current = doc.id;
              }
            }
          }}
          onKeyDown={(e) => {
            const target = e.target as HTMLElement | null;
            const isTypingInField =
              !!target &&
              (target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                (target as HTMLElement).isContentEditable);

            // Ctrl+B or Cmd+B: show document actions popover
            if (
              (e.ctrlKey || e.metaKey) &&
              e.key === "b" &&
              !isTypingInField &&
              page === "openDocument" &&
              documents &&
              documents.length > 0
            ) {
              e.preventDefault();
              e.stopPropagation();

              // Try multiple methods to find the selected document
              let selectedDoc: (typeof documents)[0] | undefined;

              // Method 1: Use the ref (most reliable - tracks what cmdk is actually highlighting)
              if (selectedDocumentIdRef.current) {
                selectedDoc = documents.find(
                  (doc) => doc.id === selectedDocumentIdRef.current,
                );
              }

              // Method 2: Match by selectedValue (cmdk's internal selected value)
              if (!selectedDoc && selectedValue) {
                selectedDoc = documents.find(
                  (doc) => (doc.title ?? "Untitled") === selectedValue,
                );
              }

              // Method 3: Find the DOM element with aria-selected="true"
              if (!selectedDoc) {
                const selectedItem = document.querySelector(
                  '[cmdk-item][aria-selected="true"]',
                ) as HTMLElement | null;
                if (selectedItem) {
                  const itemValue =
                    selectedItem.getAttribute("data-value") ||
                    selectedItem.textContent?.trim();
                  if (itemValue) {
                    selectedDoc = documents.find(
                      (doc) =>
                        (doc.title ?? "Untitled") === itemValue ||
                        doc.title?.includes(itemValue) ||
                        itemValue.includes(doc.title ?? ""),
                    );
                  }
                }
              }

              // Method 4: Fallback to first document
              if (!selectedDoc && documents.length > 0) {
                selectedDoc = documents[0];
              }

              if (selectedDoc) {
                // Set the selected document ID first
                setSelectedDocumentId(selectedDoc.id);
                setSelectedDocumentForActions(selectedDoc.id);

                // Find the selected item's DOM element and get its position
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(() => {
                  const itemElement = document.querySelector(
                    `[data-value="${selectedDoc.title ?? "Untitled"}"]`,
                  ) as HTMLElement | null;
                  if (itemElement) {
                    const rect = itemElement.getBoundingClientRect();
                    setTriggerPosition({
                      top: rect.top,
                      left: rect.left,
                      width: rect.width,
                      height: rect.height,
                    });
                    // Only show after position is set
                    setShowDocumentActions(true);
                  } else {
                    // Fallback: show anyway without position
                    setShowDocumentActions(true);
                  }
                });
              }
              return;
            }

            // Escape: close actions popover first, then nested page
            if (e.key === "Escape") {
              if (showDocumentActions) {
                e.preventDefault();
                e.stopPropagation();
                setShowDocumentActions(false);
                setSelectedDocumentForActions(null);
                return;
              }
              if (pages.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                setPages((prev) => prev.slice(0, -1));
                return;
              }
            }

            // Backspace: go back when search is empty, but NOT while typing in a field
            if (e.key === "Backspace" && !search && !isTypingInField) {
              e.preventDefault();
              e.stopPropagation();
              if (showDocumentActions) {
                setShowDocumentActions(false);
                setSelectedDocumentForActions(null);
              } else {
                setPages((prev) => prev.slice(0, -1));
              }
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
                      : page === "createDocument"
                        ? "Create Document"
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
                      <FaArrowRight
                        size={12}
                        className="text-icon-button group-aria-selected:text-primary"
                      />
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
                  <Command.Group className="relative mb-8">
                    {documents.map((doc) => {
                      return (
                        <Command.Item
                          key={`open-${doc.id}`}
                          value={doc.title ?? "Untitled"}
                          data-value={doc.title ?? "Untitled"}
                          onSelect={() => {
                            if (
                              showDocumentActions &&
                              selectedDocumentForActions === doc.id
                            ) {
                              // If actions are showing, open the document
                              navigateToDocument(doc.id);
                              setShowDocumentActions(false);
                              setSelectedDocumentForActions(null);
                            } else {
                              // Otherwise, navigate to document
                              navigateToDocument(doc.id);
                            }
                          }}
                          onMouseEnter={() => {
                            router.prefetch(`/editor/${doc.id}`);
                            selectedDocumentIdRef.current = doc.id;
                          }}
                          onFocus={() => {
                            selectedDocumentIdRef.current = doc.id;
                          }}
                          className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-3 pl-2 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                        >
                          <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                            {doc.isFavorite ? (
                              <FaStar
                                size={13}
                                className="text-primary/50 shrink-0"
                              />
                            ) : (
                              <FileText
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
                          {doc.id === documentId && (
                            <div className="text-primary h-2 w-2 shrink-0 rounded-full bg-current" />
                          )}
                          {!(
                            showDocumentActions &&
                            selectedDocumentForActions === doc.id
                          ) && (
                            <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-1 font-normal select-none">
                              <FaArrowRight
                                size={12}
                                className="text-icon-button group-aria-selected:text-primary"
                              />
                            </Kbd>
                          )}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                  {/* Render popover for selected document */}
                  {showDocumentActions &&
                    selectedDocumentForActions &&
                    documents && (
                      <Popover
                        open={true}
                        onOpenChange={(open) => {
                          if (!open) {
                            setShowDocumentActions(false);
                            setSelectedDocumentForActions(null);
                            setSelectedDocumentId(null);
                            setTriggerPosition(null);
                          }
                        }}
                      >
                        <PopoverTrigger>
                          <div
                            ref={(el) => {
                              if (el && selectedDocumentForActions) {
                                // Find the selected item and position the trigger
                                requestAnimationFrame(() => {
                                  const selectedItem = document.querySelector(
                                    `[data-value="${
                                      documents.find(
                                        (d) =>
                                          d.id === selectedDocumentForActions,
                                      )?.title ?? "Untitled"
                                    }"]`,
                                  ) as HTMLElement | null;
                                  if (selectedItem && el) {
                                    const rect =
                                      selectedItem.getBoundingClientRect();
                                    el.style.position = "fixed";
                                    el.style.top = `${rect.top}px`;
                                    el.style.left = `${rect.left}px`;
                                    el.style.width = `${rect.width}px`;
                                    el.style.height = `${rect.height}px`;
                                    el.style.pointerEvents = "none";
                                    el.style.opacity = "0";
                                  }
                                });
                              }
                            }}
                          />
                        </PopoverTrigger>
                        <PopoverPopup
                          side="right"
                          align="start"
                          sideOffset={8}
                          className="w-64 p-0"
                        >
                          <DocumentActionsPopover
                            doc={
                              documents.find(
                                (d) => d.id === selectedDocumentForActions,
                              )!
                            }
                            onClose={() => {
                              setShowDocumentActions(false);
                              setSelectedDocumentForActions(null);
                              setSelectedDocumentId(null);
                              setTriggerPosition(null);
                            }}
                            onDelete={() => {
                              const doc = documents.find(
                                (d) => d.id === selectedDocumentForActions,
                              );
                              if (!doc?.isOwner) {
                                toast.error(
                                  "Only document owners can delete documents",
                                );
                                return;
                              }
                              if (
                                confirm(
                                  "Are you sure you want to delete this document? This action cannot be undone.",
                                )
                              ) {
                                deleteMutation.mutate({ id: doc.id });
                              }
                            }}
                            onToggleFavorite={() => {
                              toggleFavoriteMutation.mutate({
                                documentId: selectedDocumentForActions!,
                              });
                            }}
                            onOpen={() => {
                              navigateToDocument(selectedDocumentForActions!);
                              setShowDocumentActions(false);
                              setSelectedDocumentForActions(null);
                              setSelectedDocumentId(null);
                              setTriggerPosition(null);
                            }}
                            isDeleting={deleteMutation.isPending}
                            isTogglingFavorite={
                              toggleFavoriteMutation.isPending
                            }
                          />
                        </PopoverPopup>
                      </Popover>
                    )}
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

              {page === "createDocument" && (
                <div className="mb-8 space-y-4 px-2">
                  {/* Document Name Section */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      {/* <div className="text-primary/50 px-1 text-xs font-medium tracking-wider uppercase">
                      Document Name
                    </div> */}
                      <div className="bg-card flex items-center gap-2 rounded-2xl border py-2 pr-2 pl-3">
                        <input
                          ref={newDocTitleInputRef}
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              setPages((prev) => prev.slice(0, -1));
                              setTimeout(() => {
                                const commandInput = document.querySelector(
                                  "[cmdk-input]",
                                ) as HTMLInputElement;
                                commandInput?.focus();
                              }, 0);
                            } else if (e.key === "Tab" && !e.shiftKey) {
                              // Tab to next field (member email)
                              e.preventDefault();
                              e.stopPropagation();
                              newMemberEmailInputRef.current?.focus();
                            }
                            // Prevent command palette navigation when typing
                            if (e.target instanceof HTMLInputElement) {
                              e.stopPropagation();
                            }
                          }}
                          placeholder="Enter document name (optional)"
                          aria-label="Document title"
                          className="placeholder:text-primary/50 flex w-full py-1 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          autoFocus
                        />
                      </div>
                    </div>
                    {/* Members Section */}
                    <div className="space-y-2">
                      <div className="text-primary/50 px-1 text-xs font-medium tracking-wider uppercase">
                        Members (optional)
                      </div>

                      {/* Add Member Form */}
                      <div className="flex items-center gap-2">
                        <Label className="bg-background/50 text-primary flex flex-1 items-center justify-between rounded-2xl border py-2 pr-2 pl-3 text-sm">
                          <input
                            ref={newMemberEmailInputRef}
                            type="email"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !showRoleOptions) {
                                e.preventDefault();
                                e.stopPropagation();
                                void addMember();
                              } else if (e.key === "Tab" && !e.shiftKey) {
                                // Tab to role selector
                                e.preventDefault();
                                e.stopPropagation();
                                roleSelectorButtonRef.current?.focus();
                              } else if (e.key === "Tab" && e.shiftKey) {
                                // Shift+Tab to title input
                                e.preventDefault();
                                e.stopPropagation();
                                newDocTitleInputRef.current?.focus();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (showRoleOptions) {
                                  setShowRoleOptions(false);
                                  roleSelectorButtonRef.current?.focus();
                                } else {
                                  setPages((prev) => prev.slice(0, -1));
                                  setTimeout(() => {
                                    const commandInput = document.querySelector(
                                      "[cmdk-input]",
                                    ) as HTMLInputElement;
                                    commandInput?.focus();
                                  }, 0);
                                }
                              }
                              // Prevent command palette navigation
                              if (e.target instanceof HTMLInputElement) {
                                e.stopPropagation();
                              }
                            }}
                            placeholder="user@example.com"
                            className="placeholder:text-primary/50"
                            disabled={
                              createMutation.isPending || showRoleOptions
                            }
                            aria-label="Member email"
                          />
                          <AnimatePresence mode="wait">
                            {isValidEmailFormat(newMemberEmail) ? (
                              <motion.span
                                key="valid"
                                initial={{ opacity: 0 }}
                                animate={{
                                  opacity: 1,
                                  transition: { duration: 0.2 },
                                }}
                                exit={{
                                  opacity: 0,
                                  transition: { duration: 0.2 },
                                }}
                                className="group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-full bg-green-600 p-1"
                              >
                                <FaCheck
                                  size={12}
                                  className="text-primary shrink-0"
                                />
                              </motion.span>
                            ) : (
                              <motion.span
                                key="invalid"
                                initial={{ opacity: 0 }}
                                animate={{
                                  opacity: 1,
                                  transition: { duration: 0.2 },
                                }}
                                exit={{
                                  opacity: 0,
                                  transition: { duration: 0.2 },
                                }}
                                className="group-aria-selected:bg-accent-foreground/20 bg-cmdk-kbd-disabled flex items-center justify-center rounded-full p-1"
                              >
                                <FaCheck
                                  size={12}
                                  className="text-cmdk-kbd-active-foreground shrink-0"
                                />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </Label>
                        {!showRoleOptions && (
                          <button
                            ref={roleSelectorButtonRef}
                            type="button"
                            onClick={() => {
                              setShowRoleOptions(true);
                              // Focus first role option after a brief delay
                              setTimeout(() => {
                                firstRoleOptionRef.current?.focus();
                              }, 0);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowRoleOptions(true);
                                setTimeout(() => {
                                  firstRoleOptionRef.current?.focus();
                                }, 0);
                              } else if (e.key === "Tab" && !e.shiftKey) {
                                // Tab navigation logic:
                                // 1. If members exist, go to first remove button
                                // 2. If add member button is enabled (valid email), go to add member button
                                // 3. Otherwise, skip to create button
                                e.preventDefault();
                                e.stopPropagation();
                                if (newDocMembers.length > 0) {
                                  // If members exist, go to first remove button
                                  const firstRemoveButton =
                                    document.querySelector(
                                      '[aria-label^="Remove"]',
                                    ) as HTMLButtonElement;
                                  firstRemoveButton?.focus();
                                } else {
                                  // Check if add member button is enabled
                                  const isAddMemberEnabled =
                                    !createMutation.isPending &&
                                    isValidEmailFormat(newMemberEmail.trim());
                                  if (isAddMemberEnabled) {
                                    addMemberButtonRef.current?.focus();
                                  } else {
                                    // Skip to create button if add member is disabled
                                    createButtonRef.current?.focus();
                                  }
                                }
                              } else if (e.key === "Tab" && e.shiftKey) {
                                // Shift+Tab to email input
                                e.preventDefault();
                                e.stopPropagation();
                                newMemberEmailInputRef.current?.focus();
                              }
                              if (e.target instanceof HTMLButtonElement) {
                                e.stopPropagation();
                              }
                            }}
                            className="group aria-selected:bg-accent text-primary bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 focus-visible:ring-primary/50 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none select-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={createMutation.isPending}
                            aria-label="Select permission role"
                            aria-expanded={showRoleOptions}
                            aria-haspopup="true"
                          >
                            {newMemberRole === "write" ? (
                              <FaPen
                                size={13}
                                className="text-primary shrink-0"
                              />
                            ) : (
                              <FaEye
                                size={13}
                                className="text-primary shrink-0"
                              />
                            )}
                            <span className="capitalize">{newMemberRole}</span>
                            <FaChevronDown
                              size={13}
                              className="text-primary/50 shrink-0"
                            />
                          </button>
                        )}
                        {!showRoleOptions && (
                          <button
                            ref={addMemberButtonRef}
                            type="button"
                            onClick={() => void addMember()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                void addMember();
                              } else if (e.key === "Tab" && !e.shiftKey) {
                                // Tab: if members exist, go to first remove button, else go to create button
                                e.preventDefault();
                                e.stopPropagation();
                                if (newDocMembers.length > 0) {
                                  const firstRemoveButton =
                                    document.querySelector(
                                      '[aria-label^="Remove"]',
                                    ) as HTMLButtonElement;
                                  firstRemoveButton?.focus();
                                } else {
                                  createButtonRef.current?.focus();
                                }
                              } else if (e.key === "Tab" && e.shiftKey) {
                                // Shift+Tab to role selector
                                e.preventDefault();
                                e.stopPropagation();
                                roleSelectorButtonRef.current?.focus();
                              }
                              if (e.target instanceof HTMLButtonElement) {
                                e.stopPropagation();
                              }
                            }}
                            className="group text-primary-foreground bg-primary aria-selected:bg-accent aria-selected:text-primary group-aria-selected:bg-accent-foreground/20 disabled:bg-cmdk-kbd-disabled disabled:text-cmdk-kbd-active-foreground focus-visible:ring-primary/50 flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2 pr-2 pl-2.5 text-sm outline-none select-none focus-visible:ring-2 disabled:cursor-not-allowed"
                            disabled={
                              createMutation.isPending ||
                              !isValidEmailFormat(newMemberEmail.trim())
                            }
                            aria-label="Add member"
                          >
                            Add
                            <FaPlus size={13} />
                          </button>
                        )}
                      </div>

                      {/* Role Options */}
                      <AnimatePresence>
                        {showRoleOptions && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-1"
                          >
                            <button
                              ref={firstRoleOptionRef}
                              type="button"
                              onClick={() => {
                                setNewMemberRole("read");
                                setShowRoleOptions(false);
                                roleSelectorButtonRef.current?.focus();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setNewMemberRole("read");
                                  setShowRoleOptions(false);
                                  roleSelectorButtonRef.current?.focus();
                                } else if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Focus write option
                                  const writeButton = e.currentTarget
                                    .nextElementSibling as HTMLButtonElement;
                                  writeButton?.focus();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowRoleOptions(false);
                                  roleSelectorButtonRef.current?.focus();
                                }
                                if (e.target instanceof HTMLButtonElement) {
                                  e.stopPropagation();
                                }
                              }}
                              className={`group text-primary/50 hover:bg-accent hover:text-primary aria-selected:bg-accent aria-selected:text-primary focus-visible:ring-primary/50 relative flex w-full cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-3 pl-2 text-sm ease-out outline-none select-none focus-visible:ring-2 ${
                                newMemberRole === "read" ? "bg-accent/50" : ""
                              }`}
                              aria-label="Select read permission"
                            >
                              <span className="bg-cmdk-kbd-disabled group-hover:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                                <FaEye
                                  size={13}
                                  className="text-primary/50 shrink-0"
                                />
                              </span>
                              <span className="flex-1 text-left">Read</span>
                              {newMemberRole === "read" && (
                                <div className="text-primary size-2 shrink-0 rounded-full bg-current" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewMemberRole("write");
                                setShowRoleOptions(false);
                                roleSelectorButtonRef.current?.focus();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setNewMemberRole("write");
                                  setShowRoleOptions(false);
                                  roleSelectorButtonRef.current?.focus();
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Focus read option
                                  const readButton = e.currentTarget
                                    .previousElementSibling as HTMLButtonElement;
                                  readButton?.focus();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowRoleOptions(false);
                                  roleSelectorButtonRef.current?.focus();
                                }
                                if (e.target instanceof HTMLButtonElement) {
                                  e.stopPropagation();
                                }
                              }}
                              className={`group text-primary/50 hover:bg-accent hover:text-primary aria-selected:bg-accent aria-selected:text-primary focus-visible:ring-primary/50 relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none focus-visible:ring-2 ${
                                newMemberRole === "write" ? "bg-accent/50" : ""
                              }`}
                              aria-label="Select write permission"
                            >
                              <span className="bg-cmdk-kbd-disabled group-hover:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                                <FaPen
                                  size={13}
                                  className="text-primary/50 shrink-0"
                                />
                              </span>
                              <span className="flex-1 text-left">Write</span>
                              {newMemberRole === "write" && (
                                <div className="text-primary h-2 w-2 shrink-0 rounded-full bg-current" />
                              )}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Members List */}
                      {newDocMembers.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-primary/50 px-1 text-[10px] font-medium tracking-wider uppercase">
                            Added Members
                          </div>
                          {newDocMembers.map((member) => (
                            <div
                              key={member.email}
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
                              <span className="flex-1">{member.email}</span>
                              <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                                {member.role === "write"
                                  ? "can write"
                                  : "can read"}
                              </Kbd>
                              <button
                                type="button"
                                onClick={() => removeMember(member.email)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeMember(member.email);
                                    // Focus next remove button or create button
                                    setTimeout(() => {
                                      const nextButton =
                                        e.currentTarget.parentElement?.nextElementSibling?.querySelector(
                                          '[aria-label^="Remove"]',
                                        ) as HTMLButtonElement;
                                      if (nextButton) {
                                        nextButton.focus();
                                      } else {
                                        createButtonRef.current?.focus();
                                      }
                                    }, 0);
                                  } else if (e.key === "Tab" && !e.shiftKey) {
                                    // Tab to next remove button or create button
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const nextButton =
                                      e.currentTarget.parentElement?.nextElementSibling?.querySelector(
                                        '[aria-label^="Remove"]',
                                      ) as HTMLButtonElement;
                                    if (nextButton) {
                                      nextButton.focus();
                                    } else {
                                      createButtonRef.current?.focus();
                                    }
                                  } else if (e.key === "Tab" && e.shiftKey) {
                                    // Shift+Tab to previous remove button or add member button
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const prevButton =
                                      e.currentTarget.parentElement?.previousElementSibling?.querySelector(
                                        '[aria-label^="Remove"]',
                                      ) as HTMLButtonElement;
                                    if (prevButton) {
                                      prevButton.focus();
                                    } else {
                                      addMemberButtonRef.current?.focus();
                                    }
                                  }
                                  if (e.target instanceof HTMLButtonElement) {
                                    e.stopPropagation();
                                  }
                                }}
                                className="text-primary/50 hover:text-primary focus-visible:ring-primary/50 rounded-md p-1 outline-none focus-visible:ring-2"
                                aria-label={`Remove ${member.email}`}
                              >
                                <FaXmark size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Create Button Section */}
                  <div className="space-y-2 pt-2">
                    <button
                      ref={createButtonRef}
                      type="button"
                      onClick={() => void handleCreateDocument()}
                      onKeyDown={(e) => {
                        if (
                          (e.key === "Enter" || e.key === " ") &&
                          !showRoleOptions
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleCreateDocument();
                        } else if (e.key === "Tab" && e.shiftKey) {
                          // Shift+Tab: if members exist, go to last remove button, else go to add member button
                          e.preventDefault();
                          e.stopPropagation();
                          if (newDocMembers.length > 0) {
                            const removeButtons = document.querySelectorAll(
                              '[aria-label^="Remove"]',
                            );
                            const lastButton = removeButtons[
                              removeButtons.length - 1
                            ] as HTMLButtonElement;
                            lastButton?.focus();
                          } else {
                            addMemberButtonRef.current?.focus();
                          }
                        }
                        if (e.target instanceof HTMLButtonElement) {
                          e.stopPropagation();
                        }
                      }}
                      className="group text-primary-foreground bg-primary aria-selected:bg-accent aria-selected:text-primary group-aria-selected:bg-accent-foreground/20 disabled:bg-cmdk-kbd-disabled disabled:text-cmdk-kbd-active-foreground focus-visible:ring-primary/50 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm outline-none select-none focus-visible:ring-2 disabled:cursor-not-allowed"
                      disabled={createMutation.isPending}
                      aria-label="Create document"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {createMutation.isPending ? (
                          <motion.span
                            key="loading"
                            variants={variants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="flex items-center justify-center gap-2"
                          >
                            <Spinner className="size-4" />
                            Creating new document...
                          </motion.span>
                        ) : (
                          <motion.span
                            key="create"
                            variants={variants}
                            initial="hidden"
                            animate="visible"
                            className="flex items-center justify-center gap-2"
                            exit="hidden"
                          >
                            <FaPlus size={13} />
                            Create new document
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
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
              <div className="flex items-center gap-6">
                {/* Navigation hints */}
                <div className="flex items-center gap-1.5">
                  {page == "title" ? (
                    <></>
                  ) : page == "createDocument" ? (
                    <>
                      <KbdGroup className="flex items-center gap-0.5">
                        <Kbd className="bg-background pointer-events-none rounded-md border-none px-1.5 py-1 text-[10px] select-none">
                          tab
                        </Kbd>
                      </KbdGroup>
                      to navigate
                    </>
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
                  ) : page == "createDocument" ? (
                    <span className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1">
                        <Kbd className="bg-background pointer-events-none rounded-md border-none px-1.5 py-1 text-[10px] select-none">
                          enter
                        </Kbd>
                        or
                        <Kbd className="bg-background pointer-events-none rounded-md border-none px-1.5 py-1 text-[10px] select-none">
                          space
                        </Kbd>
                      </span>
                      to activate
                    </span>
                  ) : page == "openDocument" ? (
                    <>
                      <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                        <FaTurnDown
                          size={12}
                          className="text-icon-button -mb-0.5 rotate-90"
                        />
                      </Kbd>
                      to select document
                      {typeof window !== "undefined" && (
                        <>
                          <span className="mx-1">•</span>
                          <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}B
                          </Kbd>
                          for actions
                        </>
                      )}
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

// Nested actions popover component (Raycast-style) - now uses Command inside Popover
function DocumentActionsPopover({
  doc,
  onClose,
  onDelete,
  onToggleFavorite,
  onOpen,
  isDeleting,
  isTogglingFavorite,
}: {
  doc: any;
  onClose: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onOpen: () => void;
  isDeleting: boolean;
  isTogglingFavorite: boolean;
}) {
  const [filter, setFilter] = useState("");

  const actions = [
    {
      id: "open",
      label: "Open document",
      icon: FaFile,
      onSelect: onOpen,
    },
    {
      id: doc.isFavorite ? "unfavorite" : "favorite",
      label: doc.isFavorite ? "Unfavorite" : "Favorite",
      icon: doc.isFavorite ? FaStar : FaRegStar,
      onSelect: onToggleFavorite,
      isLoading: isTogglingFavorite,
    },
    ...(doc.isOwner
      ? [
          {
            id: "delete",
            label: "Delete document",
            icon: FaTrash,
            onSelect: onDelete,
            isLoading: isDeleting,
          },
        ]
      : []),
  ].filter((action) =>
    action.label.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Command className="overflow-hidden">
      <Command.Input
        value={filter}
        onValueChange={setFilter}
        placeholder="Filter actions..."
        className="border-border border-b px-3 py-2"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <Command.List className="max-h-64 overflow-y-auto">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Command.Item
              key={action.id}
              value={action.label}
              onSelect={action.onSelect}
              disabled={action.isLoading}
              className="hover:bg-accent focus:bg-accent flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center justify-center rounded-md p-1.5">
                <Icon size={13} className="text-primary/50 shrink-0" />
              </span>
              <span className="flex-1">{action.label}</span>
              {action.isLoading && <Spinner className="size-4" />}
            </Command.Item>
          );
        })}
      </Command.List>
    </Command>
  );
}
