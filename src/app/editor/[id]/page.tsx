import { Room } from "@/app/editor/Room";
import { Editor } from "@/app/editor/_components/editor";
import { CommandPalette } from "@/app/editor/_components/CommandPalette";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function EditorByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const { id } = await params;
  if (!id) redirect("/editor");

  // Check if user owns the document or has access via membership
  const [doc, membership] = await Promise.all([
    prisma.document.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, content: true, title: true },
    }),
    prisma.documentMember.findFirst({
      where: {
        documentId: id,
        userId: session.user.id,
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


