"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { FaStar } from "react-icons/fa6";
import { CreateDocumentButton } from "./CreateDocumentButton";

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

export function DocumentsList() {
  const { data: docs, isLoading } = api.document.getAll.useQuery();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your documents</h1>
          <CreateDocumentButton />
        </div>
        <div className="text-center py-8">
          <p>Loading documents...</p>
        </div>
      </main>
    );
  }

  if (!docs || docs.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your documents</h1>
          <CreateDocumentButton />
        </div>
        <div className="border-base-300 rounded-lg border p-8 text-center">
          <p className="mb-4">You have no documents yet.</p>
          <CreateDocumentButton />
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your documents</h1>
          <CreateDocumentButton />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc: any) => {
            const preview = extractPlainText(doc.content) || "Empty";
            const isOwner = doc.isOwner ?? true;
            const isFavorite = doc.isFavorite ?? false;
            const ownerInfo = doc.user
              ? `${doc.user.name || doc.user.email}`
              : "Unknown";
            return (
              <div
                key={doc.id}
                className="card border-base-300 group relative border transition hover:shadow-md"
              >
                <Link
                  href={`/editor/${doc.id}`}
                  aria-label={`Open document ${doc.title || "Untitled"}`}
                  className="card-body"
                >
                  <div className="flex items-start justify-between">
                    <h2 className="card-title line-clamp-1 flex-1">
                      {doc.title || "Untitled"}
                    </h2>
                    <div className="flex items-center gap-2">
                      {isFavorite && (
                        <FaStar
                          size={16}
                          className="text-yellow-500 shrink-0"
                          aria-label="Favorited"
                        />
                      )}
                      {!isOwner && (
                        <span className="badge badge-sm badge-info">Shared</span>
                      )}
                    </div>
                  </div>
                  {!isOwner && (
                    <div className="mb-1 text-xs opacity-70">
                      Owner: {ownerInfo}
                      {doc.role && ` • ${doc.role} access`}
                    </div>
                  )}
                  <p className="line-clamp-3 text-sm">{preview}</p>
                  <div className="mt-2 text-xs opacity-70">
                    Updated{" "}
                    {doc.updatedAt.toLocaleString?.() ??
                      new Date(doc.updatedAt).toLocaleString()}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}

