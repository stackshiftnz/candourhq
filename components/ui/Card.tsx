import { ReactNode } from "react";

type CardPadding = "sm" | "md" | "lg";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: CardPadding;
}

const paddingClasses: Record<CardPadding, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={[
        "bg-white rounded-xl border border-gray-200",
        "dark:bg-gray-900 dark:border-gray-800",
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ borderWidth: "0.5px" }}
    >
      {children}
    </div>
  );
}
