type SpinnerSize = "sm" | "md" | "lg";

const sizeMap: Record<SpinnerSize, string> = {
  sm: "w-[14px] h-[14px] border-[2px]",
  md: "w-5 h-5 border-2",
  lg: "w-7 h-7 border-[3px]",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        "inline-block rounded-full border-current border-r-transparent animate-spin",
        sizeMap[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
