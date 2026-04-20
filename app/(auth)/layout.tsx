import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration for a premium feel */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Logo Section */}
        <div className="mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <Link href="/" className="inline-block transition-transform hover:scale-105 active:scale-95">
            <Image 
              src="/logo-icon.png" 
              alt="Candour HQ" 
              width={48} 
              height={48} 
              className="h-12 w-12 mx-auto mb-4"
              priority
            />
          </Link>
          <div className="h-px w-8 bg-border mx-auto mb-4" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
            Candour HQ
          </p>
        </div>

        {/* Card Section */}
        <div className="w-full max-w-[400px] border border-border bg-card/50 backdrop-blur-xl shadow-2xl rounded-3xl p-8 md:p-10 transition-all">
          {children}
        </div>

        {/* Footer info */}
        <p className="mt-8 text-[11px] font-medium text-muted-foreground uppercase tracking-widest animate-in fade-in duration-1000 delay-500">
          Enterprise Content Integrity
        </p>
      </div>
    </div>
  );
}
