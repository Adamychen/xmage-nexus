import { exportDck, exportArena, exportTxt, exportDek } from './parseDck'
import type { DeckV2 } from './types'

export type DeckExportKind = 'dck' | 'arena' | 'txt' | 'dek'

/**
 * Exporta el mazo a fichero (y al portapapeles si está disponible), con
 * feedback visual en el botón que lanzó la acción.
 */
export async function downloadDeckFile(deck: DeckV2, kind: DeckExportKind, copiedText: string): Promise<void> {
  const text = kind === 'dck' ? exportDck(deck) : kind === 'arena' ? exportArena(deck) : kind === 'dek' ? exportDek(deck) : exportTxt(deck)
  const filename = kind === 'dck'
    ? `${deck.name}.dck`
    : kind === 'arena'
      ? `${deck.name}.txt`
      : kind === 'dek'
        ? `${deck.name}.dek`
        : `${deck.name}-plain.txt`
  let copied = false
  try { await navigator.clipboard.writeText(text); copied = true } catch {}
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  if (copied) {
    const btn = document.activeElement as HTMLElement | null
    if (btn) { const prev = btn.textContent; btn.textContent = copiedText; setTimeout(() => { if (prev) btn.textContent = prev }, 1400) }
  }
}
