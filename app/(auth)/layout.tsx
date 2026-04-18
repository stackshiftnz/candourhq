import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* Wordmark */}
      <div className="mb-8 text-center">
        <Link href="/">
          <Image 
            src="/logo.png" 
            alt="Candour HQ" 
            width={120} 
            height={120} 
            className="h-auto w-24 mx-auto mb-2 dark:invert-0" // Keep original colors if possible
            priority
          />
        </Link>
        <p className="text-[12px] text-gray-400 dark:text-gray-500">
          candourhq.com
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-[420px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-7">
        {children}
      </div>
    </div>
  );
}
