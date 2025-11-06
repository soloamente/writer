import { Suspense } from "react";
import { CreateDocumentButton } from "@/app/editor/_components/CreateDocumentButton";
import { DocumentsList } from "@/app/editor/_components/DocumentsList";

/**
 * Documents list component.
 * Authentication is handled by proxy.ts, so we can assume the user is authenticated here.
 */
async function AuthenticatedDocumentsList() {
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
