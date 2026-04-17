import { Skeleton } from "@/components/ui/Skeleton";

export default function HistoryLoading() {
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* ---- Topbar Skeleton ---- */}
      <div className="flex items-center justify-between px-4 lg:px-8 h-14 border-b border-gray-100 flex-shrink-0">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* ---- Filter Bar Skeleton ---- */}
      <div className="flex items-center gap-3 px-8 h-11 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>

      {/* ---- Document List Skeleton ---- */}
      <div className="flex-1 px-4 lg:px-8 py-4 space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
