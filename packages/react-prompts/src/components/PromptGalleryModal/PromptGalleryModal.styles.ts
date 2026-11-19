import { makeStyles, tokens } from '@fluentui/react-components';

export const useGalleryStyles = makeStyles({
  surface: {
    width: 'min(960px, calc(100vw - 32px))',
    maxWidth: '960px',
    height: 'min(80vh, 800px)',
    maxHeight: 'calc(100dvh - 32px)',
  },
  body: {
    height: '100%',
    minHeight: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    gap: tokens.spacingVerticalM,
  },
  preview: {
    minHeight: '64px',
    maxHeight: '120px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    flexShrink: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
    alignContent: 'start',
    gap: tokens.spacingHorizontalM,
    overflowY: 'auto',
    minHeight: 0,
    padding: tokens.spacingHorizontalXS,
    '@media (max-width: 480px)': {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    height: '140px',
    padding: 0,
    overflow: 'visible',
  },
  cardButton: {
    width: '100%',
    height: '100%',
    padding: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    textAlign: 'left',
    overflow: 'hidden',
  },
  cardText: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    width: 'min(320px, calc(100vw - 64px))',
    maxHeight: 'min(400px, 50dvh)',
    overflowY: 'auto',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
});
