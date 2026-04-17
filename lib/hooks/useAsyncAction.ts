import { useState, useCallback, useRef } from "react";

interface AsyncActionOptions {
  timeoutMs?: number;
  onTimeout?: () => void;
  onError?: (error: unknown) => void;
}

export function useAsyncAction<TArgs extends unknown[], TReturn>(
  action: (...args: TArgs) => Promise<TReturn>,
  options: AsyncActionOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { timeoutMs = 30000, onTimeout, onError } = options;

  const execute = useCallback(
    async (...args: TArgs) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        setLoading(false);
        if (onTimeout) {
          onTimeout();
        }
      }, timeoutMs);

      try {
        const result = await action(...args);
        return result;
      } catch (err) {
        setError(err);
        if (onError) {
          onError(err);
        }
        throw err;
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setLoading(false);
      }
    },
    [action, loading, timeoutMs, onTimeout, onError]
  );

  return { execute, loading, error };
}
