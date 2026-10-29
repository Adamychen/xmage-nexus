import { useState } from 'react'
import Button from '../../ui/Button'
import ChipButton from '../../ui/ChipButton'
import Field from '../../ui/Field'
import { useTranslation } from '../../i18n'
import { clampSeats, seatQuickPicks } from './tableKind'
import type { CreateTableForm } from './types'

/** The tournament's seat count: one-tap picks the type allows, and a stepper for any count in its limits. */
export default function TourneySeatCount({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const { minPlayers, maxPlayers } = form.seatLimits
  const count = form.numPlayers
  const [typed, setTyped] = useState<string | null>(null)
  const label = t('lobby', 'trn_d_seats_input')

  const setCount = (next: number) => form.setNumPlayers(clampSeats(next, form.seatLimits))

  return (
    <Field group label={t('lobby', 'create_tourney_players')} hint={t('lobby', 'trn_d_seats_range', { min: minPlayers, max: maxPlayers })}>
      <div className="trn-seat-count">
        <div className="trn-seat-stepper" role="group" aria-label={label}>
          <Button
            className="trn-seat-step"
            icon="minus"
            aria-label={t('lobby', 'trn_d_seats_fewer')}
            disabled={count <= minPlayers}
            onClick={() => setCount(count - 1)}
          />
          <input
            type="number"
            className="trn-seat-input"
            inputMode="numeric"
            min={minPlayers}
            max={maxPlayers}
            step={1}
            aria-label={label}
            value={typed ?? count}
            onChange={(e) => {
              const raw = e.target.value
              setTyped(raw)
              const next = Number(raw)
              if (raw !== '' && Number.isInteger(next) && next >= minPlayers && next <= maxPlayers) form.setNumPlayers(next)
            }}
            onBlur={() => setTyped(null)}
          />
          <Button
            className="trn-seat-step"
            icon="plus"
            aria-label={t('lobby', 'trn_d_seats_more')}
            disabled={count >= maxPlayers}
            onClick={() => setCount(count + 1)}
          />
        </div>
        <div className="chip-row">
          {seatQuickPicks(form.seatLimits).map((n) => (
            <ChipButton key={n} pill active={count === n} onClick={() => setCount(n)}>
              {t('lobby', 'staging_seats_count', { count: n })}
            </ChipButton>
          ))}
        </div>
      </div>
    </Field>
  )
}
