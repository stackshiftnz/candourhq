export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* Wordmark */}
      <div className="mb-6 text-center">
        <p className="text-[22px] font-semibold text-gray-900 dark:text-white tracking-tight">
          Candour
        </p>
        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
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
