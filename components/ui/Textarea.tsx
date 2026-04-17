import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-[12px] font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={[
          "min-h-[120px] w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900",
          "placeholder:text-gray-400 transition-colors resize-none",
          "focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500",
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ borderWidth: "0.5px" }}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {!error && hint && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}
