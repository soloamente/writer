"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { FaStar } from "react-icons/fa6";
import {
  Search,
  Grid3x3,
  List,
  FileText,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CreateDocumentButton } from "./CreateDocumentButton";
import { useRouter } from "next/navigation";
import { toastManager } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Document = {
  id: string;
  title: string | null;
  content: unknown;
  updatedAt: Date;
  userId: string;
  isOwner: boolean;
  isFavorite: boolean;
  role?: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type FilterType = "all" | "favorites" | "owned" | "shared";
type SortType = "updated-desc" | "updated-asc" | "title-asc" | "title-desc";

type PreviewNode = {
  type: "heading" | "quote" | "list" | "paragraph" | "text";
  level?: number; // For headings (1-6)
  text: string;
  children?: PreviewNode[];
};

function extractStructuredPreview(
  content: unknown,
  maxNodes = 8,
): PreviewNode[] {
  try {
    // Parse if content is a string
    let parsed: any = content;
    if (typeof content === "string") {
      try {
        parsed = JSON.parse(content);
      } catch {
        return [];
      }
    }

    const root = parsed?.root ?? parsed;
    const children = root?.children ?? [];
    const preview: PreviewNode[] = [];

    const extractText = (node: any): string => {
      if (!node || typeof node !== "object") return "";
      if (node.type === "text" && typeof node.text === "string") {
        return node.text;
      }
      const nodeChildren = Array.isArray(node.children) ? node.children : [];
      return nodeChildren.map(extractText).filter(Boolean).join(" ");
    };

    for (const node of children) {
      if (preview.length >= maxNodes) break;

      const text = extractText(node).trim();
      if (!text) continue;

      const nodeType = node.type?.toLowerCase() || "";

      if (nodeType.includes("heading")) {
        const level = parseInt(node.tag?.replace("h", "") || "1", 10) || 1;
        preview.push({ type: "heading", level, text });
      } else if (nodeType.includes("quote") || nodeType === "quote") {
        preview.push({ type: "quote", text });
      } else if (nodeType.includes("list")) {
        // Extract all list items, not just first 2
        const listItems = Array.isArray(node.children)
          ? node.children.map((item: any) => extractText(item)).filter(Boolean)
          : [];
        if (listItems.length > 0) {
          preview.push({
            type: "list",
            text: listItems.join(" • "),
          });
        }
      } else if (text.length > 0) {
        // Regular paragraph or other block - show full text
        preview.push({ type: "paragraph", text });
      }
    }

    return preview;
  } catch {
    return [];
  }
}

function extractPlainText(content: unknown, limit = 180): string {
  try {
    // Parse if content is a string
    let parsed: any = content;
    if (typeof content === "string") {
      try {
        parsed = JSON.parse(content);
      } catch {
        return "";
      }
    }

    // Lexical editorState.toJSON() returns { root: { children: [...] } }
    // We need to traverse the root's children
    const walk = (node: any): string => {
      if (!node || typeof node !== "object") return "";

      // If this is a text node, return its text
      if (node.type === "text" && typeof node.text === "string") {
        return node.text;
      }

      // Recurse into children array
      const children = Array.isArray(node.children) ? node.children : [];
      const childTexts = children.map(walk).filter(Boolean);
      return childTexts.join(" ");
    };

    // Start from root if it exists, otherwise start from the content itself
    const root = parsed?.root ?? parsed;
    const text = walk(root);
    const trimmed = text.replace(/\s+/g, " ").trim();
    return trimmed.length > limit ? trimmed.slice(0, limit - 1) + "…" : trimmed;
  } catch {
    return "";
  }
}

function formatDate(date: Date): string {
  const now = new Date();
  const docDate = new Date(date);
  const diffMs = now.getTime() - docDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Check if it's today
  const isToday =
    docDate.getDate() === now.getDate() &&
    docDate.getMonth() === now.getMonth() &&
    docDate.getFullYear() === now.getFullYear();

  // Check if it's yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    docDate.getDate() === yesterday.getDate() &&
    docDate.getMonth() === yesterday.getMonth() &&
    docDate.getFullYear() === yesterday.getFullYear();

  if (isToday) {
    return "TODAY";
  } else if (isYesterday) {
    return "YESTERDAY";
  } else if (diffDays < 7) {
    // Format as "FRI, 28 APR 23"
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const dayName = days[docDate.getDay()];
    const day = docDate.getDate();
    const month = months[docDate.getMonth()];
    const year = docDate.getFullYear().toString().slice(-2);
    return `${dayName}, ${day} ${month} ${year}`;
  } else {
    // Format as "THU, 4 MAY 23" for older dates
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const dayName = days[docDate.getDay()];
    const day = docDate.getDate();
    const month = months[docDate.getMonth()];
    const year = docDate.getFullYear().toString().slice(-2);
    return `${dayName}, ${day} ${month} ${year}`;
  }
}

function DocumentsListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: i * 0.05,
          }}
          className="border-border/20 bg-card h-[340px] rounded-3xl border p-6 backdrop-blur-sm"
        >
          <div className="mb-6 flex items-start justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="mb-4 h-8 w-3/4 rounded-lg" />
          <Skeleton className="mb-2 h-4 w-full rounded-md" />
          <Skeleton className="mb-2 h-4 w-full rounded-md" />
          <Skeleton className="mb-8 h-4 w-2/3 rounded-md" />
          <div className="border-border/30 flex items-center justify-between border-t pt-4">
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    shared: "bg-blue-500/30 text-blue-200",
    favorite: "bg-purple-500/30 text-purple-200",
    personal: "bg-purple-500/30 text-purple-200",
    work: "bg-orange-500/30 text-orange-200",
    gym: "bg-green-500/30 text-green-200",
  };
  return colors[tag.toLowerCase()] || "bg-muted/40 text-muted-foreground";
}

function DocumentPreview({ content }: { content: unknown }) {
  const previewNodes = extractStructuredPreview(content, 15);

  if (previewNodes.length === 0) {
    return (
      <div className="text-primary/60 flex h-full min-h-[140px] items-center justify-center">
        Empty
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pb-2 opacity-40">
      {previewNodes.map((node, idx) => {
        if (node.type === "heading") {
          const headingSizes: Record<number, string> = {
            1: "text-sm font-bold",
            2: "text-xs font-semibold",
            3: "text-xs font-semibold",
          };
          const size = headingSizes[node.level || 1] || "text-xs font-semibold";
          return (
            <div
              key={idx}
              className={`${size} text-foreground wrap-break-words`}
            >
              {node.text}
            </div>
          );
        } else if (node.type === "quote") {
          return (
            <div
              key={idx}
              className="border-border/40 text-foreground/80 wrap-break-words border-l-2 pl-2 text-xs italic"
            >
              {node.text}
            </div>
          );
        } else if (node.type === "list") {
          return (
            <div key={idx} className="text-foreground wrap-break-words text-xs">
              {node.text}
            </div>
          );
        } else {
          return (
            <p key={idx} className="text-foreground wrap-break-words text-xs">
              {node.text}
            </p>
          );
        }
      })}
    </div>
  );
}

function CreateDocumentCard({ index }: { index: number }) {
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
      await utils?.document.getAll.invalidate();
      router.push(`/editor/${doc.id}`);
    } catch (error) {
      // Error already handled by onError callback
    } finally {
      setCreating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: index * 0.04,
      }}
      className="group relative"
    >
      <button
        onClick={handleCreate}
        disabled={creating}
        aria-label="Create new document"
        className="border-border/80 hover:border-border/50 focus-visible:ring-ring/30 relative flex h-[340px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed bg-transparent p-6 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="bg-card group-hover:bg-primary/10 flex items-center justify-center rounded-2xl p-2 transition-colors duration-300">
            <Plus className="text-foreground/60 group-hover:text-primary size-8 transition-colors duration-300" />
          </div>
          <div className="text-center">
            <p className="text-foreground/80 text-sm font-medium">
              Create new document
            </p>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function DocumentCard({
  doc,
  index,
  viewMode,
}: {
  doc: Document;
  index: number;
  viewMode: "grid" | "list";
}) {
  const isOwner = doc.isOwner ?? true;
  const isFavorite = doc.isFavorite ?? false;
  const ownerInfo = doc.user ? `${doc.user.name || doc.user.email}` : "Unknown";

  // Generate tags based on document properties
  const tags: string[] = [];
  if (!isOwner) tags.push("shared");
  if (isFavorite) tags.push("favorite");

  if (viewMode === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: 0.3,
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: index * 0.02,
        }}
        className="group relative"
      >
        <Link
          href={`/editor/${doc.id}`}
          aria-label={`Open document ${doc.title || "Untitled"}`}
          className="border-border/20 bg-card hover:border-border/30 hover:bg-card focus-visible:ring-ring/30 relative flex h-[340px] items-center gap-6 overflow-hidden rounded-3xl border p-6 backdrop-blur-sm transition-all duration-300 ease-out hover:shadow-xl hover:shadow-black/30 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <div className="relative z-10 flex flex-1 items-center gap-6">
            <div className="min-w-0 flex-1">
              {/* Tags at top right */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-foreground line-clamp-1 flex-1 text-xl font-bold tracking-tight">
                  {doc.title || "Untitled"}
                </h2>
                {tags.length > 0 && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getTagColor(tag)}`}
                      >
                        {tag === "shared"
                          ? "SHARED"
                          : tag === "favorite"
                            ? "FAV"
                            : tag.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!isOwner && (
                <div className="text-foreground/50 mb-2 text-xs font-medium">
                  {ownerInfo}
                  {doc.role && ` • ${doc.role}`}
                </div>
              )}
              <div className="text-foreground/80 mb-4 line-clamp-2 text-sm leading-relaxed">
                <DocumentPreview content={doc.content} />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-foreground/60 text-xs font-semibold tracking-wider uppercase">
                  {formatDate(doc.updatedAt)}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                  className="text-foreground/40 hover:text-foreground/70 flex h-6 w-6 items-center justify-center rounded transition-colors"
                  aria-label="More options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: index * 0.04,
      }}
      className="group relative"
    >
      <Link
        href={`/editor/${doc.id}`}
        aria-label={`Open document ${doc.title || "Untitled"}`}
        className="border-border/20 bg-card hover:border-border/30 hover:bg-card focus-visible:ring-ring/30 relative flex h-[340px] flex-col overflow-hidden rounded-3xl border p-6 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <div className="relative z-10 flex h-full flex-col">
          {/* Tags at top right */}
          {tags.length > 0 && (
            <div className="mb-3 flex justify-end gap-1.5">
              {tags.slice(0, 3).map((tag, idx) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.04 + idx * 0.05 }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${getTagColor(tag)}`}
                >
                  {tag === "shared"
                    ? "SHARED"
                    : tag === "favorite"
                      ? "FAV"
                      : tag.toUpperCase()}
                </motion.span>
              ))}
            </div>
          )}

          {/* Title */}
          <h2 className="text-foreground mb-4 line-clamp-2 text-2xl leading-tight font-medium">
            {doc.title || "Untitled"}
          </h2>

          {/* Preview - takes up remaining space with fade-out effect */}
          <div className="relative flex-1 overflow-hidden">
            <div
              className="relative h-full overflow-hidden"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
              }}
            >
              <DocumentPreview content={doc.content} />
            </div>
          </div>

          {/* Footer with date and menu */}
          <div className="mt-auto flex items-center justify-between">
            <div className="text-foreground/60 text-md font-medium tracking-wider uppercase">
              {formatDate(doc.updatedAt)}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                // TODO: Open document menu
              }}
              className="text-foreground/40 hover:text-foreground/70 flex h-6 w-6 items-center justify-center rounded transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function DocumentsList() {
  const { data: docs, isLoading } = api.document.getAll.useQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("updated-desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredAndSortedDocs = useMemo(() => {
    if (!docs) return [];

    let filtered = [...docs];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) => {
        const title = (doc.title || "Untitled").toLowerCase();
        const preview = extractPlainText(doc.content).toLowerCase();
        return title.includes(query) || preview.includes(query);
      });
    }

    // Apply type filter
    if (filter === "favorites") {
      filtered = filtered.filter((doc) => doc.isFavorite);
    } else if (filter === "owned") {
      filtered = filtered.filter((doc) => doc.isOwner);
    } else if (filter === "shared") {
      filtered = filtered.filter((doc) => !doc.isOwner);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case "updated-desc":
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        case "updated-asc":
          return (
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          );
        case "title-asc":
          return (a.title || "Untitled").localeCompare(b.title || "Untitled");
        case "title-desc":
          return (b.title || "Untitled").localeCompare(a.title || "Untitled");
        default:
          return 0;
      }
    });

    return filtered;
  }, [docs, searchQuery, filter, sort]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-foreground text-4xl font-semibold tracking-tight">
              Your documents
            </h1>
            <p className="text-muted-foreground/80 text-base">
              Manage and organize your documents
            </p>
          </div>
        </div>
        <DocumentsListSkeleton />
      </main>
    );
  }

  if (!docs || docs.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-foreground text-4xl font-semibold tracking-tight">
              Your documents
            </h1>
            <p className="text-muted-foreground/80 text-base">
              Manage and organize your documents
            </p>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Empty className="border-border/50 bg-card/30 border-dashed py-16 backdrop-blur-sm">
            <EmptyMedia variant="icon">
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  duration: 0.5,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  delay: 0.2,
                }}
                className="from-primary/10 to-primary/5 rounded-2xl bg-gradient-to-br p-4"
              >
                <FileText className="text-primary/60 size-8" />
              </motion.div>
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-2xl font-semibold tracking-tight">
                No documents yet
              </EmptyTitle>
              <EmptyDescription className="text-muted-foreground/80 mt-3 text-base leading-relaxed">
                Get started by creating your first document. You can write,
                edit, and collaborate on all your documents in one place.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="mt-8">
              <CreateDocumentButton />
            </EmptyContent>
          </Empty>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="space-y-2">
          <h1 className="text-foreground text-4xl font-semibold tracking-tight">
            Your documents
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground/80 text-base">
              {docs.length} {docs.length === 1 ? "document" : "documents"}
            </p>
            {filteredAndSortedDocs.length !== docs.length && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-primary/10 text-primary/80 rounded-full px-2.5 py-0.5 text-xs font-medium"
              >
                {filteredAndSortedDocs.length} shown
              </motion.span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: 0.1,
        }}
        className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="relative flex-1 sm:max-w-md">
          <Search className="text-muted-foreground/60 focus-within:text-primary/60 absolute top-1/2 left-4 size-5 -translate-y-1/2 transition-colors duration-300" />
          <Input
            type="search"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border/50 bg-card/50 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-card focus:shadow-primary/5 h-12 rounded-xl pl-11 text-base backdrop-blur-sm transition-all duration-300 focus:shadow-lg"
          />
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as FilterType)}
          >
            <SelectTrigger className="border-border/50 bg-card/50 hover:bg-card h-12 w-[140px] rounded-xl backdrop-blur-sm transition-all duration-300 hover:shadow-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="favorites">Favorites</SelectItem>
              <SelectItem value="owned">Owned</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
            <SelectTrigger className="border-border/50 bg-card/50 hover:bg-card h-12 w-[180px] rounded-xl backdrop-blur-sm transition-all duration-300 hover:shadow-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated-desc">Recently updated</SelectItem>
              <SelectItem value="updated-asc">Oldest first</SelectItem>
              <SelectItem value="title-asc">Title A-Z</SelectItem>
              <SelectItem value="title-desc">Title Z-A</SelectItem>
            </SelectContent>
          </Select>

          <div className="border-border/50 bg-card/50 flex rounded-xl border p-1.5 backdrop-blur-sm">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className="rounded-lg transition-all duration-300"
            >
              <Grid3x3 className="size-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className="rounded-lg transition-all duration-300"
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {filteredAndSortedDocs.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Empty className="border-border/50 bg-card/30 border-dashed py-16 backdrop-blur-sm">
              <EmptyMedia variant="icon">
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="from-primary/10 to-primary/5 rounded-2xl bg-gradient-to-br p-4"
                >
                  <Search className="text-primary/60 size-8" />
                </motion.div>
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-2xl font-semibold tracking-tight">
                  No documents found
                </EmptyTitle>
                <EmptyDescription className="text-muted-foreground/80 mt-3 text-base leading-relaxed">
                  {searchQuery
                    ? `No documents match "${searchQuery}". Try adjusting your search or filters.`
                    : "No documents match your current filters. Try adjusting them."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-3"
            }
          >
            {/* Create Document Card - only show in grid view */}
            {viewMode === "grid" && <CreateDocumentCard index={0} />}
            {filteredAndSortedDocs.map((doc, index) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                index={viewMode === "grid" ? index + 1 : index}
                viewMode={viewMode}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
