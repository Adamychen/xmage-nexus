import { exportDck, exportArena, exportTxt, exportDek } from './parseDck'
import type { DeckV2 } from './types'
import { downloadBlob } from '../utils/download'

export type DeckExportKind = 'dck' | 'arena' | 'txt' | 'dek'

export function deckExportText(deck: DeckV2, kind: DeckExportKind): string {
  return kind === 'dck' ? exportDck(deck) : kind === 'arena' ? exportArena(deck) : kind === 'dek' ? exportDek(deck) : exportTxt(deck)
}

export function deckExportFilename(deck: DeckV2, kind: DeckExportKind): string {
  const name = deck.name.replace(/[^a-z0-9\-_ ]/gi, '_')
  return kind === 'dck'
    ? `${name}.dck`
    : kind === 'arena'
      ? `${name}.txt`
      : kind === 'dek'
        ? `${name}.dek`
        : `${name}-plain.txt`
}

export function downloadDeckExport(deck: DeckV2, kind: DeckExportKind, text = deckExportText(deck, kind)): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), deckExportFilename(deck, kind))
}
