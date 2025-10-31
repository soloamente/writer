import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CreateDocumentButton } from "@/app/editor/_components/CreateDocumentButton";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

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

export default async function EditorIndexPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  // Use tRPC to get all documents (includes shared documents)
  const ctx = await createTRPCContext({ headers: await headers() });
  const caller = createCaller(() => ctx);
  const docs = await caller.document.getAll();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your documents</h1>
        <CreateDocumentButton />
      </div>

      {docs.length === 0 ? (
        <div className="border-base-300 rounded-lg border p-8 text-center">
          <p className="mb-4">You have no documents yet.</p>
          <CreateDocumentButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc: any) => {
            const preview = extractPlainText(doc.content) || "Empty";
            const isOwner = doc.isOwner ?? true;
            const ownerInfo = doc.user
              ? `${doc.user.name || doc.user.email}`
              : "Unknown";
            return (
              <Link
                key={doc.id}
                href={`/editor/${doc.id}`}
                aria-label={`Open document ${doc.title || "Untitled"}`}
                className="card border-base-300 cursor-pointer border transition hover:shadow-md"
              >
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <h2 className="card-title line-clamp-1 flex-1">
                      {doc.title || "Untitled"}
                    </h2>
                    {!isOwner && (
                      <span className="badge badge-sm badge-info">Shared</span>
                    )}
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
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
