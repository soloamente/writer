import { Suspense } from "react";
import { CreateDocumentButton } from "@/app/editor/_components/CreateDocumentButton";
import { DocumentsList } from "@/app/editor/_components/DocumentsList";

async function AuthenticatedDocumentsList() {
  const { auth } = await import("@/lib/auth");
  const { headers } = await import("next/headers");
  const { redirect } = await import("next/navigation");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  return <DocumentsList />;
}

export default function EditorIndexPage() {
  return (
    <>
      <Suspense fallback={<DocumentsListSkeleton />}>
        <AuthenticatedDocumentsList />
      </Suspense>
    </>
  );
}

function DocumentsListSkeleton() {
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
