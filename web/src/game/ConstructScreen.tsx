import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import { setState, addLog, getState } from '../state/state'
import type { SimpleCardView } from '../net/types'
import type { DeckCard } from '../lobby/decks'
import { ArenaCardStrip } from '../decks/ArenaCardStrip'
import type { CardStripMeta } from '../decks/ArenaCardStrip'
import { validateDeckForFormat } from '../decks/formatRules'
import type { DeckFormat } from '../decks/types'
import { useTranslation } from '../i18n'
import './ConstructScreen.css'

function deckCardKey(c: DeckCard): string {
  return `${c.setCode}:${c.cardNumber}:${c.cardName}`
}

function poolToDeckCards(pool: Record<string, unknown>): DeckCard[] {
  const map = new Map<string, DeckCard>()
  for (const [instanceId, raw] of Object.entries(pool)) {
    const sc = raw as SimpleCardView & { cardName?: string; name?: string }
    const name = (sc as any).name ?? (sc as any).cardName ?? sc.id ?? instanceId
    const set = sc.expansionSetCode ?? ''
    const num = sc.cardNumber ?? ''
    const cardName = String(name)
    if (!cardName) continue
    const key = `${cardName}|${set}|${num}`
    const existing = map.get(key)
    if (existing) existing.amount++
    else map.set(key, { cardName, setCode: set, cardNumber: num, amount: 1 })
  }
  return [...map.values()]
}

function categorizeCard(typeLine?: string): string {
  if (!typeLine) return 'Otros'
  const t = typeLine.toLowerCase()
  if (t.includes('creature') || t.includes('criatura')) return 'Criaturas'
  if (t.includes('planeswalker')) return 'Planeswalkers'
  if (t.includes('instant') || t.includes('instantáneo')) return 'Instantáneos'
  if (t.includes('sorcery') || t.includes('conjuro')) return 'Conjuros'
  if (t.includes('enchantment') || t.includes('encantamiento')) return 'Encantamientos'
  if (t.includes('artifact') || t.includes('artefacto')) return 'Artefactos'
  if (t.includes('land') || t.includes('tierra')) return 'Tierras'
  return 'Otros'
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ConstructScreen() {
  const { t } = useTranslation()
  const construct = useStore((s) => s.construct)
  useEffect(() => {
    if (construct && getState().phase !== 'game') setState({ phase: 'game' })
  }, [construct])
  const [main, setMain] = useState<DeckCard[]>([])
  const [pool, setPool] = useState<DeckCard[]>([])
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const [timeLeft, setTimeLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [hoverPreview, setHoverPreview] = useState<{ url: string; backUrl?: string | null; x: number; y: number; name?: string } | null>(null)
  const [mainFilter, setMainFilter] = useState('')
  const [poolFilter, setPoolFilter] = useState('')
  const [isMainDragOver, setIsMainDragOver] = useState(false)
  const [isPoolDragOver, setIsPoolDragOver] = useState(false)
  const submitRef = useRef<() => Promise<void>>(async () => {})
  const poolSize = useMemo(() => {
    if (!construct?.pool) return 0
    return Object.keys(construct.pool).length
  }, [construct?.pool])

  useEffect(() => {
    if (!construct) return
    const grouped = poolToDeckCards(construct.pool as Record<string, unknown>)
    setPool(grouped)
    setMain([])
    setTimeLeft(construct.timeLeft)
    setMainFilter('')
    setPoolFilter('')
  }, [construct?.tableId])

  const updateMetaForCards = useCallback((cards: DeckCard[]) => {
    const toFetch: DeckCard[] = []
    for (const c of cards) {
      const k = `${c.setCode}/${c.cardNumber}`
      if (!metaMap.has(k) && !metaMap.has(c.cardName.toLowerCase())) {
        toFetch.push(c)
      }
    }
    if (toFetch.length === 0) return
    for (const c of toFetch) {
      const url = c.setCode && c.cardNumber && c.cardNumber !== '0'
        ? `https://api.scryfall.com/cards/${c.setCode}/${c.cardNumber}?format=json`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.cardName)}`
      fetch(url, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return
          const meta: CardStripMeta = {
            artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
            imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
            backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
            manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
            cmc: data.cmc ?? 0,
            typeLine: data.type_line ?? data.card_faces?.[0]?.type_line ?? '',
            colors: data.colors ?? data.color_identity ?? [],
            legalities: data.legalities,
          }
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            nxt.set(`${c.setCode}/${c.cardNumber}`, meta)
            nxt.set(c.cardName.toLowerCase(), meta)
            return nxt
          })
        })
        .catch(() => {})
    }
  }, [metaMap])

  useEffect(() => {
    if (main.length === 0 && pool.length === 0) return
    updateMetaForCards([...main, ...pool])
  }, [main.length, pool.length])

  const handleHover = useCallback((card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => {
    let img: string | null = meta?.imageUrl ?? null
    let backImg: string | null = meta?.backImageUrl ?? null
    if (!img) {
      const m = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
      img = m?.imageUrl ?? null
      backImg = m?.backImageUrl ?? null
    }
    if (!img) return
    const previewWidth = backImg ? 520 : 255
    let x = 0
    let y = 0
    if (rect) {
      if (rect.left > window.innerWidth / 2) x = Math.max(10, rect.left - previewWidth - 15)
      else x = Math.min(window.innerWidth - previewWidth - 15, rect.right + 15)
      y = Math.max(30, Math.min(window.innerHeight - 380, rect.top - 40))
    } else {
      x = window.innerWidth / 2 - previewWidth / 2
      y = window.innerHeight / 2 - 180
    }
    setHoverPreview({ url: img, backUrl: backImg, x, y, name: card.cardName })
  }, [metaMap])

  const handleLeave = useCallback(() => setHoverPreview(null), [])

  const handleInc = useCallback((actionKey: string) => {
    const isPool = actionKey.startsWith('pool:')
    const key = isPool ? actionKey.slice(5) : actionKey.startsWith('sb:') ? actionKey.slice(3) : actionKey
    if (isPool || actionKey.startsWith('sb:')) {
      setPool((prev) => prev.map((c) => (deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c)))
    } else {
      setMain((prev) => prev.map((c) => (deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c)))
    }
  }, [])

  const handleDec = useCallback((actionKey: string) => {
    const isPool = actionKey.startsWith('pool:')
    const key = isPool ? actionKey.slice(5) : actionKey.startsWith('sb:') ? actionKey.slice(3) : actionKey
    if (isPool || actionKey.startsWith('sb:')) {
      setPool((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    } else {
      setMain((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    }
  }, [])

  const handleRemove = useCallback((actionKey: string) => {
    const isPool = actionKey.startsWith('pool:')
    const key = isPool ? actionKey.slice(5) : actionKey.startsWith('sb:') ? actionKey.slice(3) : actionKey
    if (isPool || actionKey.startsWith('sb:')) {
      setPool((prev) => prev.filter((c) => deckCardKey(c) !== key))
    } else {
      setMain((prev) => prev.filter((c) => deckCardKey(c) !== key))
    }
  }, [])

  const moveOneToMain = useCallback((actionKey: string) => {
    const key = actionKey.startsWith('pool:') ? actionKey.slice(5) : actionKey.startsWith('sb:') ? actionKey.slice(3) : actionKey
    const src = pool.find((c) => deckCardKey(c) === key)
    if (!src) return
    setPool((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    setMain((prev) => {
      const idx = prev.findIndex((c) => deckCardKey(c) === key)
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, amount: c.amount + 1 } : c))
      return [...prev, { cardName: src.cardName, setCode: src.setCode, cardNumber: src.cardNumber, amount: 1 }]
    })
  }, [pool])

  const moveOneToPool = useCallback((actionKey: string) => {
    const key = actionKey.startsWith('pool:') ? actionKey.slice(5) : actionKey
    const src = main.find((c) => deckCardKey(c) === key)
    if (!src) return
    setMain((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    setPool((prev) => {
      const idx = prev.findIndex((c) => deckCardKey(c) === key)
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, amount: c.amount + 1 } : c))
      return [...prev, { cardName: src.cardName, setCode: src.setCode, cardNumber: src.cardNumber, amount: 1 }]
    })
  }, [main])

  const handleDropOnMain = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsMainDragOver(false)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      if ((data.source === 'sideboard' || data.source === 'pool') && data.key) {
        moveOneToMain(data.key.startsWith('pool:') ? data.key : `pool:${data.key.replace(/^sb:/, '')}`)
      } else if (data.key) {
        const k = data.key.startsWith('pool:') ? data.key : data.key.includes(':') ? `pool:${data.key.split(':').slice(1).join(':')}` : `pool:${data.key}`
        if (pool.some((c) => deckCardKey(c) === k.replace(/^pool:/, ''))) moveOneToMain(k)
      }
    } catch {}
  }, [moveOneToMain, pool])

  const handleDropOnPool = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsPoolDragOver(false)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      if (data.source === 'main' && data.key) {
        moveOneToPool(data.key)
      }
    } catch {}
  }, [moveOneToPool])

  const submitDeck = useCallback(async () => {
    if (!construct || busy) return
    setBusy(true)
    try {
      const deck = {
        name: construct.deckName,
        cards: main,
        sideboard: pool,
      }
      const result = await cmds.submitDeck(construct.tableId, deck)
      if (result.ok) {
        setState({ construct: null })
        addLog('torneo', t('game', 'sideboard_submit'))
      } else {
        addLog('error', `${t('errors', 'send_failed')}: ${result.error ?? t('errors', 'generic_error')}`)
      }
    } finally {
      setBusy(false)
    }
  }, [construct, main, pool, busy])

  useEffect(() => { submitRef.current = submitDeck }, [submitDeck])

  useEffect(() => {
    if (!construct || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer)
          void submitRef.current()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [construct?.tableId])

  const formatForValidation: DeckFormat = useMemo(() => {
    return 'Freeform' as DeckFormat
  }, [])

  const validation = useMemo(() => {
    if (main.length === 0 && pool.length === 0) return { isValid: true, issues: [] as any[], cardIssues: new Map() }
    const fakeDeck: any = {
      name: construct?.deckName ?? t('game', 'construct_title'),
      cards: main,
      sideboard: pool,
      format: formatForValidation,
      id: 'construct-tmp',
      colors: [],
      createdAt: 0,
      updatedAt: 0,
      source: 'custom',
    }
    return validateDeckForFormat(fakeDeck, metaMap)
  }, [main, pool, metaMap, formatForValidation, construct?.deckName])

  if (!construct) return null

  const mainTotal = main.reduce((s, c) => s + c.amount, 0)
  const poolTotal = pool.reduce((s, c) => s + c.amount, 0)
  const minMain = 40
  const mainValid = mainTotal >= minMain
  const timerPct = Math.max(0, (timeLeft / (construct.timeLeft || 1)) * 100)
  const timerUrgent = timeLeft <= 30

  const categoriesOrder = ['Criaturas', 'Planeswalkers', 'Instantáneos', 'Conjuros', 'Artefactos', 'Encantamientos', 'Tierras', 'Otros'] as const
  const groupedMain = new Map<string, DeckCard[]>()
  for (const cat of categoriesOrder) groupedMain.set(cat, [])
  const filteredMainForGroup = mainFilter.trim()
    ? main.filter((c) => c.cardName.toLowerCase().includes(mainFilter.toLowerCase()) || c.setCode.toLowerCase().includes(mainFilter.toLowerCase()))
    : main
  for (const card of filteredMainForGroup) {
    const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
    const cat = categorizeCard(meta?.typeLine)
    const list = groupedMain.get(cat) ?? groupedMain.get('Otros')!
    list.push(card)
  }

  const filteredPool = poolFilter.trim()
    ? pool.filter((c) => c.cardName.toLowerCase().includes(poolFilter.toLowerCase()) || c.setCode.toLowerCase().includes(poolFilter.toLowerCase()))
    : pool

  return (
    <div className="construct-backdrop" role="presentation">
      <section className="construct-screen" role="dialog" aria-modal="true" aria-label="Construcción limitado">
        <div className="construct-header">
          <div className="construct-title">
            <h2>{t('game','construct_title')}</h2>
            <span className="construct-deck-name">{construct.deckName}</span>
            <span className="construct-pool-info">{poolSize} cartas en pool</span>
          </div>
          <div className={`construct-timer ${timerUrgent ? 'urgent' : ''}`}>
            <div className="construct-timer-bar" style={{ width: `${timerPct}%` }} />
            <span className="construct-timer-text">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="construct-columns">
          <div
            className={`construct-column ${isPoolDragOver ? 'is-drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isPoolDragOver) setIsPoolDragOver(true) }}
            onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsPoolDragOver(false) }}
            onDrop={handleDropOnPool}
          >
            <div className="construct-col-header">
              <h3>Pool</h3>
              <span className="construct-col-count">{poolTotal}</span>
            </div>
            {pool.length > 10 && (
              <input
                className="construct-filter"
                type="text"
                placeholder={t('game', 'sideboard_filter')}
                value={poolFilter}
                onChange={(e) => setPoolFilter(e.target.value)}
              />
            )}
            <div className="construct-card-list construct-arena-list">
              {isPoolDragOver && (
                <div className="arena-drop-target-hint"><span>✨</span> {t('game', 'construct_pool')}</div>
              )}
              {filteredPool.map((card) => {
                const k = `pool:${deckCardKey(card)}`
                const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                const issue = validation.cardIssues.get(k)?.message ?? validation.cardIssues.get(card.cardName)?.message
                return (
                  <ArenaCardStrip
                    key={k}
                    card={card}
                    meta={meta}
                    sideboard
                    issue={issue}
                    onInc={handleInc}
                    onDec={handleDec}
                    onRemove={handleRemove}
                    onSwap={moveOneToMain}
                    swapLabel={`${t('game', 'sideboard_main')} →`}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                )
              })}
              {filteredPool.length === 0 && (
                <div className="deck-list-empty-hint"><small>{t('game', 'construct_pool')}</small></div>
              )}
            </div>
          </div>

          <div
            className={`construct-column ${isMainDragOver ? 'is-drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isMainDragOver) setIsMainDragOver(true) }}
            onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsMainDragOver(false) }}
            onDrop={handleDropOnMain}
          >
            <div className="construct-col-header">
              <h3>{t('game', 'sideboard_main')}</h3>
              <span className={`construct-col-count ${mainValid ? 'valid' : 'invalid'}`}>{mainTotal}</span>
            </div>
            {main.length > 10 && (
              <input
                className="construct-filter"
                type="text"
                placeholder={t('game', 'sideboard_filter')}
                value={mainFilter}
                onChange={(e) => setMainFilter(e.target.value)}
              />
            )}
            <div className="construct-card-list construct-arena-list">
              {isMainDragOver && (
                <div className="arena-drop-target-hint"><span>✨</span> {t('game', 'sideboard_main')}</div>
              )}
              {categoriesOrder.map((cat) => {
                const list = groupedMain.get(cat) ?? []
                if (list.length === 0) return null
                const count = list.reduce((s, c) => s + c.amount, 0)
                return (
                  <div key={cat} className="deck-category-section">
                    <div className="deck-category-header"><span>{cat}</span><span className="deck-category-count">{count}</span></div>
                    {list.map((card) => {
                      const k = deckCardKey(card)
                      const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                      const issue = validation.cardIssues.get(k)?.message ?? validation.cardIssues.get(card.cardName)?.message
                      return (
                        <ArenaCardStrip
                          key={k}
                          card={card}
                          meta={meta}
                          issue={issue}
                          onInc={handleInc}
                          onDec={handleDec}
                          onRemove={handleRemove}
                          onSwap={moveOneToPool}
                          swapLabel={`← ${t('game', 'construct_pool')}`}
                          onHover={handleHover}
                          onLeave={handleLeave}
                        />
                      )
                    })}
                  </div>
                )
              })}
              {main.length === 0 && (
                <div className="deck-list-empty-hint"><span>{t('game', 'sideboard_invalid')}</span></div>
              )}
            </div>
          </div>
        </div>

        {validation.issues.length > 0 && (
          <div className="construct-validation">
            {validation.issues.slice(0, 3).map((iss: any, i: number) => (
              <span key={i} className={`validation-issue ${iss.severity}`}>{iss.message}</span>
            ))}
          </div>
        )}

        <div className="construct-footer">
          <div className="construct-counts">
            <span className={mainValid ? 'valid' : 'invalid'}>{t('game', 'construct_total', { count: mainTotal })} (mín {minMain})</span>
            <span>Pool: {poolTotal}</span>
            <span>Total: {mainTotal + poolTotal} / {poolSize}</span>
          </div>
          <button
            className="primary"
            disabled={busy || !mainValid}
            onClick={() => void submitDeck()}
            title={!mainValid ? `${t('game', 'sideboard_main')}: ${minMain}` : undefined}
            data-testid="construct-submit"
          >
            {busy ? t('game', 'action_sending') : t('game', 'sideboard_submit')}
          </button>
        </div>
      </section>
      {hoverPreview && (
        <div
          className={`arena-floating-preview ${hoverPreview.backUrl ? 'has-back-face' : ''}`}
          style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px` }}
        >
          <div className="preview-face-card">
            {hoverPreview.backUrl && <span className="preview-face-label">Anverso</span>}
            <img src={hoverPreview.url} alt={hoverPreview.name ?? 'Anverso'} />
          </div>
          {hoverPreview.backUrl && (
            <div className="preview-face-card">
              <span className="preview-face-label">Reverso</span>
              <img src={hoverPreview.backUrl} alt={`${hoverPreview.name ?? 'Carta'} (Reverso)`} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
