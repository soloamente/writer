import { Suspense } from "react";
import { Room } from "@/app/editor/Room";
import { Editor } from "@/app/editor/_components/editor";
import { CommandPalette } from "@/app/editor/_components/CommandPalette";
import { DocumentLoadingLoader } from "@/app/editor/_components/DocumentLoader";

async function EditorContent({ documentId }: { documentId: string }) {
  const { auth } = await import("@/lib/auth");
  const prisma = (await import("@/lib/prisma")).default;
  const { headers } = await import("next/headers");
  const { redirect } = await import("next/navigation");

  // Authentication is handled by proxy.ts, so we can assume the user is authenticated here
  const session = await auth.api.getSession({ headers: await headers() });

  // TypeScript: session.user is guaranteed to exist after proxy auth check

  const userId = session!.user.id;

  // Check if user owns the document or has access via membership
  const [doc, membership] = await Promise.all([
    prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { id: true, content: true, title: true },
    }),
    prisma.documentMember.findFirst({
      where: {
        documentId: documentId,
        userId,
      },
      include: {
        document: {
          select: { id: true, content: true, title: true },
        },
      },
    }),
  ]);

  if (!doc && !membership) redirect("/editor");

  const document = doc ?? membership!.document;
  // Pass stringified initial content; Lexical accepts a serialized editor state string
  const initialContent = JSON.stringify(document.content ?? {});
  const initialTitle = document.title ?? "Untitled";

  // Check if user is owner (owners always have write access)
  const isOwner = !!doc;
  // Determine user's permission level
  const canWrite = isOwner || membership?.role === "write";

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
