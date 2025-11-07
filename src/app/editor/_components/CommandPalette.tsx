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
import { Search, FileText } from "lucide-react";
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
import { toastManager } from "@/components/ui/toast";
import {
  toggleEditMode,
  getEditMode,
  getEditorInstance,
} from "@/app/editor/_components/editor";
import { TOGGLE_EDIT_MODE_COMMAND } from "@/lib/lexical/commands";
import { InviteUserButton } from "@/app/editor/_components/InviteUserButton";
import { Spinner } from "@/components/ui/spinner";
import { AnimatePresence, motion } from "motion/react";
import { isValidEmailFormat, validateEmail } from "@/lib/email-validation";
import {
  FaChevronDown,
  FaCheck,
  FaXmark,
  FaRightFromBracket,
} from "react-icons/fa6";
import { useSession, signOut } from "@/lib/auth-client";

// Type for document returned from api.document.getAll
type DocumentWithMetadata = {
  id: string;
  title: string;
  content: unknown;
  updatedAt: Date;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  isOwner: boolean;
  isFavorite: boolean;
  role?: "read" | "write";
};

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
  const selectedDocumentIdRef = useRef<string | null>(null);

  // State for sidebar navigation in nested pages (like account)
  // Tracks which sub-page/view is selected and whether we're in detail view
  const [accountSubPage, setAccountSubPage] = useState<string | null>(null);
  const [isInDetailView, setIsInDetailView] = useState(false);
  const accountPageInitializedRef = useRef(false);

  // State for editing account info
  const [isEditingAccountInfo, setIsEditingAccountInfo] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountUsername, setAccountUsername] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const newDocTitleInputRef = useRef<HTMLInputElement>(null);
  const signOutButtonRef = useRef<HTMLButtonElement>(null);
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

  // Get user session for account info
  const { data: session, refetch: refetchSession } = useSession();

  // User update mutation
  const updateUserMutation = api.user.update.useMutation({
    onSuccess: () => {
      toastManager.add({
        title: "Account updated successfully",
        type: "success",
      });
      setIsEditingAccountInfo(false);
      // Manually refetch session to get updated user data
      void refetchSession();
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Failed to update account";
      toastManager.add({
        title: message,
        type: "error",
      });
    },
  });

  const deleteMutation = api.document.delete.useMutation({
    onSuccess: () => {
      toastManager.add({
        title: "Document deleted",
        type: "success",
      });
      void utils?.document.getAll.invalidate();
      setShowDocumentActions(false);
      setSelectedDocumentForActions(null);
      setOpen(false);
      router.push("/editor");
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Failed to delete document";
      toastManager.add({
        title: message,
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
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Failed to update favorite";
      toastManager.add({
        title: message,
        type: "error",
      });
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
        } catch {
          // Some invites might fail, but document is created
          toastManager.add({
            title: "Document created, but some invitations may have failed",
            type: "warning",
          });
        }
      }
      router.push(`/editor/${doc.id}`);
      setOpen(false);
      toastManager.add({
        title: "Document created",
        type: "success",
      });
      // Reset form
      setNewDocTitle("");
      setNewDocMembers([]);
      setNewMemberEmail("");
      setNewMemberRole("write");
      void utils?.document.getAll.invalidate();
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Failed to create document";
      toastManager.add({
        title: message,
        type: "error",
      });
    },
  });
  const updateTitleMutation = api.document.updateTitle.useMutation({
    onSuccess: (res) => {
      toastManager.add({
        title: "Title updated",
        type: "success",
        timeout: 1200,
      });
      setDocumentTitle(res.title);
      setTitleInput(res.title);
      void utils?.document.getAll.invalidate();
      void utils?.document.getById.invalidate({ id: documentId });
      setOpen(false);
    },
    onError: (error) => {
      toastManager.add({
        title: error.message ?? "Failed to update title",
        type: "error",
      });
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
      toastManager.add({
        title: "This email is already added",
        type: "error",
      });
      return;
    }

    // Validate email format
    if (!isValidEmailFormat(trimmedEmail)) {
      toastManager.add({
        title: "Please enter a valid email address",
        type: "error",
      });
      return;
    }

    // Validate with mail.so API
    const validationResult = await validateEmail(trimmedEmail);
    if (!validationResult.valid) {
      toastManager.add({
        title: validationResult.reason ?? "Please enter a valid email address",
        type: "error",
      });
      return;
    }

    // Warn about disposable emails but allow them
    if (validationResult.disposable) {
      toastManager.add({
        title:
          "This email address appears to be from a disposable email service",
        type: "warning",
      });
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
      toastManager.add({
        title: `Switched to ${mode} mode`,
        type: "success",
        timeout: 1500,
      });
      setOpen(false);
    } else {
      // Fallback to direct function call if editor not available
      const result = toggleEditMode(documentId, canWrite);
      if (result === null) {
        toastManager.add({
          title: "Editor not available",
          type: "error",
        });
      } else if (result === false) {
        toastManager.add({
          title: "You don't have permission to edit this document",
          type: "error",
        });
      } else {
        setIsCurrentlyEditable(result);
        const mode = result ? "Edit" : "Read";
        toastManager.add({
          title: `Switched to ${mode} mode`,
          type: "success",
          timeout: 1500,
        });
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
      // Reset sidebar navigation state
      setAccountSubPage(null);
      setIsInDetailView(false);
      // Reset account editing state
      setIsEditingAccountInfo(false);
      setAccountName("");
      setAccountUsername("");
    }
  }, [open, documentId, canWrite, documentTitle]);

  // Initialize account form values when entering account info page
  useEffect(() => {
    if (accountSubPage === "info" && session?.user && !isEditingAccountInfo) {
      setAccountName(session.user.name ?? "");
      setAccountUsername(session.user.username ?? "");
    }
  }, [accountSubPage, session?.user, isEditingAccountInfo]);

  // Auto-focus first input when entering edit mode
  useEffect(() => {
    if (isEditingAccountInfo && accountSubPage === "info") {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isEditingAccountInfo, accountSubPage]);

  // Refocus Command component when exiting edit mode to restore keyboard navigation
  const prevIsEditingAccountInfo = useRef(isEditingAccountInfo);
  useEffect(() => {
    // If we just exited edit mode (was editing, now not editing)
    if (
      prevIsEditingAccountInfo.current &&
      !isEditingAccountInfo &&
      accountSubPage === "info"
    ) {
      const timer = setTimeout(() => {
        // Blur any focused inputs to release focus
        if (document.activeElement instanceof HTMLInputElement) {
          document.activeElement.blur();
        }
        // Ensure the account.info item is selected so arrow keys work
        setSelectedValue("account.info");
        // Small delay to let cmdk update its internal state
        setTimeout(() => {
          // Focus Command.Input to restore keyboard navigation context
          const commandInput = document.querySelector("[cmdk-input]");
          if (commandInput instanceof HTMLInputElement) {
            commandInput.focus();
          }
        }, 10);
      }, 0);
      prevIsEditingAccountInfo.current = isEditingAccountInfo;
      return () => clearTimeout(timer);
    }
    prevIsEditingAccountInfo.current = isEditingAccountInfo;
  }, [isEditingAccountInfo, accountSubPage]);

  // Reset sidebar state when exiting account page, reset initialization flag
  useEffect(() => {
    if (page !== "account") {
      setAccountSubPage(null);
      setIsInDetailView(false);
      accountPageInitializedRef.current = false;
    }
  }, [page]);

  // Reset detail view when accountSubPage becomes null
  useEffect(() => {
    if (page === "account" && !accountSubPage) {
      setIsInDetailView(false);
    }
  }, [accountSubPage, page]);

  // Auto-focus title input when createDocument page opens
  useEffect(() => {
    if (page === "createDocument" && newDocTitleInputRef.current) {
      const timer = setTimeout(() => {
        newDocTitleInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [page]);

  // Auto-focus sign out button when entering logout page detail view
  useEffect(() => {
    if (
      accountSubPage === "logout" &&
      isInDetailView &&
      signOutButtonRef.current
    ) {
      const timer = setTimeout(() => {
        signOutButtonRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [accountSubPage, isInDetailView]);

  // When entering a page, set a sensible default selection
  // This ensures users can immediately press Enter without needing arrow keys
  useEffect(() => {
    if (!page) {
      // Main page - no default selection
      setSelectedValue(undefined);
      return;
    }

    // Use requestAnimationFrame to ensure DOM has updated before setting selection
    // This is especially important for pages with async data like openDocument
    requestAnimationFrame(() => {
      switch (page) {
        case "theme":
          // Default to dark theme option
          setSelectedValue("theme.dark");
          break;
        case "account":
          // Default to first sidebar item (Account Info)
          // Only set default selection when first entering the page (not when navigating within)
          // Detail view is only entered when user presses Enter on an item
          if (!accountPageInitializedRef.current) {
            setSelectedValue("account.info");
            setAccountSubPage("info");
            // Don't auto-enter detail view - user must press Enter
            accountPageInitializedRef.current = true;
          }
          break;
        case "openDocument":
          // Default to first document if available
          if (documents && documents.length > 0 && documents[0]) {
            setSelectedValue(documents[0].title ?? "Untitled");
          } else {
            setSelectedValue(undefined);
          }
          break;
        case "members":
          // Default to invite user button
          setSelectedValue("invite.user");
          break;
        case "title":
        case "createDocument":
          // These pages have input fields that are auto-focused
          // No need to set selectedValue as the input handles focus
          setSelectedValue(undefined);
          break;
        default:
          setSelectedValue(undefined);
      }
    });
  }, [page, documents]); // Only run when page or documents change, not when navigating within account page

  // Refocus Command.Input when exiting nested pages to restore keyboard navigation
  const prevPagesLength = useRef(pages.length);
  useEffect(() => {
    // If we went back (pages.length decreased), refocus Command.Input
    if (pages.length < prevPagesLength.current && !page) {
      // Small delay to ensure the DOM has updated
      const timer = setTimeout(() => {
        // Find the Command.Input element using the cmdk-input attribute
        const commandInput = document.querySelector("[cmdk-input]");
        if (commandInput instanceof HTMLInputElement) {
          commandInput.focus();
        }
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
              if (doc?.id) {
                selectedDocumentIdRef.current = doc.id;
              }
            }

            // Auto-update account sidebar detail view when navigating with arrow keys
            // Note: isInDetailView is only set when Enter is pressed, not on navigation
            if (page === "account" && value) {
              if (value === "account.info") {
                setAccountSubPage("info");
                // Don't set isInDetailView here - only when Enter is pressed
              } else if (value === "account.logout") {
                // Prevent navigation to logout only when actively editing account info
                // This keeps users in edit mode and prevents accidental navigation
                if (accountSubPage === "info" && isEditingAccountInfo) {
                  // Reset selection back to account.info to prevent navigation while editing
                  setSelectedValue("account.info");
                  return;
                }
                setAccountSubPage("logout");
                // Don't set isInDetailView here - only when Enter is pressed
              }
            }
          }}
          onKeyDown={(e) => {
            const target = e.target as HTMLElement | null;
            const isTypingInField =
              !!target &&
              (target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                (target instanceof HTMLElement && target.isContentEditable));

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
                );
                if (selectedItem instanceof HTMLElement) {
                  const itemValue =
                    selectedItem.getAttribute("data-value") ??
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
                setSelectedDocumentForActions(selectedDoc.id);

                // Find the selected item's DOM element and get its position
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(() => {
                  const itemElement = document.querySelector(
                    `[data-value="${selectedDoc.title ?? "Untitled"}"]`,
                  );
                  if (itemElement instanceof HTMLElement) {
                    // Show document actions popover
                    setShowDocumentActions(true);
                  } else {
                    // Fallback: show anyway without position
                    setShowDocumentActions(true);
                  }
                });
              }
              return;
            }

            // Escape: handle navigation hierarchy
            // 1. Close actions popover
            // 2. Cancel editing account info (return to view mode)
            // 3. Exit detail view (return to sidebar view)
            // 4. Exit nested page (return to main page)
            if (e.key === "Escape") {
              if (showDocumentActions) {
                e.preventDefault();
                e.stopPropagation();
                setShowDocumentActions(false);
                setSelectedDocumentForActions(null);
                return;
              }
              // If editing account info, cancel editing
              if (
                isEditingAccountInfo &&
                page === "account" &&
                accountSubPage === "info"
              ) {
                e.preventDefault();
                e.stopPropagation();
                setIsEditingAccountInfo(false);
                // Reset form values to original
                if (session?.user) {
                  setAccountName(session.user.name ?? "");
                  setAccountUsername(session.user.username ?? "");
                }
                return;
              }
              // If in detail view (but not editing), exit detail view to return to sidebar
              if (
                isInDetailView &&
                page === "account" &&
                accountSubPage !== null
              ) {
                e.preventDefault();
                e.stopPropagation();
                setIsInDetailView(false);
                // Ensure the correct sidebar item is selected after exiting detail view
                const selectedItemValue =
                  accountSubPage === "logout"
                    ? "account.logout"
                    : accountSubPage === "info"
                      ? "account.info"
                      : null;
                if (selectedItemValue) {
                  setSelectedValue(selectedItemValue);
                  // Restore focus to enable keyboard navigation
                  setTimeout(() => {
                    // Blur any focused buttons or inputs to release focus
                    if (
                      document.activeElement instanceof HTMLButtonElement ||
                      document.activeElement instanceof HTMLInputElement
                    ) {
                      document.activeElement.blur();
                    }
                    // Small delay to let cmdk update its internal state
                    setTimeout(() => {
                      // Try to focus the selected sidebar item first
                      const selectedItem = document.querySelector(
                        `[cmdk-item][value="${selectedItemValue}"]`,
                      );
                      if (selectedItem instanceof HTMLElement) {
                        selectedItem.focus();
                      } else {
                        // Fallback: focus Command.Input to restore keyboard navigation context
                        const commandInput =
                          document.querySelector("[cmdk-input]");
                        if (commandInput instanceof HTMLInputElement) {
                          commandInput.focus();
                        }
                      }
                    }, 10);
                  }, 0);
                }
                return;
              }
              // If in nested page, go back to main page
              if (pages.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                setPages((prev) => prev.slice(0, -1));
                return;
              }
            }

            // Enter: execute action for account sidebar items or enter edit mode
            if (e.key === "Enter" && !isTypingInField && page === "account") {
              // Don't intercept Enter if focus is on a button or other interactive element in the content area
              const target = e.target as HTMLElement | null;
              const activeElement = document.activeElement;

              // If focus is on a button, let it handle Enter naturally
              if (
                target?.tagName === "BUTTON" ||
                activeElement?.tagName === "BUTTON"
              ) {
                // Let the button handle Enter naturally
                return;
              }

              // If in detail view and focus is not on a sidebar item, don't intercept
              // (allows buttons and other content area elements to handle Enter)
              if (isInDetailView) {
                const isFocusOnSidebarItem = activeElement?.closest(
                  "[data-account-sidebar-item]",
                );
                if (!isFocusOnSidebarItem) {
                  // Focus is in content area, let it handle Enter
                  return;
                }
              }

              // Check sidebar item selection
              const selectedItem = document.querySelector(
                '[cmdk-item][aria-selected="true"][data-account-sidebar-item]',
              );

              // Handle account info
              if (selectedItem instanceof HTMLElement) {
                const subPage = selectedItem.getAttribute(
                  "data-account-sidebar-item",
                );

                if (subPage === "info") {
                  e.preventDefault();
                  e.stopPropagation();
                  // If not yet on account info page, navigate to it first
                  if (accountSubPage !== "info") {
                    setAccountSubPage("info");
                  }
                  // Enter detail view and edit mode
                  setIsInDetailView(true);
                  setIsEditingAccountInfo(true);
                  return;
                } else if (subPage === "logout") {
                  e.preventDefault();
                  e.stopPropagation();
                  // If not yet on logout page, navigate to it first
                  if (accountSubPage !== "logout") {
                    setAccountSubPage("logout");
                  }
                  // Enter detail view to show the sign out button
                  setIsInDetailView(true);
                  // Focus the sign out button after entering detail view
                  setTimeout(() => {
                    signOutButtonRef.current?.focus();
                  }, 0);
                  return;
                }
              }

              // Fallback: if already on logout page but not in detail view, enter detail view
              if (accountSubPage === "logout" && !isInDetailView) {
                e.preventDefault();
                e.stopPropagation();
                setIsInDetailView(true);
                // Focus the sign out button after entering detail view
                setTimeout(() => {
                  signOutButtonRef.current?.focus();
                }, 0);
                return;
              }

              // Fallback: if already on info page but not in detail view, enter detail view
              if (accountSubPage === "info" && !isInDetailView) {
                e.preventDefault();
                e.stopPropagation();
                setIsInDetailView(true);
                setIsEditingAccountInfo(true);
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
                          : page === "account"
                            ? "Account"
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

                  <Command.Item
                    value="account"
                    onSelect={() => {
                      setPages((prev) => [...prev, "account"]);
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
                    <span className="flex-1">Account…</span>
                    <Kbd className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 pointer-events-none flex items-center justify-center rounded-md border-none px-1.5 py-1 font-normal select-none">
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

              {page === "account" && (
                <>
                  {/* Always show sidebar + detail view layout */}
                  <div className="flex h-full">
                    {/* Left sidebar - animated width */}
                    <motion.div
                      className="border-border border-r pr-2"
                      animate={{
                        width: isInDetailView ? 64 : 192,
                      }}
                      transition={{
                        duration: 0.25,
                        ease: [0.215, 0.61, 0.355, 1], // ease-out-cubic
                      }}
                    >
                      <Command.Group className="mb-0">
                        <Command.Item
                          value="account.info"
                          data-account-sidebar-item="info"
                          onSelect={() => {
                            // If already on account info page and not editing, enter edit mode
                            if (
                              accountSubPage === "info" &&
                              !isEditingAccountInfo
                            ) {
                              setIsEditingAccountInfo(true);
                              setIsInDetailView(true);
                            } else if (accountSubPage !== "info") {
                              // If not on info page, navigate to it (but don't enter detail view yet)
                              setAccountSubPage("info");
                              // Detail view will be entered when user presses Enter
                            }
                          }}
                          className={`group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center rounded-xl py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 ${
                            isInDetailView
                              ? "justify-center gap-0 px-2"
                              : "gap-3 pr-3 pl-2"
                          } ${accountSubPage === "info" ? "bg-accent/50" : ""}`}
                        >
                          <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex shrink-0 items-center justify-center rounded-md p-2">
                            <FaUser
                              size={13}
                              className="text-primary/50 shrink-0"
                            />
                          </span>
                          <AnimatePresence mode="wait">
                            {!isInDetailView && (
                              <motion.span
                                className="flex-1"
                                initial={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{
                                  duration: 0.2,
                                  ease: [0.215, 0.61, 0.355, 1],
                                }}
                              >
                                Account Info
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {accountSubPage === "info" && !isInDetailView && (
                            <div className="text-primary size-2 shrink-0 rounded-full bg-current" />
                          )}
                        </Command.Item>
                        <Command.Item
                          value="account.logout"
                          data-account-sidebar-item="logout"
                          onSelect={() => {
                            // If already on logout page, enter detail view (this handles Enter key press)
                            if (
                              accountSubPage === "logout" &&
                              !isInDetailView
                            ) {
                              setIsInDetailView(true);
                              // Focus the sign out button after entering detail view
                              setTimeout(() => {
                                signOutButtonRef.current?.focus();
                              }, 0);
                              return;
                            }
                            // Navigate to logout sub-page (but don't enter detail view yet)
                            // User must press Enter again to enter detail view and see the sign out button
                            if (
                              !isInDetailView ||
                              accountSubPage !== "logout"
                            ) {
                              setAccountSubPage("logout");
                            }
                            // Detail view will be entered when user presses Enter (handled by Enter key handler or this onSelect)
                          }}
                          className={`group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center rounded-xl py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 ${
                            isInDetailView
                              ? "justify-center gap-0 px-2"
                              : "gap-3 pr-3 pl-2"
                          } ${
                            accountSubPage === "logout" ? "bg-accent/50" : ""
                          }`}
                        >
                          <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex shrink-0 items-center justify-center rounded-md p-2">
                            <FaRightFromBracket
                              size={13}
                              className="text-primary/50 shrink-0"
                            />
                          </span>
                          <AnimatePresence mode="wait">
                            {!isInDetailView && (
                              <motion.span
                                className="flex-1"
                                initial={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{
                                  duration: 0.2,
                                  ease: [0.215, 0.61, 0.355, 1],
                                }}
                              >
                                Sign out
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {accountSubPage === "logout" && !isInDetailView && (
                            <div className="text-primary size-2 shrink-0 rounded-full bg-current" />
                          )}
                        </Command.Item>
                      </Command.Group>
                    </motion.div>
                    {/* Right side - detail content (always visible, updates based on selection) */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                      {accountSubPage === "info" && session?.user && (
                        <div className="space-y-4">
                          <div>
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-primary/50 text-xs font-medium tracking-wider uppercase">
                                Account Information
                              </h3>
                              {!isEditingAccountInfo && (
                                <div className="flex items-center gap-2">
                                  <KbdGroup className="flex items-center gap-0.5">
                                    <Kbd className="bg-background pointer-events-none rounded-md border-none px-1.5 py-1 text-[10px] select-none">
                                      Enter
                                    </Kbd>
                                  </KbdGroup>
                                  <span className="text-primary/40 text-xs">
                                    to edit
                                  </span>
                                </div>
                              )}
                            </div>
                            {isEditingAccountInfo ? (
                              <div className="bg-card space-y-3 rounded-2xl border px-4 py-3">
                                <div className="space-y-2">
                                  <label className="text-primary/50 text-xs">
                                    Name
                                  </label>
                                  <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={accountName}
                                    onChange={(e) =>
                                      setAccountName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      // Tab: move to username field
                                      if (e.key === "Tab" && !e.shiftKey) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        usernameInputRef.current?.focus();
                                      }
                                      // ArrowDown: move to username field
                                      if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        usernameInputRef.current?.focus();
                                      }
                                      // Enter: save (if not empty)
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (accountName.trim()) {
                                          updateUserMutation.mutate({
                                            name: accountName.trim(),
                                            username:
                                              accountUsername.trim() || null,
                                          });
                                        }
                                      }
                                      // Escape: cancel editing
                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsEditingAccountInfo(false);
                                        if (session?.user) {
                                          setAccountName(
                                            session.user.name ?? "",
                                          );
                                          setAccountUsername(
                                            session.user.username ?? "",
                                          );
                                        }
                                      }
                                    }}
                                    placeholder="Enter your name"
                                    className="text-primary bg-background border-border focus:ring-primary/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                                  />
                                </div>
                                <div className="border-border border-t pt-3">
                                  <div className="text-primary/50 mb-1 text-xs">
                                    Email
                                  </div>
                                  <div className="text-primary truncate text-sm">
                                    {session.user.email}
                                  </div>
                                  <div className="text-primary/40 mt-1 text-xs">
                                    Email cannot be changed
                                  </div>
                                </div>
                                <div className="border-border border-t pt-3">
                                  <div className="space-y-2">
                                    <label className="text-primary/50 text-xs">
                                      Username
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <span className="text-primary/50 text-sm">
                                        @
                                      </span>
                                      <input
                                        ref={usernameInputRef}
                                        type="text"
                                        value={accountUsername}
                                        onChange={(e) => {
                                          // Remove @ if user types it
                                          const value = e.target.value.replace(
                                            /^@+/,
                                            "",
                                          );
                                          setAccountUsername(value);
                                        }}
                                        onKeyDown={(e) => {
                                          // Shift+Tab: move to name field
                                          if (e.key === "Tab" && e.shiftKey) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            nameInputRef.current?.focus();
                                          }
                                          // ArrowUp: move to name field
                                          if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            nameInputRef.current?.focus();
                                          }
                                          // Enter: save
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            updateUserMutation.mutate({
                                              name: accountName.trim(),
                                              username:
                                                accountUsername.trim() || null,
                                            });
                                          }
                                          // Escape: cancel editing
                                          if (e.key === "Escape") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsEditingAccountInfo(false);
                                            if (session?.user) {
                                              setAccountName(
                                                session.user.name ?? "",
                                              );
                                              setAccountUsername(
                                                session.user.username ?? "",
                                              );
                                            }
                                          }
                                        }}
                                        placeholder="username"
                                        className="text-primary bg-background border-border focus:ring-primary/50 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="border-border flex items-center justify-end gap-2 border-t pt-3">
                                  <button
                                    onClick={() => {
                                      setIsEditingAccountInfo(false);
                                      if (session?.user) {
                                        setAccountName(session.user.name ?? "");
                                        setAccountUsername(
                                          session.user.username ?? "",
                                        );
                                      }
                                    }}
                                    className="text-primary/70 hover:text-primary rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (accountName.trim()) {
                                        updateUserMutation.mutate({
                                          name: accountName.trim(),
                                          username:
                                            accountUsername.trim() || null,
                                        });
                                      }
                                    }}
                                    disabled={
                                      !accountName.trim() ||
                                      updateUserMutation.isPending
                                    }
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                    type="button"
                                  >
                                    {updateUserMutation.isPending
                                      ? "Saving..."
                                      : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-card space-y-3 rounded-2xl border px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="bg-cmdk-kbd-disabled flex items-center justify-center rounded-full p-2">
                                    <FaUser
                                      size={16}
                                      className="text-primary/50 shrink-0"
                                    />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-primary/50 mb-1 text-xs">
                                      Name
                                    </div>
                                    <div className="text-primary truncate text-sm font-medium">
                                      {session.user.name ?? "Not set"}
                                    </div>
                                  </div>
                                </div>
                                <div className="border-border border-t pt-3">
                                  <div className="text-primary/50 mb-1 text-xs">
                                    Email
                                  </div>
                                  <div className="text-primary truncate text-sm">
                                    {session.user.email}
                                  </div>
                                </div>
                                {session.user.username && (
                                  <div className="border-border border-t pt-3">
                                    <div className="text-primary/50 mb-1 text-xs">
                                      Username
                                    </div>
                                    <div className="text-primary truncate text-sm">
                                      @{session.user.username ?? ""}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {accountSubPage === "logout" && (
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-primary/50 mb-3 text-xs font-medium tracking-wider uppercase">
                              Sign Out
                            </h3>
                            <div className="bg-card rounded-2xl border px-4 py-3">
                              <p className="text-primary/70 mb-8 text-sm">
                                Are you sure you want to sign out?
                                <br />
                                You&apos;ll need to sign in again to access your
                                account.
                              </p>
                              {isInDetailView ? (
                                <button
                                  ref={signOutButtonRef}
                                  onClick={async () => {
                                    try {
                                      await signOut();
                                      toastManager.add({
                                        title: "Signed out successfully",
                                        type: "success",
                                      });
                                      setOpen(false);
                                      router.push("/sign-in");
                                    } catch {
                                      toastManager.add({
                                        title: "Failed to sign out",
                                        type: "error",
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    // Handle Enter key on button
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      e.currentTarget.click();
                                    }
                                  }}
                                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary focus-visible:outline-primary flex items-center gap-3 rounded-xl px-4 py-2 pr-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                                  type="button"
                                >
                                  <span>Sign Out</span>

                                  <Kbd className="bg-background/20 pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                                    <FaTurnDown
                                      size={12}
                                      className="text-primary-foreground/70 -mb-0.5 rotate-90"
                                    />
                                  </Kbd>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <KbdGroup className="flex items-center gap-0.5">
                                    <Kbd className="bg-background pointer-events-none rounded-md border-none px-1.5 py-1 text-[10px] select-none">
                                      Enter
                                    </Kbd>
                                  </KbdGroup>
                                  <span className="text-primary/40 text-xs">
                                    to sign out
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {!accountSubPage && (
                        <div className="flex h-full items-center justify-center">
                          <div className="text-primary/30 text-sm">
                            Select an option to view details
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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
                                  );
                                  if (
                                    selectedItem instanceof HTMLElement &&
                                    el
                                  ) {
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
                              ) ?? ({} as DocumentWithMetadata)
                            }
                            onClose={() => {
                              setShowDocumentActions(false);
                              setSelectedDocumentForActions(null);
                            }}
                            onDelete={() => {
                              const doc = documents.find(
                                (d) => d.id === selectedDocumentForActions,
                              );
                              if (!doc?.isOwner) {
                                toastManager.add({
                                  title:
                                    "Only document owners can delete documents",
                                  type: "error",
                                });
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
                              if (selectedDocumentForActions) {
                                toggleFavoriteMutation.mutate({
                                  documentId: selectedDocumentForActions,
                                });
                              }
                            }}
                            onOpen={() => {
                              if (selectedDocumentForActions) {
                                navigateToDocument(selectedDocumentForActions);
                              }
                              setShowDocumentActions(false);
                              setSelectedDocumentForActions(null);
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
                                      );
                                    if (
                                      nextButton instanceof HTMLButtonElement
                                    ) {
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
                  ) : page == "account" ? (
                    <>
                      {isEditingAccountInfo ? (
                        <>
                          <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                            Esc
                          </Kbd>
                          to cancel
                          <span className="mx-1">•</span>
                          <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                            Enter
                          </Kbd>
                          to save
                        </>
                      ) : accountSubPage === "info" ? (
                        <>
                          <Kbd className="bg-background pointer-events-none rounded-md border-none px-2 py-1 text-[10px] select-none">
                            Enter
                          </Kbd>
                          to edit
                        </>
                      ) : (
                        <>
                          <Kbd className="bg-background pointer-events-none items-center justify-center rounded-md border-none px-2 py-1 select-none">
                            <FaTurnDown
                              size={12}
                              className="text-icon-button -mb-0.5 rotate-90"
                            />
                          </Kbd>
                          to navigate
                        </>
                      )}
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
  doc: DocumentWithMetadata;
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
