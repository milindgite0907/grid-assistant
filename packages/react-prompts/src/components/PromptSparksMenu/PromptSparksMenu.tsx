import * as React from 'react';
import { SparkleRegular } from '@fluentui/react-icons';
import {
  Button,
  Menu,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import type { JSXElement } from '@fluentui/react-components';
import { groupSparksPrompts, validatePrompts } from '../../promptUtils';
import type { PromptDefinition, PromptSparksMenuProps } from '../../types';
import { usePromptSubmission } from '../../usePromptSubmission';
import { PromptGalleryModal } from '../PromptGalleryModal/PromptGalleryModal';

export function PromptSparksMenu(
  props: PromptSparksMenuProps
): JSXElement | null {
  const { prompts, label = 'Prompts', getContext, onSubmit } = props;
  validatePrompts(prompts);
  const { busy, error, errorId, clearError, submit } =
    usePromptSubmission(props);
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (busy) {
      setMenuOpen(false);
    }
  }, [busy]);
  const [gallery, setGallery] = React.useState<{
    initialPrompt?: PromptDefinition;
  }>();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wasGalleryOpen = React.useRef(false);
  React.useEffect(() => {
    if (wasGalleryOpen.current && !gallery) {
      triggerRef.current?.focus();
    }
    wasGalleryOpen.current = !!gallery;
  }, [gallery]);
  const groups = Array.from(groupSparksPrompts(prompts));
  const galleryPrompts = prompts.filter((prompt) => !prompt.showInSparks);

  if (!prompts.length) {
    return null;
  }

  return (
    <>
      <Menu
        open={menuOpen && !busy && !gallery}
        onOpenChange={(_, data) => {
          setMenuOpen(data.open);
          if (data.open) {
            clearError();
          }
        }}
      >
        <MenuTrigger disableButtonEnhancement>
          <Button
            ref={triggerRef}
            icon={<SparkleRegular />}
            disabled={busy || !!gallery}
            aria-busy={busy}
            aria-describedby={error ? errorId : undefined}
          >
            {label}
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {groups.map(([group, entries], index) => (
              <React.Fragment key={group}>
                {index > 0 && <MenuDivider />}
                <MenuGroup>
                  <MenuGroupHeader>{group}</MenuGroupHeader>
                  {entries.map((prompt) => (
                    <MenuItem
                      key={prompt.id}
                      disabled={busy}
                      onClick={() => {
                        setMenuOpen(false);
                        clearError();
                        if (prompt.parameters?.length) {
                          setGallery({ initialPrompt: prompt });
                        } else {
                          void submit(prompt);
                        }
                      }}
                    >
                      {prompt.shortPrompt || prompt.displayPrompt}
                    </MenuItem>
                  ))}
                </MenuGroup>
              </React.Fragment>
            ))}
            {galleryPrompts.length > 0 && (
              <>
                {groups.length > 0 && <MenuDivider />}
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    setGallery({});
                  }}
                >
                  Prompt Gallery...
                </MenuItem>
              </>
            )}
          </MenuList>
        </MenuPopover>
      </Menu>
      {error && (
        <div id={errorId} role="alert">
          {error}
        </div>
      )}
      <PromptGalleryModal
        open={!!gallery}
        prompts={
          gallery?.initialPrompt ? [gallery.initialPrompt] : galleryPrompts
        }
        initialPrompt={gallery?.initialPrompt}
        disabled={busy}
        getContext={getContext}
        onSubmit={onSubmit}
        onDismiss={() => {
          setGallery(undefined);
        }}
      />
    </>
  );
}

PromptSparksMenu.displayName = 'PromptSparksMenu';
