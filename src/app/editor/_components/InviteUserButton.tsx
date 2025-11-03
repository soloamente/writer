"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Command } from "cmdk";
import { FaPen, FaEye, FaPlus, FaChevronDown, FaCheck } from "react-icons/fa6";
import { AnimatePresence, motion } from "motion/react";
import { Label } from "@/components/ui/label";
import { isValidEmailFormat, validateEmail } from "@/lib/email-validation";

interface InviteUserButtonProps {
  documentId: string;
  autoOpen?: boolean;
  onClose?: () => void;
}

export function InviteUserButton({
  documentId,
  autoOpen = false,
  onClose,
}: InviteUserButtonProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"read" | "write">("write");
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [showRoleOptions, setShowRoleOptions] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const firstRoleButtonRef = useRef<HTMLButtonElement>(null);
  const utils = api.useUtils?.();
  const inviteMutation = api.document.inviteUser.useMutation({
    onSuccess: () => {
      toast.success("User invited successfully");
      setEmail("");
      setIsOpen(false);
      setShowRoleOptions(false);
      void utils?.document.getMembers.invalidate({ documentId });
      void utils?.document.getAll.invalidate();
    },
    onError: (error: { message?: string }) => {
      toast.error(error?.message ?? "Failed to invite user. Please try again.");
    },
  });

  // Auto-open form if autoOpen prop changes
  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  // Auto-focus email input when form opens
  useEffect(() => {
    if (isOpen && emailInputRef.current && !showRoleOptions) {
      // Small delay to ensure the form is rendered
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, showRoleOptions]);

  // Auto-focus first role option when role options are shown
  useEffect(() => {
    if (showRoleOptions && firstRoleButtonRef.current) {
      const timer = setTimeout(() => {
        firstRoleButtonRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showRoleOptions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();

    // First check basic format for immediate feedback
    if (!isValidEmailFormat(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Then validate with mail.so API for thorough validation
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

    inviteMutation.mutate({ documentId, userEmail: trimmedEmail, role });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Escape key closes the form or role options
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (showRoleOptions) {
        setShowRoleOptions(false);
        emailInputRef.current?.focus();
      } else {
        setIsOpen(false);
        setEmail("");
        onClose?.();
      }
      return;
    }

    // Prevent command palette navigation when typing in inputs
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLButtonElement
    ) {
      e.stopPropagation();
    }
  }

  function handleRoleSelect(newRole: "read" | "write") {
    setRole(newRole);
    setShowRoleOptions(false);
    emailInputRef.current?.focus();
  }

  if (!isOpen) {
    return (
      <Command.Item
        value="invite.user"
        onSelect={() => setIsOpen(true)}
        className="group text-primary/50 aria-selected:bg-accent aria-selected:text-primary relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
      >
        <span className="bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
          <FaPlus size={13} className="text-primary/50 shrink-0" />
        </span>
        <span className="flex-1">Invite user…</span>
      </Command.Item>
    );
  }

  return (
    <div className="mb-1 px-2 py-1.5">
      <div className="space-y-2" onKeyDown={handleKeyDown}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!showRoleOptions && isValidEmailFormat(email.trim())) {
              void handleSubmit(e);
            }
          }}
          className="flex items-center gap-2"
        >
          <Label className="bg-background/50 text-primary flex flex-1 items-center justify-between rounded-2xl border py-2 pr-2 pl-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                handleKeyDown(e);
                // Tab moves to role button, not directly to options
                // Users can press Enter/Space on role button to open options
              }}
              placeholder="user@example.com"
              className="placeholder:text-primary/50"
              required
              disabled={inviteMutation.isPending || showRoleOptions}
              aria-label="Email address"
              autoFocus
            />
            <AnimatePresence mode="wait">
              {isValidEmailFormat(email) ? (
                <motion.span
                  key="valid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.2 } }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  className="group-aria-selected:bg-accent-foreground/20 flex items-center justify-center rounded-full bg-green-600 p-1"
                >
                  <FaCheck size={12} className="text-primary shrink-0" />
                </motion.span>
              ) : (
                <motion.span
                  key="invalid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.2 } }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
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
              type="button"
              onClick={() => setShowRoleOptions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowRoleOptions(true);
                }
              }}
              className="group aria-selected:bg-accent text-primary bg-cmdk-kbd-disabled group-aria-selected:bg-accent-foreground/20 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none select-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={inviteMutation.isPending}
              aria-label="Select permission role"
            >
              {role === "write" ? (
                <FaPen size={13} className="text-primary shrink-0" />
              ) : (
                <FaEye size={13} className="text-primary shrink-0" />
              )}
              <span className="capitalize">{role}</span>
              <FaChevronDown size={13} className="text-primary/50 shrink-0" />
            </button>
          )}
          {!showRoleOptions && (
            <button
              type="submit"
              className="group text-primary-foreground bg-primary aria-selected:bg-accent aria-selected:text-primary group-aria-selected:bg-accent-foreground/20 disabled:bg-cmdk-kbd-disabled disabled:text-cmdk-kbd-active-foreground flex cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm outline-none select-none disabled:cursor-not-allowed"
              disabled={
                inviteMutation.isPending || !isValidEmailFormat(email.trim())
              }
              aria-label="Invite user"
            >
              {inviteMutation.isPending ? "Inviting..." : "Invite"}
            </button>
          )}
        </form>

        <AnimatePresence>
          {showRoleOptions && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="mt-2 space-y-1"
            >
              <button
                ref={firstRoleButtonRef}
                type="button"
                onClick={() => handleRoleSelect("read")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRoleSelect("read");
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    // Focus next button
                    const nextButton = e.currentTarget
                      .nextElementSibling as HTMLButtonElement;
                    nextButton?.focus();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setShowRoleOptions(false);
                    emailInputRef.current?.focus();
                  }
                }}
                className={`group text-primary/50 hover:bg-accent hover:text-primary aria-selected:bg-accent aria-selected:text-primary focus-visible:ring-primary/50 relative flex w-full cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-3 pl-2 text-sm ease-out outline-none select-none focus-visible:ring-2 ${
                  role === "read" ? "bg-accent/50" : ""
                }`}
                aria-label="Select read permission"
              >
                <span className="bg-cmdk-kbd-disabled group-hover:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                  <FaEye size={13} className="text-primary/50 shrink-0" />
                </span>
                <span className="flex-1 text-left">Read</span>
                {role === "read" && (
                  <div className="text-primary size-2 shrink-0 rounded-full bg-current" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect("write")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRoleSelect("write");
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    // Focus previous button
                    const prevButton = e.currentTarget
                      .previousElementSibling as HTMLButtonElement;
                    prevButton?.focus();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setShowRoleOptions(false);
                    emailInputRef.current?.focus();
                  }
                }}
                className={`group text-primary/50 hover:bg-accent hover:text-primary aria-selected:bg-accent aria-selected:text-primary focus-visible:ring-primary/50 relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ease-out outline-none select-none focus-visible:ring-2 ${
                  role === "write" ? "bg-accent/50" : ""
                }`}
                aria-label="Select write permission"
              >
                <span className="bg-cmdk-kbd-disabled group-hover:bg-accent-foreground/20 flex items-center justify-center rounded-md p-2">
                  <FaPen size={13} className="text-primary/50 shrink-0" />
                </span>
                <span className="flex-1 text-left">Write</span>
                {role === "write" && (
                  <div className="text-primary h-2 w-2 shrink-0 rounded-full bg-current" />
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
