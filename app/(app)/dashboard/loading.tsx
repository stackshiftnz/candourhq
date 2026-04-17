import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* ---- Yellow Header Skeleton ---- */}
      <div className="bg-brand-yellow px-6 lg:px-10 pt-10 pb-12 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-10 lg:h-12 w-64 bg-brand-dark/10" />
          <Skeleton className="h-5 w-48 bg-brand-dark/5" />
        </div>
        <Skeleton className="h-11 w-40 bg-white/50" />
      </div>

      {/* ---- Page body Skeleton ---- */}
      <div className="flex-1 px-4 lg:px-10 py-8 space-y-10 max-w-7xl">
        {/* ---- Metric cards Skeleton ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-50 rounded-[20px] p-5 lg:p-6 shadow-sm space-y-3">
              <Skeleton className="h-4 w-16" />
              <div className="text-[32px] lg:text-[40px] font-bold text-gray-300">--</div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>

        {/* ---- Recent documents Skeleton ---- */}
        <div>
          <div className="flex items-center justify-between px-2 mb-4">
            <h2 className="text-[18px] font-bold text-brand-dark">Recent documents</h2>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
            <ul>
              {[1, 2, 3].map((i) => (
                <li key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
