import { useEffect, useMemo, useState } from 'react'
import DialogShell from '../../ui/DialogShell'
import { useTranslation } from '../../i18n'
import { getExpansionsWithBoosters, type BoosterSetInfo } from '../../net/commands'
import { parseLimitedSetCodes } from './constants'
import './RandomPacksSelector.css'

/** Tipos de torneo que usan pool aleatorio de sobres (paridad con NewTournamentDialog). */
export function isRandomPacksType(tournamentType: unknown): boolean {
  const str = typeof tournamentType === 'string' ? tournamentType : (tournamentType as { name?: string })?.name ?? ''
  return /random|reshuffled|rich man/i.test(str)
}

export function maxRandomPacks(tournamentType: unknown, numPlayers: number): number {
  const str = typeof tournamentType === 'string' ? tournamentType : (tournamentType as { name?: string })?.name ?? ''
  if (/rich man/i.test(str)) return 36
  return 3 * (numPlayers + 1)
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface RandomPacksSelectorProps {
  tournamentType: string
  numPlayers: number
  initialRaw: string
  onApply: (codes: string[]) => void
  onClose: () => void
}

export default function RandomPacksSelector({ tournamentType, numPlayers, initialRaw, onApply, onClose }: RandomPacksSelectorProps) {
  const { t } = useTranslation()
  const [sets, setSets] = useState<BoosterSetInfo[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const reshuffled = /reshuffled/i.test(tournamentType)
  const maxPacks = maxRandomPacks(tournamentType, numPlayers)

  useEffect(() => {
    let live = true
    getExpansionsWithBoosters()
      .then((list) => {
        if (!live) return
        setSets(list)
        const codes = list.map((s) => s.code)
        const initial = new Set(parseLimitedSetCodes(initialRaw).filter((c) => codes.includes(c)))
        setSelected(initial.size > 0 ? initial : new Set(codes))
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ordered = useMemo(() => {
    if (!sets || !selected) return []
    return sets.map((s) => s.code).filter((c) => selected.has(c))
  }, [sets, selected])

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const apply = () => {
    if (ordered.length === 0) return
    onApply(reshuffled ? ordered : shuffled(ordered).slice(0, Math.min(maxPacks, ordered.length)))
  }

  return (
    <DialogShell
      labelledBy="random-packs-title"
      titleId="random-packs-title"
      testId="random-packs-selector"
      legacyBackdropClass="random-packs-backdrop"
      legacyPanelClass="random-packs-dialog"
      kickerIcon="package"
      kickerLabel={tournamentType}
      title={t('lobby', reshuffled ? 'random_packs_title_reshuffled' : 'random_packs_title_random')}
      onBackdropClick={onClose}
    >
      {!sets && !failed && <p>{t('lobby', 'random_packs_loading')}</p>}
      {(failed || (sets && sets.length === 0)) && <p>{t('lobby', 'random_packs_empty')}</p>}
      {sets && sets.length > 0 && (
        <>
          <p className="random-packs-hint">
            {t('lobby', reshuffled ? 'random_packs_hint_reshuffled' : 'random_packs_hint_random', {
              selected: ordered.length,
              total: sets.length,
              max: maxPacks,
            })}
          </p>
          <div className="random-packs-toolbar">
            <button type="button" onClick={() => setSelected(new Set(sets.map((s) => s.code)))}>
              {t('lobby', 'random_packs_select_all')}
            </button>
            <button type="button" onClick={() => setSelected(new Set())}>
              {t('lobby', 'random_packs_select_none')}
            </button>
          </div>
          <div className="random-packs-grid">
            {sets.map((s) => (
              <label key={s.code} title={s.name} className="random-packs-cell">
                <input
                  type="checkbox"
                  checked={selected?.has(s.code) ?? false}
                  onChange={() => toggle(s.code)}
                />
                {s.code}
              </label>
            ))}
          </div>
          <div className="random-packs-footer">
            <button type="button" onClick={onClose}>
              {t('lobby', 'random_packs_cancel')}
            </button>
            <button type="button" className="primary" onClick={apply} disabled={ordered.length === 0} data-testid="random-packs-apply">
              {t('lobby', 'random_packs_apply')}
            </button>
          </div>
        </>
      )}
    </DialogShell>
  )
}
