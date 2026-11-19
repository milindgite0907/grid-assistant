import * as React from 'react';
import { useId } from '@fluentui/react-components';
import { createPromptSubmission } from './promptUtils';
import type { PromptDefinition, PromptSubmissionOptions } from './types';

export function usePromptSubmission(options: PromptSubmissionOptions): {
  busy: boolean;
  error: string | undefined;
  errorId: string;
  clearError: () => void;
  submit: (
    prompt: PromptDefinition,
    edits?: Readonly<Record<string, string>>
  ) => Promise<boolean>;
} {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const errorId = useId('prompt-error');
  const inFlight = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = async (
    prompt: PromptDefinition,
    edits?: Readonly<Record<string, string>>
  ): Promise<boolean> => {
    if (options.disabled || inFlight.current) {
      return false;
    }
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    try {
      const request = createPromptSubmission(
        prompt,
        options.getContext?.(),
        edits
      );
      await options.onSubmit(request);
      return mounted.current;
    } catch (reason) {
      if (mounted.current) {
        setError(
          reason instanceof Error && reason.message
            ? reason.message
            : 'Unable to send prompt.'
        );
      }
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setPending(false);
      }
    }
  };

  return {
    busy: !!options.disabled || pending,
    error,
    errorId,
    clearError: () => setError(undefined),
    submit,
  };
}
