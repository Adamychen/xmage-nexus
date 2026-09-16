import { useEffect, useMemo, useRef, useState } from 'react'
import { DeckBox, DeckBoxCreate } from './DeckBox'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'
import { MAX_DECKS, makeDeckId } from './types'
import { ALL_FORMATS } from './formatRules'
import { parseAnyDeck, exportDck, exportArena, exportTxt, exportDek } from './parseDck'
import { bundledDecks, type DeckCard } from '../lobby/decks'
import Icon from '../ui/Icon'
import { DeckBrowser } from './DeckBrowser'
import { DeckInspectorModal } from './DeckInspectorModal'
import { ImportDeckDialog } from './ImportDeckDialog'
import type { MetaDeckItem } from './metaDeckCatalog'
import { ManaPip } from './ArenaManaSymbols'
import { useTranslation } from '../i18n'
import { alertDialog, confirmDialog } from '../ui/confirmDialog'
import './DecksGallery.css'

function inferDeckColors(cards: DeckCard[]): ('W' | 'U' | 'B' | 'R' | 'G')[] {
  const set = new Set<'W' | 'U' | 'B' | 'R' | 'G'>()
  for (const c of cards) {
    const n = c.cardName.toLowerCase()
    if (n.includes('island') || n.includes('isla')) set.add('U')
    if (n.includes('mountain') || n.includes('montaña')) set.add('R')
    if (n.includes('plains') || n.includes('llanura')) set.add('W')
    if (n.includes('swamp') || n.includes('pantano')) set.add('B')
    if (n.includes('forest') || n.includes('bosque')) set.add('G')
    if (n.includes('bolt') || n.includes('blaze') || n.includes('goblin') || n.includes('trail')) set.add('R')
    if (n.includes('charm')) {
      set.add('R')
      set.add('W')
    }
  }
  return [...set].sort()
}

export function cloneDeckForEdit(d: MetaDeckItem | DeckV2): DeckV2 {
  const now = Date.now()
  return {
    ...d,
    id: makeDeckId(),
    coverCard: d.coverCard ?? d.cards[0],
    createdAt: now,
    updatedAt: now,
    source: 'custom',
  }
}

function preconToV2(): DeckV2[] {
  const now = Date.now()
  return bundledDecks().map((d, i) => ({
    ...d,
    id: `precon-${i}-${d.name}`,
    format: d.cards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' as const : 'Freeform' as const,
    colors: inferDeckColors(d.cards),
    coverCard: d.cards[0],
    createdAt: now - 1000000 - i * 1000,
    updatedAt: now - 1000000 - i * 1000,
    source: 'precon' as const,
  }))
}

function cardsFingerprint(cards: DeckCard[]): string {
  return cards.map((c) => `${c.setCode}/${c.cardNumber}:${c.cardName}x${c.amount}`).join('|')
}

/**
 * Conserva el seleccionado solo si sigue existiendo tras recargar (evita
 * `selected` stale cuando el mazo se borró en otra pestaña/ventana).
 */
export function pruneSelectedId(decks: DeckV2[], selectedId: string | null): string | null {
  if (!selectedId) return null
  return decks.some((d) => d.id === selectedId) ? selectedId : null
}

/**
 * Fusiona los colores enriquecidos por id contra el estado ACTUAL: solo se
 * aplican si el mazo no cambió por debajo (mismas cartas) y sigue sin colores.
 * Así una edición del usuario durante los fetches nunca se pierde.
 */
export function mergeEnrichedColors(current: DeckV2[], enriched: DeckV2[]): DeckV2[] {
  const byId = new Map(enriched.map((d) => [d.id, d]))
  let changed = false
  const merged = current.map((cur) => {
    const fresh = byId.get(cur.id)
    if (!fresh || fresh.colors.length === 0 || cur.colors.length > 0) return cur
    if (cardsFingerprint(cur.cards) !== cardsFingerprint(fresh.cards)) return cur
    changed = true
    return { ...cur, colors: fresh.colors }
  })
  return changed ? merged : current
}

export default function DecksGallery({ onEdit }: { onEdit: (id: string) => void }) {
  const { t } = useTranslation()
  const [mainView, setMainView] = useState<'my-decks' | 'browser'>('my-decks')
  const [decks, setDecks] = useState<DeckV2[]>([])
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set())
  const [formatFilter, setFormatFilter] = useState<string>('All Decks')
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'size'>('updated')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectingDeck, setInspectingDeck] = useState<DeckV2 | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  // Enriquecimiento de colores vía Scryfall en curso (C.13 nit: sin indicador).
  const [enriching, setEnriching] = useState(false)

  const storage = useMemo(() => getDeckStorage(), [])
  const precon = useMemo(() => preconToV2(), [])

  const load = async () => {
    const custom = await storage.list()
    const loaded = [...custom, ...precon]
    setDecks(loaded)
    setSelectedId((prev) => {
      if (pruneSelectedId(loaded, prev)) return prev
      return custom.length > 0 ? custom[0].id : null
    })
  }
  useEffect(() => { void load() }, [])

  const selected = useMemo(() => decks.find((d) => d.id === selectedId) ?? null, [decks, selectedId])

  const toggleColor = (c: string) => {
    const next = new Set(colorFilter)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    setColorFilter(next)
  }

  const filtered = useMemo(() => {
    let out = [...decks]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter((d) => d.name.toLowerCase().includes(q) || d.cards.some((cc) => cc.cardName.toLowerCase().includes(q)))
    }
    if (formatFilter !== 'All Decks') {
      if (formatFilter === 'Favoritos') out = out.filter((d) => d.favorite)
      else out = out.filter((d) => d.format === formatFilter)
    }
    if (colorFilter.size > 0) {
      out = out.filter((d) => d.colors.length === 0 || [...colorFilter].every((c) => d.colors.includes(c as never)))
    }
    if (sortBy === 'name') out.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'size') out.sort((a, b) => b.cards.reduce((s, c) => s + c.amount, 0) - a.cards.reduce((s, c) => s + c.amount, 0))
    else out.sort((a, b) => b.updatedAt - a.updatedAt)
    return out
  }, [decks, search, colorFilter, formatFilter, sortBy])

  const customCount = decks.filter((d) => d.source !== 'precon').length

  const decksRef = useRef(decks)
  decksRef.current = decks

  useEffect(() => {
    if (decks.length === 0) return
    const snapshot = decks
    if (!snapshot.slice(0, 12).some((d) => d.colors.length === 0)) return
    let cancelled = false
    const ctrl = new AbortController()
    setEnriching(true)
    void (async () => {
      try {
        const updated = await Promise.all(snapshot.map(async (d, idx) => {
        if (d.colors.length > 0) return d
        if (idx >= 12) return d
        const uniq = [...new Map(d.cards.slice(0, 6).map((c) => [`${c.setCode}/${c.cardNumber}:${c.cardName}`, c])).values()]
        const set = new Set<string>()
        for (const c of uniq) {
          if (cancelled || ctrl.signal.aborted) break
          try {
            let data: { color_identity?: string[] } | null = null
            if (c.setCode && c.cardNumber && c.cardNumber !== '0') {
              const r = await fetch(`https://api.scryfall.com/cards/${c.setCode}/${c.cardNumber}?format=json`, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
              if (r.ok) data = await r.json() as { color_identity?: string[] }
            }
            if (!data || !data.color_identity?.length) {
              const r2 = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.cardName)}`, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
              if (r2.ok) data = await r2.json() as { color_identity?: string[] }
            }
            if (data?.color_identity) for (const col of data.color_identity) set.add(col)
            await new Promise((rr) => setTimeout(rr, 75))
          } catch {}
        }
        if (set.size === 0) return d
        const sorted = [...set].sort() as DeckV2['colors']
        return { ...d, colors: sorted }
      }))
      if (cancelled) return
      const merged = mergeEnrichedColors(decksRef.current, updated)
      if (merged === decksRef.current) return
      const before = new Map(decksRef.current.map((d) => [d.id, d]))
      for (const m of merged) {
        if (m !== before.get(m.id) && m.source !== 'precon') {
          try { await storage.put(m) } catch {}
        }
      }
      if (!cancelled) setDecks(merged)
      } finally {
        if (!cancelled) setEnriching(false)
      }
    })()
    return () => { cancelled = true; ctrl.abort(); setEnriching(false) }
  }, [decks.length])

  const handleCreate = async () => {
    if (customCount >= MAX_DECKS) return
    const now = Date.now()
    const empty: DeckV2 = {
      id: makeDeckId(),
      name: `${t('decks', 'box_new_deck', { n: customCount + 1 })}`,
      cards: [],
      sideboard: [],
      format: 'Freeform',
      colors: [],
      createdAt: now,
      updatedAt: now,
      source: 'custom',
    }
    await storage.put(empty)
    await load()
    onEdit(empty.id)
  }

  const handleCloneFromBrowser = async (d: MetaDeckItem | DeckV2): Promise<DeckV2> => {
    const v2 = cloneDeckForEdit(d)
    await storage.put(v2)
    await load()
    setSelectedId(v2.id)
    return v2
  }

  // Los precons viven solo en memoria (bundled) y los MetaDeckItem no están en
  // storage: al editar hay que clonarlos primero, o el builder queda en
  // "Cargando..." porque no existen en storage.
  const openForEdit = async (d: DeckV2 | MetaDeckItem) => {
    if ('source' in d && d.source !== 'precon') {
      onEdit(d.id)
      return
    }
    const cloned = await handleCloneFromBrowser(d)
    onEdit(cloned.id)
  }

  const handleImportedDeck = async (deck: DeckV2) => {
    await storage.put(deck)
    await load()
    setSelectedId(deck.id)
    setMainView('my-decks')
  }

  const handleDelete = async () => {
    if (!selected || selected.source === 'precon') return
    if (!(await confirmDialog(`${t('common', 'delete')} "${selected.name}"?`, { danger: true }))) return
    await storage.del(selected.id)
    setSelectedId(null)
    await load()
  }

  const handleClone = async () => {
    if (!selected) return
    const clone: DeckV2 = { ...selected, id: makeDeckId(), name: `${selected.name} ${t('common', 'copy')}`, createdAt: Date.now(), updatedAt: Date.now(), source: 'custom' as const }
    await storage.put(clone)
    await load()
    setSelectedId(clone.id)
  }

  const handleExport = async (fmt: 'dck' | 'arena' | 'plain' | 'dek') => {
    if (!selected) return
    const text = fmt === 'dck' ? exportDck(selected) : fmt === 'arena' ? exportArena(selected) : fmt === 'dek' ? exportDek(selected) : exportTxt(selected)
    try { await navigator.clipboard.writeText(text) } catch {}
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ext = fmt === 'dck' ? 'dck' : fmt === 'arena' ? 'txt' : fmt === 'dek' ? 'dek' : 'plain.txt'
    a.download = `${selected.name.replace(/[^a-z0-9\-_ ]/gi, '_')}.${ext}`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const handleFavorite = async () => {
    if (!selected || selected.source === 'precon') return
    const upd: DeckV2 = { ...selected, favorite: !selected.favorite, updatedAt: Date.now() }
    await storage.put(upd)
    await load()
    setSelectedId(upd.id)
  }

  const handleBackupAll = async () => {
    const customDecks = await storage.list()
    if (customDecks.length === 0) return
    const payload = {
      app: 'xmage-nexus',
      version: 2,
      exportedAt: new Date().toISOString(),
      decks: customDecks,
    }
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `xmage-nexus-decks-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const restoreBackupText = async (text: string): Promise<number> => {
    const json = JSON.parse(text)
    const deckList: DeckV2[] = Array.isArray(json) ? json : (Array.isArray(json.decks) ? json.decks : [])
    let count = 0
    for (const d of deckList) {
      if (d && typeof d === 'object' && d.name && Array.isArray(d.cards)) {
        const v2: DeckV2 = {
          ...d,
          id: d.id || makeDeckId(),
          createdAt: d.createdAt || Date.now(),
          updatedAt: Date.now(),
          source: 'custom',
        }
        await storage.put(v2)
        count += 1
      }
    }
    return count
  }

  const handleRestoreBackup = async (f: File) => {
    try {
      const count = await restoreBackupText(await f.text())
      if (count === 0) {
        await alertDialog(t('errors', 'deck_read_failed'))
        return
      }
      await load()
      await alertDialog(`${t('common', 'done')}: ${count}`)
    } catch {
      await alertDialog(t('errors', 'deck_read_failed'))
    }
  }

  const handleFile = async (f: File) => {
    const text = await f.text()
    const name = f.name.replace(/\.(dck|txt|cod|dec|o8d|dek|mtga|mwdeck|draft|json)$/i, '')
    if (/\.json$/i.test(f.name)) {
      try {
        const count = await restoreBackupText(text)
        if (count > 0) {
          await load()
          return
        }
      } catch {
        // no es backup: probar como mazo mtgjson
      }
    }
    const parsed = parseAnyDeck(text, name || t('decks', 'import_placeholder'))
    if (!parsed) { await alertDialog(`${t('errors', 'deck_read_failed')}: ${f.name}`); return }
    const v2: DeckV2 = { ...parsed, id: makeDeckId(), format: parsed.cards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' : 'Freeform', colors: [], coverCard: parsed.cards[0], createdAt: Date.now(), updatedAt: Date.now(), source: 'imported' }
    await storage.put(v2); await load(); setSelectedId(v2.id)
  }

  return (
    <div className="decks-gallery">
      <header className="decks-gallery-top">
        <div className="decks-gallery-header-row">
          <div className="decks-gallery-header-left">
            <h1 className="decks-title">{t('decks', 'my_decks').toUpperCase()}</h1>

            <div className="gallery-view-tabs">
              <button
                type="button"
                className={`gallery-view-tab ${mainView === 'my-decks' ? 'active' : ''}`}
                onClick={() => setMainView('my-decks')}
              >
                <Icon name="package" size={13} /> {t('decks', 'my_decks')} ({customCount})
              </button>
              <button
                type="button"
                className={`gallery-view-tab ${mainView === 'browser' ? 'active' : ''}`}
                onClick={() => setMainView('browser')}
              >
                <Icon name="globe" size={13} /> {t('decks', 'popular_meta')}
              </button>
            </div>
          </div>

          <div className="decks-gallery-header-right">
            <button type="button" className="decks-import-cta" onClick={() => setShowImportDialog(true)}>
              <Icon name="download" size={14} /> {t('decks', 'import_deck')}
            </button>
            {mainView === 'my-decks' && (
              <div className="decks-counter">{customCount}/{MAX_DECKS}</div>
            )}
            {enriching && mainView === 'my-decks' && (
              <span className="decks-enriching" role="status" aria-live="polite">{t('common', 'loading')}…</span>
            )}
          </div>
        </div>

        {mainView === 'my-decks' && (
          <div className="decks-filters">
            <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className="decks-select">
              <option value="All Decks">{t('decks', 'gallery_all_formats')}</option>
              {ALL_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
              <option value="Favoritos">★ {t('common', 'all')}</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as never)} className="decks-select">
              <option value="updated">{t('decks', 'gallery_recent')}</option>
              <option value="name">{t('common', 'search')} A–Z</option>
              <option value="size">{t('decks', 'total_cards')}</option>
            </select>
            <div className="decks-search-wrap">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common', 'search')} className="decks-search" />
              {search && <button className="decks-search-clear" onClick={() => setSearch('')}>×</button>}
            </div>
            <div className="decks-mana-filter">
              {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`mana-filter-btn ${colorFilter.has(c) ? 'active' : ''}`}
                  onClick={() => toggleColor(c)}
                  title={c}
                >
                  <ManaPip symbol={c} size={18} />
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {mainView === 'my-decks' ? (
        <>
          <div className="decks-grid" onDragOver={(e) => e.preventDefault()} onDrop={async (e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) await handleFile(f)
          }}>
            <DeckBoxCreate onClick={handleCreate} />
            {filtered.map((d) => (
              <DeckBox
                key={d.id}
                deck={d}
                selected={selectedId === d.id}
                onSelect={() => setSelectedId(d.id)}
                onDoubleClick={() => setInspectingDeck(d)}
              />
            ))}
          </div>

          <footer className="decks-footer">
            <div className="decks-footer-left">
              <button type="button" className="decks-footer-btn" onClick={handleBackupAll} disabled={customCount === 0} title={t('decks', 'export_deck')}><Icon name="package" size={12} /> {t('decks', 'export_backup_count', { count: customCount })}</button>
              <label className="decks-footer-btn" title={t('decks', 'import_hint')}>
                <Icon name="download" size={12} /> {t('decks', 'import_backup_json')}
                <input type="file" accept=".json" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) await handleRestoreBackup(f)
                  e.currentTarget.value = ''
                }} />
              </label>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={() => handleExport('dck')}><Icon name="save" size={12} /> {t('decks', 'export_deck')} .dck</button>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={() => handleExport('arena')}><Icon name="clipboard" size={12} /> {t('decks', 'export_deck')} Arena</button>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={() => handleExport('plain')}><Icon name="file" size={12} /> {t('decks', 'export_deck')} Plain</button>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={() => handleExport('dek')}><Icon name="file" size={12} /> {t('decks', 'export_deck')} .dek</button>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={handleClone}><Icon name="copy" size={12} /> {t('common', 'copy')}</button>
              <button type="button" className="decks-footer-btn danger" disabled={!selected || selected?.source === 'precon'} title={selected?.source === 'precon' ? t('decks', 'browser_filter_precon') : undefined} onClick={handleDelete}><Icon name="trash" size={12} /> {t('common', 'delete')}</button>
              <button type="button" className={`decks-footer-btn ${selected?.favorite ? 'fav-active' : ''}`} disabled={!selected || selected?.source === 'precon'} aria-pressed={!!selected?.favorite} onClick={handleFavorite}><span aria-hidden="true">★</span> {t('common', 'all')}</button>
            </div>
            <button type="button" className="decks-edit-btn" disabled={!selected} onClick={() => selected && void openForEdit(selected)}><Icon name="pencil" size={12} /> {t('common', 'edit')}</button>
          </footer>
        </>
      ) : (
        <div style={{ padding: '16px 20px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <DeckBrowser
            onCloneDeck={handleCloneFromBrowser}
            onOpenBuilder={(deckId) => onEdit(deckId)}
          />
        </div>
      )}

      {showImportDialog && (
        <ImportDeckDialog
          onImport={handleImportedDeck}
          onClose={() => setShowImportDialog(false)}
        />
      )}

      {inspectingDeck && (
        <DeckInspectorModal
          deck={inspectingDeck}
          onClose={() => setInspectingDeck(null)}
          onEdit={(deckToEdit) => {
            setInspectingDeck(null)
            void openForEdit(deckToEdit)
          }}
          onCopy={handleClone}
        />
      )}
    </div>
  )
}
