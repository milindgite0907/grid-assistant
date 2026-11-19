import * as React from 'react';
import { ChatRegular, SearchRegular } from '@fluentui/react-icons';
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  mergeClasses,
  useFluent,
  useId,
} from '@fluentui/react-components';
import type { JSXElement } from '@fluentui/react-components';
import {
  formatPromptPreview,
  getParameterValues,
  hasRequiredParameters,
  searchPrompts,
  validatePrompts,
} from '../../promptUtils';
import type {
  PromptContext,
  PromptDefinition,
  PromptGalleryModalProps,
} from '../../types';
import { usePromptSubmission } from '../../usePromptSubmission';
import { useGalleryStyles } from './PromptGalleryModal.styles';

type GalleryProps = PromptGalleryModalProps & {
  initialPrompt?: PromptDefinition;
};

/**
 * Searchable prompt library. Prompts are supplied by the caller; this component
 * does not fetch data or connect to an assistant.
 */
export function PromptGalleryModal(props: GalleryProps): JSXElement | null {
  return props.open ? <GallerySession {...props} /> : null;
}

function GallerySession(props: GalleryProps): JSXElement {
  const { prompts, onDismiss, getContext, initialPrompt } = props;
  validatePrompts(prompts);
  const styles = useGalleryStyles();
  const { targetDocument } = useFluent();
  const targetWindow = targetDocument?.defaultView;
  const timer = React.useRef<number | undefined>(undefined);
  const initialOpened = React.useRef(false);
  const previewId = useId('prompt-preview');
  const formId = useId('prompt-parameters');
  const [search, setSearch] = React.useState('');
  // Keep popovers inside the dialog's focus boundary, outside the scrolling body.
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = React.useState<PromptDefinition>();
  const [selection, setSelection] = React.useState<{
    prompt: PromptDefinition;
    context?: PromptContext;
  }>();
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [contextError, setContextError] = React.useState<string>();
  const { busy, error, errorId, clearError, submit } =
    usePromptSubmission(props);

  const clearTimer = React.useCallback(() => {
    if (timer.current !== undefined) {
      targetWindow?.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, [targetWindow]);
  React.useEffect(() => clearTimer, [clearTimer]);

  const activate = (prompt: PromptDefinition): void => {
    if (busy) {
      return;
    }
    clearTimer();
    clearError();
    setContextError(undefined);
    if (!prompt.parameters?.length) {
      void submit(prompt).then((success) => {
        if (success) {
          onDismiss();
        }
      });
      return;
    }
    try {
      const context = getContext?.();
      setSelection({ prompt, context });
      setEdits({});
      setPreview(prompt);
    } catch (reason) {
      setSelection(undefined);
      setContextError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Unable to read prompt context.'
      );
    }
  };

  React.useEffect(() => {
    if (initialPrompt && !initialOpened.current) {
      initialOpened.current = true;
      activate(initialPrompt);
    }
  });

  const schedulePreview = (prompt: PromptDefinition): void => {
    clearTimer();
    if (!busy) {
      timer.current = targetWindow?.setTimeout(() => {
        timer.current = undefined;
        setPreview(prompt);
      }, 300);
    }
  };

  const displayedPrompt = preview ?? selection?.prompt;
  const values = selection
    ? getParameterValues(selection.prompt, selection.context, edits)
    : {};
  const displayedValues =
    displayedPrompt?.id === selection?.prompt.id ? values : {};
  const message = contextError ?? error;
  const visiblePrompts = searchPrompts(prompts, search);

  return (
    <Dialog
      open
      onOpenChange={(_, data) => {
        if (!data.open && !busy) {
          onDismiss();
        }
      }}
    >
      <DialogSurface
        ref={setSurface}
        className={styles.surface}
        aria-busy={busy}
      >
        <DialogBody className={styles.body}>
          <DialogTitle>Prompt Gallery</DialogTitle>
          <DialogContent className={styles.content}>
            <Field label="Search prompts">
              <Input
                contentBefore={<SearchRegular />}
                value={search}
                disabled={busy}
                onChange={(_, data) => {
                  clearTimer();
                  setSearch(data.value);
                  setPreview(undefined);
                  setSelection(undefined);
                  setEdits({});
                  clearError();
                  setContextError(undefined);
                }}
              />
            </Field>
            <div
              id={previewId}
              className={styles.preview}
              role="status"
              aria-label="Prompt preview"
            >
              {displayedPrompt
                ? formatPromptPreview(displayedPrompt, displayedValues)
                : 'Select/Hover a prompt to preview'}
            </div>
            {message && (
              <div id={errorId} role="alert" className={styles.error}>
                {message}
              </div>
            )}
            <div className={styles.grid} aria-label="Available prompts">
              {visiblePrompts.length === 0 && (
                <Text>No prompts found matching your search.</Text>
              )}
              {visiblePrompts.map((prompt) => {
                const parameterized = !!prompt.parameters?.length;
                const selected = selection?.prompt.id === prompt.id;
                const requiredCount = (prompt.parameters ?? []).filter(
                  (parameter) => parameter.required
                ).length;
                const trigger = (
                  <Button
                    appearance="transparent"
                    className={styles.cardButton}
                    disabled={busy}
                    aria-label={prompt.displayPrompt}
                    aria-describedby={selected && message ? errorId : undefined}
                    onFocus={() => {
                      clearTimer();
                      setPreview(prompt);
                    }}
                    onBlur={() => {
                      clearTimer();
                      setPreview(undefined);
                    }}
                    onClick={() => activate(prompt)}
                  >
                    <ChatRegular aria-hidden />
                    <Text className={styles.cardText}>
                      {prompt.displayPrompt}
                    </Text>
                    <Text size={200}>
                      {parameterized
                        ? `${prompt.parameters?.length} parameter(s), ${requiredCount} required`
                        : 'Ready to use'}
                    </Text>
                  </Button>
                );
                return (
                  <Card
                    key={prompt.id}
                    className={mergeClasses(
                      styles.card,
                      busy && styles.disabled
                    )}
                    onMouseEnter={() => schedulePreview(prompt)}
                    onMouseLeave={() => {
                      clearTimer();
                      setPreview(undefined);
                    }}
                  >
                    {parameterized ? (
                      <Popover
                        open={parameterized && selected}
                        mountNode={surface}
                        positioning="below-start"
                        onOpenChange={(_, data) => {
                          if (!data.open && !busy) {
                            setSelection(undefined);
                            setEdits({});
                          }
                        }}
                      >
                        <PopoverTrigger disableButtonEnhancement>
                          {trigger}
                        </PopoverTrigger>
                        <PopoverSurface aria-label="Prompt parameters">
                          {selected && (
                            <form
                              className={styles.form}
                              aria-labelledby={formId}
                              aria-busy={busy}
                              onSubmit={(event) => {
                                event.preventDefault();
                                if (
                                  !busy &&
                                  hasRequiredParameters(prompt, values)
                                ) {
                                  void submit(prompt, edits).then((success) => {
                                    if (success) {
                                      onDismiss();
                                    }
                                  });
                                }
                              }}
                            >
                              <Text id={formId} weight="semibold">
                                {prompt.shortPrompt || prompt.displayPrompt}
                              </Text>
                              {prompt.parameters?.map((parameter) => (
                                <Field
                                  key={parameter.name}
                                  label={parameter.label}
                                  required={parameter.required}
                                >
                                  <Input
                                    value={values[parameter.name] ?? ''}
                                    placeholder={parameter.placeholder}
                                    disabled={busy}
                                    onChange={(_, data) =>
                                      setEdits((previous) => ({
                                        ...previous,
                                        [parameter.name]: data.value,
                                      }))
                                    }
                                  />
                                </Field>
                              ))}
                              {message && (
                                <Text className={styles.error}>{message}</Text>
                              )}
                              <Button
                                appearance="primary"
                                type="submit"
                                disabled={
                                  busy || !hasRequiredParameters(prompt, values)
                                }
                              >
                                Send Prompt
                              </Button>
                            </form>
                          )}
                        </PopoverSurface>
                      </Popover>
                    ) : (
                      trigger
                    )}
                  </Card>
                );
              })}
            </div>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onDismiss}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

PromptGalleryModal.displayName = 'PromptGalleryModal';
