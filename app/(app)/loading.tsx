import { Skeleton } from "@/app/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="mb-8 h-4 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72 rounded-2xl" />
    </div>
  );
}
