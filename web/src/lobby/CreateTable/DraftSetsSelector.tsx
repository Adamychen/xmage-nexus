import { useEffect, useMemo, useState } from 'react'
import { getExpansionsWithBoosters, type BoosterSetInfo } from '../../net/commands'
import { DEFAULT_BOOSTER_SETS, parseLimitedSetCodes, type BoosterSetItem } from './constants'
import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import './DraftSetsSelector.css'

interface DraftSetsSelectorProps {
  draftSetsRaw: string
  onChange: (value: string) => void
  numBoosters: number
}

const POPULAR_SET_CODES = ['FDN', 'DSK', 'BLB', 'MH3', 'OTJ', 'MKM', 'LCI', 'M21']

export default function DraftSetsSelector({
  draftSetsRaw,
  onChange,
  numBoosters,
}: DraftSetsSelectorProps) {
  const { t } = useTranslation()
  const [serverSets, setServerSets] = useState<BoosterSetInfo[] | null>(null)
  const [search, setSearch] = useState('')

  // Fetch all booster sets from the server
  useEffect(() => {
    let live = true
    if (typeof getExpansionsWithBoosters === 'function') {
      getExpansionsWithBoosters()
        .then((list) => {
          if (!live) return
          if (list && list.length > 0) {
            // Sort newest to oldest if releaseDate is present, then by code
            const sorted = [...list].sort((a, b) => (b.releaseDate || 0) - (a.releaseDate || 0))
            setServerSets(sorted)
          }
        })
        .catch(() => {
          // Fallback to DEFAULT_BOOSTER_SETS
        })
    }
    return () => {
      live = false
    }
  }, [])

  const availableSets: BoosterSetItem[] = useMemo(() => {
    if (serverSets && serverSets.length > 0) {
      return serverSets.map((s) => ({ code: s.code, name: s.name }))
    }
    return DEFAULT_BOOSTER_SETS
  }, [serverSets])

  const parsedCodes = useMemo(() => {
    return parseLimitedSetCodes(draftSetsRaw)
  }, [draftSetsRaw])

  // Determine current primary set (from the first valid code, or fallback to first available set)
  const primaryCode = useMemo(() => {
    return parsedCodes[0] || 'MH3'
  }, [parsedCodes])

  // Is current setup using different sets for different boosters?
  const isCustomMode = useMemo(() => {
    if (parsedCodes.length <= 1) return false
    const first = parsedCodes[0]
    return parsedCodes.slice(0, numBoosters).some((c) => c !== first)
  }, [parsedCodes, numBoosters])

  const [mode, setMode] = useState<'same' | 'custom'>(() => (isCustomMode ? 'custom' : 'same'))

  // Filter sets by search term
  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableSets
    return availableSets.filter(
      (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    )
  }, [availableSets, search])

  // Set all boosters to a single set code
  const handleSelectSame = (code: string) => {
    const arr = Array(numBoosters).fill(code)
    onChange(arr.join(', '))
  }

  // Set a specific booster pack's set code
  const handleSelectPack = (index: number, code: string) => {
    const current = [...parsedCodes]
    while (current.length < numBoosters) {
      current.push(current[0] || code)
    }
    current[index] = code
    onChange(current.slice(0, numBoosters).join(', '))
  }

  // Popular sets filtered to available
  const popularSets = useMemo(() => {
    return POPULAR_SET_CODES.map((code) => {
      const found = availableSets.find((s) => s.code.toUpperCase() === code)
      return found || { code, name: code }
    })
  }, [availableSets])

  return (
    <div className="draft-sets-container">
      <div className="draft-sets-top-bar">
        <span className="draft-sets-title">
          <Icon name="layers" size={14} /> {t('lobby', 'create_field_draft_sets')}
        </span>
        <div className="draft-sets-mode-buttons">
          <button
            type="button"
            className={`draft-sets-mode-btn ${mode === 'same' ? 'active' : ''}`}
            onClick={() => {
              setMode('same')
              handleSelectSame(primaryCode)
            }}
          >
            {t('lobby', 'draft_sets_mode_same')}
          </button>
          <button
            type="button"
            className={`draft-sets-mode-btn ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            {t('lobby', 'draft_sets_mode_custom')}
          </button>
        </div>
      </div>

      {/* Popular Sets Quick Chips */}
      <div className="draft-sets-chips">
        <span className="draft-sets-chips-label">{t('lobby', 'draft_sets_popular')}:</span>
        {popularSets.map((s) => {
          const isActive = primaryCode.toUpperCase() === s.code.toUpperCase()
          return (
            <button
              key={s.code}
              type="button"
              className={`draft-set-chip ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectSame(s.code)}
              title={`${s.name} (${s.code})`}
            >
              {s.code}
            </button>
          )
        })}
      </div>

      {/* Same Set Picker */}
      {mode === 'same' ? (
        <div className="draft-sets-picker-row">
          <div className="draft-sets-search-box">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('lobby', 'draft_sets_search_placeholder')}
            />
          </div>
          <div className="draft-sets-select-box">
            <select
              value={primaryCode}
              onChange={(e) => handleSelectSame(e.target.value)}
            >
              {filteredSets.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        /* Custom Per-Pack Picker */
        <div className="draft-sets-boosters-list">
          {Array.from({ length: numBoosters }).map((_, i) => {
            const packCode = parsedCodes[i] || primaryCode
            return (
              <div key={i} className="draft-sets-booster-item">
                <span className="draft-sets-booster-label">
                  <Icon name="layers" size={11} /> {t('lobby', 'draft_sets_booster_n', { n: i + 1 })}
                </span>
                <select
                  className="draft-sets-booster-select"
                  value={packCode}
                  onChange={(e) => handleSelectPack(i, e.target.value)}
                >
                  {availableSets.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}

      {/* Code input field */}
      <div className="draft-sets-manual-wrap">
        <label className="draft-sets-manual-label-row">
          <span className="draft-sets-manual-label">
            <Icon name="tag" size={12} /> {t('lobby', 'draft_sets_manual_toggle')}:
          </span>
          <input
            value={draftSetsRaw}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('lobby', 'placeholder_draft_sets')}
            className="draft-sets-manual-input-el"
          />
        </label>
      </div>
    </div>
  )
}
