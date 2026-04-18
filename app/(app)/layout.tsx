import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { MobileHeader } from "@/components/layout/MobileHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      {/* Desktop sidebar — hidden on mobile, in-flow so flex-1 main adapts */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      <MobileHeader />

      {/* Main content */}
      <main className="flex-1 min-w-0 h-screen flex flex-col pt-14 lg:pt-0 pb-16 lg:pb-0">
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — hidden on desktop */}
      <div className="lg:hidden">
        <MobileTabBar />
      </div>
    </div>
  );
}
