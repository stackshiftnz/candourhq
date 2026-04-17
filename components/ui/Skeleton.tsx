import React from "react";

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = "", lines = 1 }: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 dark:bg-gray-800 animate-pulse rounded"
            style={{
              width: i === lines - 1 ? "60%" : "100%",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-800 animate-pulse rounded ${className}`}
    />
  );
}
