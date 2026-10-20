import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ActionState, FieldErrors } from "@/lib/create-safe-action";
import { invalidateAfterWrite } from "@/lib/invalidate-after-write";

type Action<TInput, TOutput> = (data: TInput) => Promise<ActionState<TInput, TOutput>>;

interface UseActionOptions<TOutput> {
  onSuccess?: (data: TOutput) => void;
  onError?: (error: string, errorCode?: string) => void;
  onComplete?: () => void;
};

export const useAction = <TInput, TOutput> (
  action: Action<TInput, TOutput>,
  options: UseActionOptions<TOutput> = {}
) => {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<TInput> | undefined>(
    undefined
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [data, setData] = useState<TOutput | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const execute = useCallback(
    async (input: TInput) => {
      setIsLoading(true);

      try {
        const result = await action(input);

        if (!result) {
          return;
        }

        setFieldErrors(result.fieldErrors);

        if (result.error) {
          setError(result.error);
          options.onError?.(result.error, result.errorCode);
        }

        if (result.data) {
          setData(result.data);
          options.onSuccess?.(result.data);
          // shortcut: refetches active data queries except unrelated/lazy roots; scope per action when a caller needs finer control.
          invalidateAfterWrite(queryClient);
        }
      } finally {
        setIsLoading(false);
        options.onComplete?.();
      }
    },
    [action, options, queryClient]
  );

  return {
    execute,
    fieldErrors,
    error,
    data,
    isLoading,
  };
};
