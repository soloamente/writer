import { Suspense } from "react";
import { DocumentsList } from "@/app/editor/_components/DocumentsList";
import { CreateDocumentButton } from "@/app/editor/_components/CreateDocumentButton";
import { Skeleton } from "@/components/ui/skeleton";

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
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="h-5 w-40 rounded-md" />
        </div>
        <CreateDocumentButton />
      </div>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-12 w-full rounded-xl sm:max-w-md" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-[140px] rounded-xl" />
          <Skeleton className="h-12 w-[180px] rounded-xl" />
          <Skeleton className="h-12 w-20 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm"
          >
            <div className="mb-6 flex items-start justify-between">
              <Skeleton className="h-6 w-40 rounded-md" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="mb-3 h-4 w-full rounded-md" />
            <Skeleton className="mb-3 h-4 w-4/5 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
        ))}
      </div>
    </main>
  );
}
