import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { MobileHeader } from "@/components/layout/MobileHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <MobileHeader />

      {/* Main content */}
      <main className="lg:ml-[240px] h-screen flex flex-col pt-14 lg:pt-0 pb-16 lg:pb-0">
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
