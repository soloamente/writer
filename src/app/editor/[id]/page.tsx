import { Suspense } from "react";
import { Room } from "@/app/editor/Room";
import { Editor } from "@/app/editor/_components/editor";
import { CommandPalette } from "@/app/editor/_components/CommandPalette";

async function EditorContent({
  documentId,
}: {
  documentId: string;
}) {
  const { auth } = await import("@/lib/auth");
  const prisma = (await import("@/lib/prisma")).default;
  const { headers } = await import("next/headers");
  const { redirect } = await import("next/navigation");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  // TypeScript: session.user is guaranteed to exist after the check above
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const userId = session!.user!.id;

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
    <Suspense fallback={<EditorSkeleton />}>
      <DocumentIdLoader params={params} />
    </Suspense>
  );
}

function EditorSkeleton() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 h-8 w-48 animate-pulse rounded bg-base-300" />
          <div className="h-96 w-full animate-pulse rounded bg-base-200" />
        </div>
      </div>
    </div>
  );
}


