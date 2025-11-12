import { Suspense } from "react";
import { Room } from "@/app/editor/Room";
import { Editor } from "@/app/editor/_components/editor";
import { CommandPalette } from "@/app/editor/_components/CommandPalette";
import { DocumentLoadingLoader } from "@/app/editor/_components/DocumentLoader";

async function EditorContent({ documentId }: { documentId: string }) {
  const { auth } = await import("@/lib/auth");
  const { db } = await import("@/db");
  const { document: documentTable, documentMember } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { headers } = await import("next/headers");
  const { redirect } = await import("next/navigation");

  // Authentication is handled by proxy.ts, so we can assume the user is authenticated here
  const session = await auth.api.getSession({ headers: await headers() });

  // TypeScript: session.user is guaranteed to exist after proxy auth check

  const userId = session!.user.id;

  // Check if user owns the document or has access via membership
  const [doc, membership] = await Promise.all([
    db
      .select({
        id: documentTable.id,
        content: documentTable.content,
        title: documentTable.title,
      })
      .from(documentTable)
      .where(and(eq(documentTable.id, documentId), eq(documentTable.userId, userId)))
      .limit(1),
    db
      .select({
        id: documentMember.id,
        role: documentMember.role,
        docId: documentTable.id,
        docContent: documentTable.content,
        docTitle: documentTable.title,
      })
      .from(documentMember)
      .innerJoin(documentTable, eq(documentMember.documentId, documentTable.id))
      .where(
        and(
          eq(documentMember.documentId, documentId),
          eq(documentMember.userId, userId)
        )
      )
      .limit(1),
    ]);

  if (!doc[0] && !membership[0]) redirect("/editor");

  const document = doc[0]
    ? {
        id: doc[0].id,
        content: doc[0].content,
        title: doc[0].title,
      }
    : {
        id: membership[0]!.docId,
        content: membership[0]!.docContent,
        title: membership[0]!.docTitle,
      };
  // Pass stringified initial content; Lexical accepts a serialized editor state string
  const initialContent = JSON.stringify(document.content ?? {});
  const initialTitle = document.title ?? "Untitled";

  // Check if user is owner (owners always have write access)
  const isOwner = !!doc[0];
  // Determine user's permission level
  const canWrite = isOwner || membership[0]?.role === "write";

  return (
    <Room roomId={`writer-doc-${document.id}`}>
      <Editor
        documentId={document.id}
        initialContent={initialContent}
        canWrite={canWrite}
      />
      <CommandPalette
        documentId={document.id}
        documentTitle={initialTitle}
        isOwner={isOwner}
        canWrite={canWrite}
      />
    </Room>
  );
}

async function DocumentIdLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { redirect } = await import("next/navigation");
  const { id } = await params;
  if (!id) redirect("/editor");

  return <EditorContent documentId={id} />;
}

export default function EditorByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<DocumentLoadingLoader />}>
      <DocumentIdLoader params={params} />
    </Suspense>
  );
}
