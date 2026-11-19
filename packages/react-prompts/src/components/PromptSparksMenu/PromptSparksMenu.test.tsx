import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { PromptSparksMenu } from './PromptSparksMenu';
import { PromptGalleryModal } from '../PromptGalleryModal/PromptGalleryModal';
import type { PromptDefinition, PromptSubmission } from '../../types';

// Real focus/visibility is covered by browser tests; jsdom has no layout engine.
jest.mock('@fluentui/react-tabster', () => ({
  ...jest.requireActual<typeof import('@fluentui/react-tabster')>(
    '@fluentui/react-tabster'
  ),
  useModalAttributes: () => ({ modalAttributes: {}, triggerAttributes: {} }),
}));

const prompts: PromptDefinition[] = [
  {
    id: 'quick',
    displayPrompt: 'Count the selected rows',
    shortPrompt: 'Count selection',
    showInSparks: true,
    sparksGroup: 'Selection',
  },
  {
    id: 'other',
    displayPrompt: 'Describe active filters',
    showInSparks: true,
  },
  {
    id: 'summary',
    displayPrompt: 'Summarize {Customer}',
    executePrompt: 'Hidden search keywords',
    parameters: [{ name: 'Customer', label: 'Customer', required: true }],
  },
  { id: 'simple', displayPrompt: 'Describe the grid' },
];

function provider(children: React.ReactNode) {
  return <FluentProvider theme={webLightTheme}>{children}</FluentProvider>;
}

describe('PromptSparksMenu', () => {
  it('renders nothing for an empty prompt list', () => {
    render(provider(<PromptSparksMenu prompts={[]} onSubmit={jest.fn()} />));
    expect(screen.queryByRole('button', { name: 'Prompts' })).toBeNull();
  });

  it('groups Sparks and submits once with the latest structured grid context', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    let selectedRowIds = [1];
    render(
      provider(
        <PromptSparksMenu
          prompts={prompts}
          getContext={() => ({ gridId: 'orders', selectedRowIds })}
          onSubmit={onSubmit}
        />
      )
    );
    await user.click(screen.getByRole('button', { name: 'Prompts' }));
    expect(screen.getByText('Selection')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(
      screen.queryByRole('menuitem', { name: 'Summarize {Customer}' })
    ).toBeNull();
    selectedRowIds = [2, 3];
    await user.click(screen.getByRole('menuitem', { name: 'Count selection' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        promptId: 'quick',
        context: expect.objectContaining({ selectedRowIds: [2, 3] }),
      })
    );
  });

  it('opens only non-Sparks gallery prompts and restores trigger focus on close', async () => {
    const user = userEvent.setup();
    render(
      provider(<PromptSparksMenu prompts={prompts} onSubmit={jest.fn()} />)
    );
    await user.click(screen.getByRole('button', { name: 'Prompts' }));
    await user.click(
      screen.getByRole('menuitem', { name: 'Prompt Gallery...' })
    );
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Count the selected rows' })
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Prompts' })
      );
    });
  });

  it('routes parameterized Sparks to a form instead of sending incomplete input', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      provider(
        <PromptSparksMenu
          prompts={[{ ...prompts[2], showInSparks: true }]}
          onSubmit={onSubmit}
        />
      )
    );
    await user.click(screen.getByRole('button', { name: 'Prompts' }));
    await user.click(
      screen.getByRole('menuitem', { name: 'Summarize {Customer}' })
    );
    expect(await screen.findByLabelText(/^Customer/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the trigger while externally busy', () => {
    render(
      provider(
        <PromptSparksMenu prompts={prompts} disabled onSubmit={jest.fn()} />
      )
    );
    expect(
      screen.getByRole('button', { name: 'Prompts' }).hasAttribute('disabled')
    ).toBe(true);
  });

  it('blocks duplicate async submissions and shows failures with retry available', async () => {
    const user = userEvent.setup();
    let rejectSubmission: (reason: Error) => void = () => {
      throw new Error('Submission was not initialized.');
    };
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectSubmission = reject;
        })
    );
    render(
      provider(<PromptSparksMenu prompts={prompts} onSubmit={onSubmit} />)
    );
    await user.click(screen.getByRole('button', { name: 'Prompts' }));
    await user.click(screen.getByRole('menuitem', { name: 'Count selection' }));
    await user.click(screen.getByRole('button', { name: 'Prompts' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Prompts' }).hasAttribute('disabled')
    ).toBe(true);
    await act(async () => rejectSubmission(new Error('Assistant unavailable')));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Assistant unavailable'
    );
    expect(
      screen.getByRole('button', { name: 'Prompts' }).hasAttribute('disabled')
    ).toBe(false);
  });
});

describe('PromptGalleryModal', () => {
  const galleryPrompts = prompts.filter((prompt) => !prompt.showInSparks);

  it('searches execute text, shows empty results, and resets when reopened', async () => {
    const user = userEvent.setup();
    const props = {
      prompts: galleryPrompts,
      onSubmit: jest.fn(),
      onDismiss: jest.fn(),
    };
    const { rerender } = render(
      provider(<PromptGalleryModal {...props} open />)
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search prompts' }),
      'HIDDEN'
    );
    expect(
      screen.getByRole('button', { name: 'Summarize {Customer}' })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Describe the grid' })
    ).toBeNull();
    await user.type(
      screen.getByRole('textbox', { name: 'Search prompts' }),
      ' missing'
    );
    expect(
      screen.getByText('No prompts found matching your search.')
    ).toBeTruthy();
    rerender(provider(<PromptGalleryModal {...props} open={false} />));
    rerender(provider(<PromptGalleryModal {...props} open />));
    expect(
      screen.getByRole('textbox', { name: 'Search prompts' })
    ).toHaveProperty('value', '');
  });

  it('sends a parameterless prompt immediately and dismisses after success', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const onDismiss = jest.fn();
    render(
      provider(
        <PromptGalleryModal
          open
          prompts={galleryPrompts}
          onSubmit={onSubmit}
          onDismiss={onDismiss}
        />
      )
    );
    await user.click(screen.getByRole('button', { name: 'Describe the grid' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ promptId: 'simple', parameters: {} })
    );
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('validates parameters, updates preview and preserves user overrides', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn<void, [PromptSubmission]>();
    let currentId = 1;
    render(
      provider(
        <PromptGalleryModal
          open
          prompts={galleryPrompts}
          onDismiss={jest.fn()}
          onSubmit={onSubmit}
          getContext={() => ({
            selectedRowIds: [currentId],
            parameterValues: { Customer: 'Context customer' },
          })}
        />
      )
    );
    act(() =>
      screen.getByRole('button', { name: 'Summarize {Customer}' }).focus()
    );
    await user.keyboard('{Enter}');
    const input = await screen.findByLabelText(/^Customer/);
    expect(input).toHaveProperty('value', 'Context customer');
    fireEvent.change(input, { target: { value: ' ' } });
    expect(screen.getByText('Send Prompt').hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: 'User customer' } });
    expect(screen.getByLabelText('Prompt preview').textContent).toBe(
      'Summarize User customer'
    );
    currentId = 2;
    fireEvent.click(screen.getByText('Send Prompt'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Summarize {Customer}',
        parameters: { Customer: 'User customer' },
        context: expect.objectContaining({ selectedRowIds: [2] }),
      })
    );
  });

  it('shows context errors without dismissing', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    render(
      provider(
        <PromptGalleryModal
          open
          prompts={galleryPrompts}
          onDismiss={onDismiss}
          onSubmit={jest.fn()}
          getContext={() => {
            throw new Error('Context unavailable');
          }}
        />
      )
    );
    await user.click(
      screen.getByRole('button', { name: 'Summarize {Customer}' })
    );
    expect(
      (await screen.findByText('Context unavailable')).getAttribute('role')
    ).toBe('alert');
    await user.click(screen.getByRole('button', { name: 'Describe the grid' }));
    expect(
      (await screen.findByText('Context unavailable')).getAttribute('role')
    ).toBe('alert');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('keeps the gallery open after a rejected submission and allows retry', async () => {
    const user = userEvent.setup();
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error('Assistant unavailable'))
      .mockResolvedValue(undefined);
    const onDismiss = jest.fn();
    render(
      provider(
        <PromptGalleryModal
          open
          prompts={galleryPrompts}
          onSubmit={onSubmit}
          onDismiss={onDismiss}
        />
      )
    );
    await user.click(screen.getByRole('button', { name: 'Describe the grid' }));
    expect(await screen.findByText('Assistant unavailable')).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Describe the grid' }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('disables parameter submission when the assistant becomes busy', async () => {
    const user = userEvent.setup();
    const props = {
      open: true,
      prompts: galleryPrompts,
      onDismiss: jest.fn(),
      onSubmit: jest.fn(),
    };
    const { rerender } = render(provider(<PromptGalleryModal {...props} />));
    await user.click(
      screen.getByRole('button', { name: 'Summarize {Customer}' })
    );
    fireEvent.change(await screen.findByLabelText(/^Customer/), {
      target: { value: 'Customer' },
    });
    rerender(provider(<PromptGalleryModal {...props} disabled />));
    expect(screen.getByText('Send Prompt').hasAttribute('disabled')).toBe(true);
    const form = screen.getByText('Send Prompt').closest('form');
    if (!form) {
      throw new Error('Send Prompt must belong to a parameter form.');
    }
    fireEvent.submit(form);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('delays hover preview by 300ms and clears pending timers on leave and unmount', () => {
    jest.useFakeTimers();
    try {
      const { unmount } = render(
        provider(
          <PromptGalleryModal
            open
            prompts={galleryPrompts}
            onDismiss={jest.fn()}
            onSubmit={jest.fn()}
          />
        )
      );
      const card = screen.getByRole('button', {
        name: 'Describe the grid',
      }).parentElement;
      if (!card) {
        throw new Error('Prompt button must be inside a card.');
      }
      fireEvent.mouseEnter(card);
      act(() => jest.advanceTimersByTime(299));
      expect(
        screen.getByRole('status', { name: 'Prompt preview' }).textContent
      ).toBe('Select/Hover a prompt to preview');
      act(() => jest.advanceTimersByTime(1));
      expect(
        screen.getByRole('status', { name: 'Prompt preview' }).textContent
      ).toBe('Describe the grid');
      fireEvent.mouseLeave(card);
      expect(
        screen.getByRole('status', { name: 'Prompt preview' }).textContent
      ).toBe('Select/Hover a prompt to preview');
      fireEvent.mouseEnter(card);
      fireEvent.mouseLeave(card);
      act(() => jest.advanceTimersByTime(300));
      expect(
        screen.getByRole('status', { name: 'Prompt preview' }).textContent
      ).toBe('Select/Hover a prompt to preview');
      fireEvent.mouseEnter(card);
      unmount();
      act(() => jest.advanceTimersByTime(300));
    } finally {
      jest.useRealTimers();
    }
  });
});
