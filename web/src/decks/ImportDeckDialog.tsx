import CloseButton from '../ui/CloseButton'
import { useMemo, useRef, useState } from 'react'
import { parseAnyDeck } from './parseDck'
import { loadDeckFromOnlineSource } from './onlineDeckService'
import type { DeckFormat, DeckV2 } from './types'
import { ALL_FORMATS, validateDeckForFormat } from './formatRules'
import {
  countUnresolved,
  resolveDeckPrintings,
  suggestFormat,
  isCommanderDeckFormat,
  type PrintingStrategy,
  type ResolveResult,
} from './importResolve'
import type { CardStripMeta } from './ArenaCardStrip'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import './DeckImportModal.css'
import './ImportDeckDialog.css'
import Button from '../ui/Button'

const ONLINE_URL_PATTERN = /(moxfield\.com\/decks\/|archidekt\.com\/decks\/)/i

type Step = 'source' | 'setup' | 'review'
type SetupStrategy = PrintingStrategy

const STEP_LABEL = {
  source: 'import_step_source',
  setup: 'import_step_setup',
  review: 'import_step_review',
} as const

const PRINTING_LABEL = {
  default: ['import_printing_default', 'import_printing_default_desc'],
  oldest: ['import_printing_oldest', 'import_printing_oldest_desc'],
  set: ['import_printing_set', 'import_printing_set_desc'],
  keep: ['import_printing_keep', 'import_printing_keep_desc'],
} as const

const PREFS_KEY = 'xmage.import.prefs.v1'

function readPrefs(): { strategy: SetupStrategy; setCode: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
    const strategy = ['default', 'oldest', 'set', 'keep'].includes(raw.strategy) ? raw.strategy : 'default'
    return { strategy, setCode: typeof raw.setCode === 'string' ? raw.setCode : '' }
  } catch {
    return { strategy: 'default', setCode: '' }
  }
}

function writePrefs(strategy: SetupStrategy, setCode: string) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ strategy, setCode }))
  } catch {
    // preferences are a convenience only
  }
}

export function ImportDeckDialog({
  onImport,
  onClose,
  initialText = '',
  initialName = '',
}: {
  onImport: (deck: DeckV2) => Promise<void> | void
  onClose: () => void
  initialText?: string
  initialName?: string
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [text, setText] = useState(initialText)
  const [step, setStep] = useState<Step>('source')
  const [draft, setDraft] = useState<DeckV2 | null>(null)
  const [format, setFormat] = useState<DeckFormat>('Standard')
  const [suggested, setSuggested] = useState<DeckFormat>('Standard')
  const prefs = useMemo(readPrefs, [])
  const [strategy, setStrategy] = useState<SetupStrategy>(prefs.strategy)
  const [setCode, setSetCode] = useState(prefs.setCode)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<ResolveResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isOnlineUrl = ONLINE_URL_PATTERN.test(text.trim())

  const localPreview = useMemo(() => {
    if (!text.trim() || isOnlineUrl) return null
    return parseAnyDeck(text, name.trim() || t('decks', 'import_placeholder'))
  }, [text, name, isOnlineUrl, t])

  const mainCount = localPreview?.cards.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const sideCount = localPreview?.sideboard.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const totalCount = mainCount + sideCount

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (typeof clip === 'string' && clip.trim()) {
        setText(clip)
        setError(null)
        return
      }
      setError(t('errors', 'deck_read_failed'))
    } catch {
      setError(t('errors', 'deck_read_failed'))
    }
  }

  const handleFile = async (f: File) => {
    try {
      const content = await f.text()
      setText(content)
      if (!name.trim()) setName(f.name.replace(/\.[^./]+$/, ''))
      setError(null)
    } catch {
      setError(`${t('errors', 'deck_read_failed')}: ${f.name}`)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError(t('errors', 'deck_parse_failed'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const deck = await loadDeckFromOnlineSource(text, name.trim())
      if (!deck) {
        setError(t('errors', 'deck_parse_failed'))
        return
      }
      await onImport(deck)
      onClose()
    } catch {
      setError(t('errors', 'connection_failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleNext = async () => {
    if (!text.trim()) {
      setError(t('errors', 'deck_parse_failed'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const deck = await loadDeckFromOnlineSource(text, name.trim())
      if (!deck) {
        setError(t('errors', 'deck_parse_failed'))
        return
      }
      const guess = suggestFormat({ cards: deck.cards, sideboard: deck.sideboard, commanders: deck.commanders })
      setDraft(deck)
      setName(deck.name)
      setSuggested(guess)
      setFormat(guess)
      setResult(null)
      setStep('setup')
    } catch {
      setError(t('errors', 'connection_failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleResolve = async () => {
    if (!draft) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    writePrefs(strategy, setCode)
    try {
      const res = await resolveDeckPrintings(
        { cards: draft.cards, sideboard: draft.sideboard, commanders: draft.commanders },
        {
          strategy,
          setCode: setCode.trim() || undefined,
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        },
      )
      if (controller.signal.aborted) return
      setResult(res)
      setStep('review')
    } catch {
      setError(t('errors', 'connection_failed'))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const finalDeck = useMemo<DeckV2 | null>(() => {
    if (!draft) return null
    const cards = result?.cards ?? draft.cards
    const sideboard = result?.sideboard ?? draft.sideboard
    const commanders = result?.commanders ?? draft.commanders
    const commander = isCommanderDeckFormat(format) ? commanders?.[0] : undefined
    const partner = isCommanderDeckFormat(format) ? commanders?.[1] : undefined
    return {
      ...draft,
      name: name.trim() || draft.name,
      format,
      cards,
      sideboard,
      commanders,
      coverCard: commander ?? cards[0],
      commanderCard: commander,
      partnerCard: partner,
    }
  }, [draft, result, format, name])

  const metaByName: Map<string, CardStripMeta> = result?.metaByName ?? new Map()
  const validation = useMemo(
    () => (finalDeck ? validateDeckForFormat(finalDeck, metaByName) : null),
    [finalDeck, metaByName],
  )

  const removeUnresolved = (cardName: string) => {
    if (!result) return
    const keep = (c: { cardName: string }) => c.cardName !== cardName
    setResult({
      ...result,
      cards: result.cards.filter(keep),
      sideboard: result.sideboard.filter(keep),
      commanders: result.commanders?.filter(keep),
      unresolved: result.unresolved.filter((n) => n !== cardName),
    })
  }

  const handleCreate = async () => {
    if (!finalDeck) return
    setBusy(true)
    try {
      await onImport(finalDeck)
      onClose()
    } catch {
      setError(t('errors', 'connection_failed'))
    } finally {
      setBusy(false)
    }
  }

  const goBack = () => {
    abortRef.current?.abort()
    setError(null)
    setStep(step === 'review' ? 'setup' : 'source')
  }

  const missingPrintings = draft
    ? countUnresolved({ cards: draft.cards, sideboard: draft.sideboard, commanders: draft.commanders })
    : 0
  const steps: Step[] = ['source', 'setup', 'review']

  return (
    <DialogShell
      labelledBy="import-deck-title"
      titleId="import-deck-title"
      size="lg"
      legacyBackdropClass="deck-import-backdrop"
      legacyPanelClass={`deck-import-modal${isDragOver ? ' drag-over' : ''}`}
      kickerIcon="download"
      kickerLabel={t('decks', 'import_deck')}
      title={t('decks', 'import_deck')}
      message={step === 'source' ? t('decks', 'import_formats_with_url') : undefined}
      topRight={(
        <CloseButton variant="plain" size="md" className="deck-import-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      sectionProps={{
        onDragOver: (e) => {
          e.preventDefault()
          setIsDragOver(true)
        },
        onDragLeave: (e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setIsDragOver(false)
        },
        onDrop: handleDrop,
      }}
    >
      <ol className="import-stepper" aria-label={t('decks', 'import_deck')}>
        {steps.map((s, idx) => (
          <li
            key={s}
            className={`import-step${s === step ? ' active' : ''}${steps.indexOf(step) > idx ? ' done' : ''}`}
            aria-current={s === step ? 'step' : undefined}
          >
            <span className="import-step-num">{steps.indexOf(step) > idx ? '✓' : idx + 1}</span>
            <span className="import-step-label">{t('decks', STEP_LABEL[s])}</span>
          </li>
        ))}
      </ol>

      {step === 'source' && (
        <div className="deck-import-body">
        <label className="import-name-row">
          <span className="import-name-label">{t('decks', 'import_deck_name_label')}</span>
          <input
            className="import-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('decks', 'import_placeholder')}
          />
        </label>

        <span className="import-textarea-label">{t('decks', 'import_textarea_label')}</span>
        <div className="deck-import-textarea-wrap">
          <textarea
            className="deck-import-textarea"
            placeholder={t('decks', 'import_textarea_placeholder')}
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            autoFocus
          />

          {isDragOver && (
            <div className="import-drop-overlay">
              <span>{t('decks', 'builder_drag_hint')}</span>
            </div>
          )}
        </div>

        <div className="deck-import-status-bar">
          <div className="import-status-left">
            <label className="import-file-btn">
              <Icon name="folder" size={12} /> {t('decks', 'import_choose_file')}
              <input
                type="file"
                accept=".dck,.txt,.dec,.cod,.o8d,.dek,.mtga,.mwdeck,.draft,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) await handleFile(f)
                  e.currentTarget.value = ''
                }}
              />
            </label>

            {text.trim() && (
              <Button variant="link" size="sm"
                onClick={() => {
                  setText('')
                  setError(null)
                }}>
                {t('common', 'clear')}
              </Button>
            )}
            <Button variant="subtle" size="sm" data-testid="import-paste-btn"
              title={t('decks', 'import_paste')}
              onClick={() => void handlePaste()}>
              <Icon name="clipboard" size={12} /> {t('decks', 'import_paste')}
            </Button>
          </div>

          <div className="import-status-right">
            {isOnlineUrl ? (
              <div className="import-badge success">
                <Icon name="globe" size={12} /> {t('decks', 'import_url_detected')}
              </div>
            ) : localPreview && totalCount > 0 ? (
              <div className="import-badge success">
                {t('decks', 'import_recognized', { mainCount: String(mainCount), sideCount: String(sideCount) })}
              </div>
            ) : text.trim() ? (
              <div className="import-badge warning">
                <Icon name="alert" size={13} /> {t('errors', 'deck_parse_failed')}
              </div>
            ) : (
              <span className="import-hint-text">{t('decks', 'import_waiting')}</span>
            )}
          </div>
        </div>

        {error && <div className="deck-import-error">{error}</div>}
      </div>
      )}

      {step === 'setup' && draft && (
        <div className="deck-import-body import-setup" data-testid="import-step-setup">
          <label className="import-name-row">
            <span className="import-name-label">{t('decks', 'import_deck_name_label')}</span>
            <input className="import-name-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="import-name-row">
            <span className="import-name-label">{t('decks', 'import_setup_format')}</span>
            <select
              className="import-name-input"
              data-testid="import-format-select"
              value={format}
              onChange={(e) => setFormat(e.target.value as DeckFormat)}
            >
              {ALL_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <span className="import-hint-text">{t('decks', 'import_setup_format_detected', { format: suggested })}</span>
          </label>

          <fieldset className="import-printing-group">
            <legend className="import-name-label">{t('decks', 'import_setup_printing')}</legend>
            {missingPrintings === 0 && (
              <span className="import-hint-text">{t('decks', 'import_setup_all_printed')}</span>
            )}
            {(['default', 'oldest', 'set', 'keep'] as const).map((opt) => (
              <label key={opt} className={`import-printing-option${strategy === opt ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="import-printing"
                  checked={strategy === opt}
                  onChange={() => setStrategy(opt)}
                  data-testid={`import-printing-${opt}`}
                />
                <span>
                  <strong>{t('decks', PRINTING_LABEL[opt][0])}</strong>
                  <small>{t('decks', PRINTING_LABEL[opt][1])}</small>
                </span>
              </label>
            ))}
            {strategy === 'set' && (
              <input
                className="import-name-input import-set-input"
                data-testid="import-set-input"
                value={setCode}
                maxLength={6}
                onChange={(e) => setSetCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder={t('decks', 'import_set_placeholder')}
              />
            )}
          </fieldset>

          {busy && progress && (
            <div className="import-progress" role="status" aria-live="polite">
              <div className="import-progress-bar">
                <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <span>{t('decks', 'import_resolving', { done: String(progress.done), total: String(progress.total) })}</span>
            </div>
          )}
          {error && <div className="deck-import-error">{error}</div>}
        </div>
      )}

      {step === 'review' && finalDeck && result && (
        <div className="deck-import-body import-review" data-testid="import-step-review">
          <div className="import-review-summary">
            <div className="import-badge success">
              {t('decks', 'import_review_size', {
                main: String(finalDeck.cards.reduce((n, c) => n + c.amount, 0)),
                side: String(finalDeck.sideboard.reduce((n, c) => n + c.amount, 0)),
              })}
            </div>
            <div className="import-badge">{finalDeck.format}</div>
            {result.resolved > 0 && (
              <div className="import-badge success">{t('decks', 'import_review_resolved', { count: String(result.resolved) })}</div>
            )}
            {isCommanderDeckFormat(format) && finalDeck.commanderCard && (
              <div className="import-badge success">
                {t('decks', 'import_review_commander', { name: finalDeck.commanderCard.cardName })}
              </div>
            )}
          </div>

          {result.fellBack.length > 0 && (
            <div className="import-review-block">
              <div className="import-review-title">{t('decks', 'import_review_fallback', { count: String(result.fellBack.length) })}</div>
              <div className="import-review-names">{result.fellBack.join(', ')}</div>
            </div>
          )}

          {result.unresolved.length > 0 && (
            <div className="import-review-block warning" data-testid="import-unresolved">
              <div className="import-review-title">{t('decks', 'import_review_unresolved', { count: String(result.unresolved.length) })}</div>
              <ul className="import-unresolved-list">
                {result.unresolved.map((n) => (
                  <li key={n}>
                    <span>{n}</span>
                    <Button variant="link" size="sm" onClick={() => removeUnresolved(n)}>
                      {t('decks', 'import_review_remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`import-review-block${validation && validation.issues.length > 0 ? ' warning' : ''}`}>
            {validation && validation.issues.length === 0 && result.metaByName.size > 0 ? (
              <div className="import-review-title">
                <Icon name="check" size={13} /> {t('decks', 'import_review_legal_ok', { format: finalDeck.format })}
              </div>
            ) : validation && validation.issues.length > 0 ? (
              <>
                <div className="import-review-title">{t('decks', 'import_review_issues', { format: finalDeck.format })}</div>
                <ul className="import-unresolved-list">
                  {validation.issues.slice(0, 12).map((iss, k) => (
                    <li key={k}><span>{iss.message}</span></li>
                  ))}
                </ul>
                <span className="import-hint-text">{t('decks', 'import_review_issues_hint')}</span>
              </>
            ) : null}
          </div>
          {error && <div className="deck-import-error">{error}</div>}
        </div>
      )}

      <footer className="deck-import-footer">
        {step === 'source' ? (
          <>
            <Button variant="subtle" type="button" onClick={onClose}>
              {t('common', 'cancel')}
            </Button>
            <Button variant="subtle" size="sm" data-testid="import-submit-btn"
              title={t('decks', 'import_quick_hint')}
              disabled={busy || !text.trim()}
              onClick={() => void handleSubmit()}>
              {t('decks', 'import_quick')}
            </Button>
            <Button variant="primary" size="sm" data-testid="import-next-btn"
              disabled={busy || !text.trim()}
              onClick={() => void handleNext()}>
              {busy ? t('common', 'loading') : t('decks', 'import_next')}
            </Button>
          </>
        ) : step === 'setup' ? (
          <>
            <Button variant="subtle" type="button" onClick={goBack} disabled={busy}>
              {t('decks', 'import_back')}
            </Button>
            <Button variant="primary" size="sm" data-testid="import-resolve-btn"
              disabled={busy || (strategy === 'set' && !setCode.trim())}
              onClick={() => void handleResolve()}>
              {busy ? t('common', 'loading') : t('decks', 'import_review_btn')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="subtle" type="button" onClick={goBack} disabled={busy}>
              {t('decks', 'import_back')}
            </Button>
            <Button variant="primary" size="sm" data-testid="import-create-btn"
              disabled={busy || !finalDeck || finalDeck.cards.length === 0}
              onClick={() => void handleCreate()}>
              <Icon name="download" size={12} /> {t('decks', 'import_create')}
            </Button>
          </>
        )}
      </footer>
    </DialogShell>
  )
}
