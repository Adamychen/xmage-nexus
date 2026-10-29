import { useEffect, useId, useMemo, useState } from 'react'
import Button from '../../ui/Button'
import ChipButton from '../../ui/ChipButton'
import Field from '../../ui/Field'
import Tabs from '../../ui/Tabs'
import { useTranslation } from '../../i18n'
import { getExpansionsWithBoosters, type BoosterSetInfo } from '../../net/commands'
import { DEFAULT_BOOSTER_SETS, type BoosterSetItem } from './constants'
import { fillSlots, slotCodes, summariseSetCodes, withSlot } from './tourneyFormat'
import type { CreateTableForm } from './types'

const POPULAR_SET_CODES = ['FDN', 'DSK', 'BLB', 'MH3', 'OTJ', 'MKM', 'LCI', 'M21']

/** The booster set catalogue: the server's list, newest first, else the bundled one. */
export function useBoosterSetCatalogue(): BoosterSetItem[] {
  const [serverSets, setServerSets] = useState<BoosterSetInfo[] | null>(null)
  useEffect(() => {
    let live = true
    if (typeof getExpansionsWithBoosters === 'function') {
      getExpansionsWithBoosters()
        .then((list) => {
          if (!live || !list || list.length === 0) return
          setServerSets([...list].sort((a, b) => (b.releaseDate || 0) - (a.releaseDate || 0)))
        })
        .catch(() => {})
    }
    return () => {
      live = false
    }
  }, [])
  return useMemo(
    () => (serverSets && serverSets.length > 0 ? serverSets.map((s) => ({ code: s.code, name: s.name })) : DEFAULT_BOOSTER_SETS),
    [serverSets],
  )
}

/** One set per booster: a popular set fills every slot, each slot changes on its own, codes are typed behind a toggle. */
export default function TourneySetSlots({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const catalogue = useBoosterSetCatalogue()
  const [typing, setTyping] = useState(false)
  const slotsLabelId = useId()
  const boosters = form.draftBoosters
  const slots = slotCodes(form.draftSetsRaw, boosters)
  const chosen = slots.filter(Boolean)
  const options = [
    ...catalogue,
    ...chosen.filter((code, i) => chosen.indexOf(code) === i && !catalogue.some((s) => s.code === code)).map((code) => ({ code, name: code })),
  ]
  const popular = POPULAR_SET_CODES.map((code) => catalogue.find((s) => s.code.toUpperCase() === code) ?? { code, name: code })
  const isAll = (code: string) => slots.every((slot) => slot === code)

  return (
    <>
      <Field group label={t('lobby', 'draft_sets_popular')}>
        <div className="chip-row">
          {popular.map((s) => (
            <ChipButton
              key={s.code}
              activeTone="gold"
              active={isAll(s.code)}
              title={`${s.name} (${s.code})`}
              onClick={() => form.setDraftSetsRaw(fillSlots(boosters, s.code))}
            >
              {s.code}
            </ChipButton>
          ))}
        </div>
      </Field>

      <div className="trn-sets-head">
        <span className="ui-field-label" id={slotsLabelId}>{t('lobby', 'create_field_draft_sets')}</span>
        <div className="trn-booster-count">
          <span className="trn-booster-count-label">{t('lobby', 'create_field_boosters')}</span>
          <Tabs
            variant="segmented"
            size="sm"
            className="trn-booster-control"
            label={t('lobby', 'create_field_boosters')}
            value={String(boosters)}
            onChange={(id) => form.setDraftBoosters(Number(id) as 3 | 6)}
            items={[{ id: '3', label: '3' }, { id: '6', label: '6' }]}
          />
        </div>
      </div>
      <div role="group" aria-labelledby={slotsLabelId} className="ui-field">
        <div className="trn-slots">
          {slots.map((code, index) => (
            <Field key={index} label={t('lobby', 'draft_sets_booster_n', { n: index + 1 })}>
              <select
                value={code}
                onChange={(e) => form.setDraftSetsRaw(withSlot(form.draftSetsRaw, boosters, index, e.target.value))}
              >
                {code === '' && <option value="">—</option>}
                {options.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        {chosen.length > 0 && <span className="ui-field-hint">{t('lobby', 'trn_sets_summary', { sets: summariseSetCodes(chosen) })}</span>}
      </div>

      <div>
        <Button variant="link" size="sm" aria-expanded={typing} onClick={() => setTyping((v) => !v)}>
          {t('lobby', 'trn_sets_type_codes')}
        </Button>
      </div>
      {typing && (
        <Field label={t('lobby', 'draft_sets_manual_toggle')}>
          <input
            value={form.draftSetsRaw}
            onChange={(e) => form.setDraftSetsRaw(e.target.value)}
            placeholder={t('lobby', 'placeholder_draft_sets')}
          />
        </Field>
      )}
    </>
  )
}
