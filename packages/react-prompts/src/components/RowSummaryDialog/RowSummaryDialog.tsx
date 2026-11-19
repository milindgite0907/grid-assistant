import * as React from 'react';
import {
  ArrowClockwiseRegular, CopyRegular, ThumbDislikeRegular, ThumbLikeRegular,
} from '@fluentui/react-icons';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner,
} from '@fluentui/react-components';
import type { JSXElement } from '@fluentui/react-components';
import { rowSummaryToMarkdown } from '../../rowSummary';
import type { RowSummary, RowSummaryDialogProps, RowSummaryFeedback } from '../../types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; summary: RowSummary }
  | { status: 'error'; message: string };

export function RowSummaryDialog(props: RowSummaryDialogProps): JSXElement {
  const { open, title, onDismiss, onFeedback } = props;
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const [feedback, setFeedback] = React.useState<RowSummaryFeedback>();
  const [copyStatus, setCopyStatus] = React.useState('');
  const loadRef = React.useRef(props.loadSummary);
  loadRef.current = props.loadSummary;

  React.useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading' });
    setFeedback(undefined);
    setCopyStatus('');
    loadRef.current(controller.signal).then((summary) => {
      if (!controller.signal.aborted) setState({ status: 'ready', summary });
    }, (error: unknown) => {
      if (controller.signal.aborted) return;
      setState({ status: 'error', message: error instanceof Error ? error.message : 'The summary could not be generated.' });
    });
    return () => controller.abort();
  }, [open, attempt]);

  const summary = state.status === 'ready' ? state.summary : undefined;
  const copy = async (): Promise<void> => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(rowSummaryToMarkdown(summary));
      setCopyStatus('Summary copied as Markdown.');
    } catch {
      setCopyStatus('Copy is unavailable in this browser context.');
    }
  };
  const rate = (value: RowSummaryFeedback): void => {
    if (!summary || feedback) return;
    setFeedback(value);
    onFeedback?.(value, summary);
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) onDismiss(); }}>
      <DialogSurface aria-label={`Summary: ${title}`}>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <div aria-live="polite" aria-busy={state.status === 'loading'}>
              {state.status === 'loading' && <Spinner size="small" label="Generating summary" />}
              {state.status === 'error' && <p role="alert">{state.message}</p>}
              {summary && (
                <div data-testid="row-summary">
                  <p>{summary.summary}</p>
                  {!!summary.highlights?.length && (
                    <ul>{summary.highlights.map((item, index) => <li key={index}>{item}</li>)}</ul>
                  )}
                  {summary.warning && <p role="note">{summary.warning}</p>}
                  <small>AI-generated{summary.model ? ` by ${summary.model}` : ''}. Verify important details.</small>
                </div>
              )}
            </div>
            <span role="status">{copyStatus}</span>
          </DialogContent>
          <DialogActions>
            <Button appearance="subtle" icon={<CopyRegular />} disabled={!summary} onClick={() => void copy()}>Copy</Button>
            <Button appearance="subtle" icon={<ArrowClockwiseRegular />} disabled={state.status === 'loading'}
              onClick={() => setAttempt((value) => value + 1)}>Refresh</Button>
            <Button appearance="subtle" icon={<ThumbLikeRegular />} aria-label="Good summary" aria-pressed={feedback === 'positive'}
              disabled={!summary || !!feedback} onClick={() => rate('positive')} />
            <Button appearance="subtle" icon={<ThumbDislikeRegular />} aria-label="Poor summary" aria-pressed={feedback === 'negative'}
              disabled={!summary || !!feedback} onClick={() => rate('negative')} />
            <Button appearance="primary" onClick={onDismiss}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
