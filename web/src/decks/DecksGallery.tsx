import { useEffect, useMemo, useState } from 'react'
import { DeckBox, DeckBoxCreate } from './DeckBox'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'
import { MAX_DECKS, makeDeckId } from './types'
import { ALL_FORMATS } from './formatRules'
import { parseAnyDeck, exportDck, exportArena } from './parseDck'
import { DECKS } from '../lobby/decks'
import { DeckBrowser } from './DeckBrowser'
import type { MetaDeckItem } from './metaDeckCatalog'
import { useTranslation } from '../i18n'
import './DecksGallery.css'

function preconToV2(): DeckV2[] {
  const now = Date.now()
  return DECKS.map((d, i) => ({
    ...d,
    id: `precon-${i}-${d.name}`,
    format: d.cards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' as const : 'Freeform' as const,
    colors: [],
    coverCard: d.cards[0],
    createdAt: now - 1000000 - i * 1000,
    updatedAt: now - 1000000 - i * 1000,
    source: 'precon' as const,
  }))
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
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importName, setImportName] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const storage = useMemo(() => getDeckStorage(), [])
  const precon = useMemo(() => preconToV2(), [])

  const load = async () => {
    const custom = await storage.list()
    setDecks([...custom, ...precon])
    if (!selectedId && custom.length > 0) setSelectedId(custom[0].id)
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

  useEffect(() => {
    if (decks.length === 0) return
    let cancelled = false
    void (async () => {
      const updated = await Promise.all(decks.map(async (d, idx) => {
        if (d.colors.length > 0) return d
        if (idx >= 12) return d
        const uniq = [...new Map(d.cards.slice(0, 6).map((c) => [`${c.setCode}/${c.cardNumber}:${c.cardName}`, c])).values()]
        const set = new Set<string>()
        for (const c of uniq) {
          if (cancelled) break
          try {
            let data: { color_identity?: string[] } | null = null
            if (c.setCode && c.cardNumber && c.cardNumber !== '0') {
              const r = await fetch(`https://api.scryfall.com/cards/${c.setCode}/${c.cardNumber}?format=json`, { headers: { Accept: 'application/json' } })
              if (r.ok) data = await r.json() as { color_identity?: string[] }
            }
            if (!data || !data.color_identity?.length) {
              const r2 = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.cardName)}`, { headers: { Accept: 'application/json' } })
              if (r2.ok) data = await r2.json() as { color_identity?: string[] }
            }
            if (data?.color_identity) for (const col of data.color_identity) set.add(col)
            await new Promise((rr) => setTimeout(rr, 75))
          } catch {}
        }
        if (set.size === 0) return d
        const sorted = [...set].sort() as DeckV2['colors']
        if (d.source !== 'precon' && sorted.length) {
          const upd: DeckV2 = { ...d, colors: sorted }
          try { await storage.put(upd) } catch {}
        }
        return { ...d, colors: sorted }
      }))
      if (!cancelled) setDecks(updated)
    })()
    return () => { cancelled = true }
  }, [decks.length])

  const handleCreate = async () => {
    if (customCount >= MAX_DECKS) return
    const now = Date.now()
    const empty: DeckV2 = {
      id: makeDeckId(),
      name: `${t('decks', 'box_create').replace('Crear ', '').replace('Create ', '')} ${customCount + 1}`,
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

  const handleCloneFromBrowser = async (d: MetaDeckItem | DeckV2) => {
    const v2: DeckV2 = {
      id: makeDeckId(),
      name: d.name,
      format: d.format,
      cards: d.cards,
      sideboard: d.sideboard,
      colors: d.colors,
      coverCard: d.coverCard ?? d.cards[0],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'custom',
    }
    await storage.put(v2)
    await load()
    setSelectedId(v2.id)
  }

  const handleImport = async () => {
    setImportError(null)
    if (!importText.trim()) { setImportError(t('errors', 'deck_parse_failed')); return }
    const parsed = parseAnyDeck(importText, importName.trim() || t('decks', 'import_placeholder'))
    if (!parsed) { setImportError(t('errors', 'deck_parse_failed')); return }
    setBusy(true)
    try {
      const v2: DeckV2 = {
        ...parsed,
        id: makeDeckId(),
        format: parsed.cards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' : 'Freeform',
        colors: [],
        coverCard: parsed.cards[0],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'imported',
      }
      await storage.put(v2)
      await load()
      setSelectedId(v2.id)
      setShowImport(false)
      setImportText('')
      setImportName('')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || selected.source === 'precon') return
    if (!confirm(`${t('common', 'delete')} "${selected.name}"?`)) return
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

  const handleExport = (fmt: 'dck' | 'arena') => {
    if (!selected) return
    const text = fmt === 'dck' ? exportDck(selected) : exportArena(selected)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected.name.replace(/[^a-z0-9\-_ ]/gi, '_')}.${fmt === 'dck' ? 'dck' : 'txt'}`
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
    if (customDecks.length === 0) {
      alert(t('decks', 'deck_no_cards'))
      return
    }
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

  const handleRestoreBackup = async (f: File) => {
    try {
      const text = await f.text()
      const json = JSON.parse(text)
      const deckList: DeckV2[] = Array.isArray(json) ? json : (Array.isArray(json.decks) ? json.decks : [])
      if (deckList.length === 0) {
        alert(t('errors', 'deck_read_failed'))
        return
      }
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
        }
      }
      await load()
      alert(`${t('common', 'done')}: ${deckList.length}`)
    } catch {
      alert(t('errors', 'deck_read_failed'))
    }
  }

  const handleFile = async (f: File) => {
    const text = await f.text()
    const name = f.name.replace(/\.(dck|txt|cod|dec)$/i, '')
    const parsed = parseAnyDeck(text, name || t('decks', 'import_placeholder'))
    if (!parsed) { setImportError(`${t('errors', 'deck_read_failed')}: ${f.name}`); setShowImport(true); return }
    const v2: DeckV2 = { ...parsed, id: makeDeckId(), format: parsed.cards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' : 'Freeform', colors: [], coverCard: parsed.cards[0], createdAt: Date.now(), updatedAt: Date.now(), source: 'imported' }
    await storage.put(v2); await load(); setSelectedId(v2.id)
  }

  return (
    <div className="decks-gallery">
      <header className="decks-gallery-top">
        <h1 className="decks-title">{t('decks', 'my_decks').toUpperCase()}</h1>

        <div className="gallery-view-tabs">
          <button
            type="button"
            className={`gallery-view-tab ${mainView === 'my-decks' ? 'active' : ''}`}
            onClick={() => setMainView('my-decks')}
          >
            📦 {t('decks', 'my_decks')} ({customCount})
          </button>
          <button
            type="button"
            className={`gallery-view-tab ${mainView === 'browser' ? 'active' : ''}`}
            onClick={() => setMainView('browser')}
          >
            🌍 {t('decks', 'popular_meta')}
          </button>
        </div>

        {mainView === 'my-decks' && (
          <>
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
                  <button key={c} type="button" className={`mana-filter-btn ${colorFilter.has(c) ? 'active' : ''} pip-${c.toLowerCase()}`} onClick={() => toggleColor(c)} title={c}>{c}</button>
                ))}
              </div>
            </div>
            <div className="decks-counter">{customCount}/{MAX_DECKS}</div>
          </>
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
              <DeckBox key={d.id} deck={d} selected={selectedId === d.id} onSelect={() => setSelectedId(d.id)} />
            ))}
          </div>

          <footer className="decks-footer">
            <div className="decks-footer-left">
              <label className="decks-footer-btn">
                📥 {t('decks', 'import_deck')}
                <input type="file" accept=".dck,.txt,.cod,.dec,.o8d" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) await handleFile(f)
                  e.currentTarget.value = ''
                }} />
              </label>
              <button type="button" className="decks-footer-btn" onClick={() => setShowImport(true)}>📝 {t('decks', 'import_hint')}</button>
              <button type="button" className="decks-footer-btn" onClick={handleBackupAll} title={t('decks', 'export_deck')}>📦 {t('common', 'save')}</button>
              <label className="decks-footer-btn" title={t('decks', 'import_hint')}>
                📥 {t('common', 'refresh')}
                <input type="file" accept=".json" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) await handleRestoreBackup(f)
                  e.currentTarget.value = ''
                }} />
              </label>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={() => handleExport('dck')}>💾 {t('decks', 'export_deck')} .dck</button>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={() => handleExport('arena')}>📋 {t('decks', 'export_deck')} Arena</button>
              <button type="button" className="decks-footer-btn" disabled={!selected} onClick={handleClone}>📑 {t('common', 'copy')}</button>
              <button type="button" className="decks-footer-btn danger" disabled={!selected || selected?.source === 'precon'} onClick={handleDelete}>🗑️ {t('common', 'delete')}</button>
              <button type="button" className={`decks-footer-btn ${selected?.favorite ? 'fav-active' : ''}`} disabled={!selected || selected?.source === 'precon'} onClick={handleFavorite}>★ {t('common', 'all')}</button>
            </div>
            <button type="button" className="decks-edit-btn" disabled={!selected} onClick={() => selected && onEdit(selected.id)}>✏️ {t('common', 'edit')}</button>
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

      {showImport && (
        <div className="overlay" onClick={() => setShowImport(false)}>
          <div className="dialog panel decks-import-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>📥 {t('decks', 'import_deck')}</h2>
            <p className="decks-import-hint">{t('decks', 'import_hint')}</p>
            <label>{t('common', 'player')} <input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder={t('decks', 'import_placeholder')} /></label>
            <label>{t('decks', 'total_cards')} <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={12} placeholder={`NAME:${t('decks', 'import_placeholder')}\n4 [M10:146] Lightning Bolt\nSB: 2 [4ED:218] Red Elemental Blast\n\n—o—\nDeck\n4 Lightning Bolt (M10) 146\nSideboard\n2 Red Elemental Blast (4ED) 218`} /></label>
            {importError && <div className="error-box">{importError}</div>}
            <div className="decks-import-actions">
              <button type="button" onClick={() => setShowImport(false)}>{t('common', 'cancel')}</button>
              <button type="button" className="primary" disabled={busy} onClick={handleImport}>{busy ? t('common', 'loading') : t('decks', 'import_deck')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
