import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-brand-yellow rounded-3xl flex items-center justify-center mb-8 shadow-sm">
        <span className="text-4xl">?</span>
      </div>
      <h1 className="text-[40px] font-bold text-brand-dark tracking-tight leading-none mb-4">
        Page not found
      </h1>
      <p className="text-[17px] text-brand-dark/60 max-w-sm mb-8 font-medium">
        We can&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
      </p>
      <Link href="/dashboard">
        <Button variant="primary" size="lg" className="h-14 px-8 text-[16px]">
          Back to dashboard
        </Button>
      </Link>
    </div>
  );
}
