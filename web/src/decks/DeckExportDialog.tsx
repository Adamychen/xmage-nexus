import { useEffect, useMemo, useRef, useState } from 'react'
import DialogShell from '../ui/DialogShell'
import Button from '../ui/Button'
import { useTranslation } from '../i18n'
import type { DeckV2 } from './types'
import { deckExportText, downloadDeckExport, type DeckExportKind } from './exportDeckFile'
import './DeckExportDialog.css'

const KIND_LABELS: Record<DeckExportKind, string> = { dck: '.dck', arena: 'Arena', txt: 'Plain', dek: '.dek' }

export function DeckExportDialog({ deck, kind, onClose }: { deck: DeckV2; kind: DeckExportKind; onClose: () => void }) {
  const { t } = useTranslation()
  const text = useMemo(() => deckExportText(deck, kind), [deck, kind])
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(id)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      textRef.current?.focus()
      textRef.current?.select()
    }
  }

  return (
    <DialogShell
      labelledBy="deck-export-title"
      titleId="deck-export-title"
      testId="deck-export-dialog"
      kickerIcon="download"
      kickerLabel={deck.name}
      title={`${t('decks', 'export_deck')} · ${KIND_LABELS[kind]}`}
      onClose={onClose}
      onBackdropClick={onClose}
      actions={(
        <>
          <Button variant="secondary" icon="download" onClick={() => downloadDeckExport(deck, kind, text)} data-testid="deck-export-download">
            {t('common', 'download')}
          </Button>
          <Button variant="primary" icon="clipboard" onClick={() => { void copy() }} data-testid="deck-export-copy">
            {copied ? `✓ ${t('common', 'copied')}` : t('common', 'copy')}
          </Button>
        </>
      )}
    >
      <textarea
        ref={textRef}
        className="deck-export-text"
        aria-label={`${t('decks', 'export_deck')} · ${KIND_LABELS[kind]}`}
        value={text}
        readOnly
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        data-testid="deck-export-text"
      />
    </DialogShell>
  )
}
