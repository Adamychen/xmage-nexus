import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from '../../i18n'
import ChipButton from '../../ui/ChipButton'
import Chip from '../../ui/Chip'
import Icon from '../../ui/Icon'
import { deckRef, type Deck } from '../decks'
import { HUMAN_SEAT, isHumanSeatType, normalizeSeatType, seatTypeLabel } from './constants'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'
import Button from '../../ui/Button'
import StarterDecksOffer from '../../decks/StarterDecksOffer'
import DeckCarousel from './DeckCarousel'
import { seatNodePosition } from './seatLayout'
import { radioNavIndex } from './radioNav'
import './SeatsTab.css'

type TableSeat = { key: string; label: string; sub: string; kind: 'you' | 'human' | 'bot'; warn: boolean }

export default function SeatsTab({ form, onEditDeck }: { form: CreateTableForm; onEditDeck?: (deckId: string) => void }) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<number | null>(null)
  const offset = form.humanSeat ? 1 : 0
  const humansWaiting = form.seatConfigs.filter((s) => isHumanSeatType(s.type)).length
  const bots = form.seatConfigs.length - humansWaiting

  const findSeatDeck = (ref: string): Deck | undefined =>
    form.availableDecks.find((d) => deckRef(d) === ref) ?? form.availableDecks.find((d) => d.name === ref)

  const seats: TableSeat[] = [
    ...(form.humanSeat
      ? [{ key: 'you', label: t('lobby', 'seat_node_you'), sub: form.myDeck?.name ?? '', kind: 'you' as const, warn: !form.myDeck }]
      : []),
    ...form.seatConfigs.map((cfg, idx): TableSeat => {
      const human = isHumanSeatType(cfg.type)
      const deck = findSeatDeck(cfg.deckName)
      const deckEmpty = !deck || deck.cards.reduce((sum, c) => sum + c.amount, 0) === 0
      return {
        key: `seat-${idx}`,
        label: t('lobby', 'create_seat_number', { num: idx + 1 + offset }),
        sub: human ? t('lobby', 'create_seat_human_short') : `${seatTypeLabel(cfg.type, t)} · ${cfg.skill ?? 2}`,
        kind: human ? 'human' : 'bot',
        warn: !human && deckEmpty,
      }
    }),
  ]
  const active = seats.length === 0 ? -1 : Math.min(picked ?? 0, seats.length - 1)
  const activeSeat = seats[active]

  const onNodeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'))
    const next = radioNavIndex(e.key, nodes.indexOf(e.target as HTMLElement), nodes.length)
    if (next === null) return
    e.preventDefault()
    setPicked(next)
    nodes[next].focus()
  }

  return (
    <div className="create-tab-content">
      <div className="seats-stage">
        <div className="seats-stage-head">
          <span className="seat-title"><Icon name="users" size={13} /> {t('lobby', 'create_seats_title')}</span>
          <span className="seats-stage-meta">
            {t('lobby','create_seats_waiting_count',{count:humansWaiting})} · {t('lobby','create_seats_bot_count',{count:bots})} · {t('lobby','create_seats_total_count',{total:form.numPlayers})}
          </span>
          <ChipButton pill active={form.humanSeat} onClick={() => form.setHumanSeat(!form.humanSeat)}>
            {form.humanSeat ? (<><Icon name="check" size={12} /> {t('common','player')}</>) : (<><Icon name="eye" size={12} /> {t('lobby','spectators')}</>)}
          </ChipButton>
          {form.numPlayers !== (form.selectedGameTypeInfo?.maxPlayers ?? form.numPlayers) && form.selectedGameTypeInfo && (
            <Chip tone="warn" size="xs" pill>Config: {form.numPlayers} / {form.selectedGameTypeInfo.maxPlayers} max</Chip>
          )}
        </div>

        {form.numPlayers > 2 && (
          <div className="wizard-hint-box wizard-hint-box--spaced">
            {form.isMultiplayerGame ? t('lobby','create_seats_hint_multi') : t('lobby','create_seats_hint_duel')}
          </div>
        )}

        <div className="seats-stage-body">
          {seats.length === 0 ? (
            <div className="wizard-hint-box">{t('lobby','create_seats_no_extra')}</div>
          ) : (
            <div className="seat-table" role="radiogroup" aria-label={t('lobby', 'create_seats_title')} onKeyDown={onNodeKeyDown}>
              <div className="seat-table-felt" aria-hidden="true" />
              {seats.map((seat, i) => {
                const { x, y } = seatNodePosition(i, seats.length)
                const isActive = i === active
                return (
                  <div
                    key={seat.key}
                    role="radio"
                    aria-checked={isActive}
                    aria-label={seat.label}
                    tabIndex={isActive ? 0 : -1}
                    data-testid={`seat-node-${i}`}
                    className={`seat-node seat-node--${seat.kind} ${isActive ? 'active' : ''} ${seat.warn ? 'warn' : ''}`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => setPicked(i)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      setPicked(i)
                    }}
                  >
                    <span className="seat-node-avatar"><Icon name={seat.kind === 'bot' ? 'bot' : 'user'} size={15} /></span>
                    <span className="seat-node-label">{seat.label}</span>
                    <span className="seat-node-sub">{seat.sub}</span>
                  </div>
                )
              })}
            </div>
          )}

          {activeSeat?.kind === 'you' && (
            <YouEditor form={form} onEditDeck={onEditDeck} />
          )}
          {activeSeat && activeSeat.kind !== 'you' && (
            <SeatEditor form={form} idx={active - offset} seatNumber={active + 1} findSeatDeck={findSeatDeck} />
          )}
        </div>

        <div className="create-seats-shortcuts">
          <Field group label={t('lobby','create_seats_apply_all_shortcut')}>
            <div className="chip-row">
              <ChipButton
                pill
                active={form.playerTypesSel.includes(HUMAN_SEAT)}
                onClick={() => {
                  form.toggleAi(HUMAN_SEAT)
                  form.applySeatTypeToAll(HUMAN_SEAT)
                }}
              >
                <Icon name="user" size={12} /> {t('lobby','create_seat_human_short')}
              </ChipButton>
              {form.playerTypes.map((pt) => (
                <ChipButton
                  pill
                  key={pt}
                  active={form.playerTypesSel.includes(pt)}
                  onClick={() => {
                    form.toggleAi(pt)
                    form.applySeatTypeToAll(pt)
                  }}
                >
                  {seatTypeLabel(pt, t)}
                </ChipButton>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </div>
  )
}

function YouEditor({ form, onEditDeck }: { form: CreateTableForm; onEditDeck?: (deckId: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="seat-editor">
      <div className="seat-editor-head">
        <span className="seat-title"><Icon name="user" size={13} /> {t('common','player')}</span>
      </div>
      <Field group label={t('lobby','active_deck')}>
        <DeckCarousel
          decks={form.availableDecks}
          selected={form.myDeck ? deckRef(form.myDeck) : ''}
          onSelect={form.selectMyDeck}
          label={t('lobby', 'active_deck')}
        />
      </Field>
      <div className="seat-editor-row">
        {!form.myDeck && <Chip tone="warn" size="xs" pill icon="alert">{t('lobby','create_err_no_deck')}</Chip>}
        <Button
          variant="ghost"
          size="sm"
          icon="package"
          data-testid="create-edit-deck"
          disabled={!form.myDeck || !onEditDeck}
          title={t('lobby','create_edit_deck')}
          onClick={() => { if (form.myDeck) onEditDeck?.(deckRef(form.myDeck)) }}
        >
          {t('lobby','create_edit_deck')}
        </Button>
      </div>
      {form.decksLoaded && form.availableDecks.length === 0 && (
        <StarterDecksOffer onAdded={form.adoptStarterDecks} />
      )}
      <Field label={t('lobby','create_field_my_skill')}>
        <select data-testid="my-skill" value={form.mySkill} onChange={(e) => form.setMySkill(Number(e.target.value))}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
    </div>
  )
}

function SeatEditor({ form, idx, seatNumber, findSeatDeck }: { form: CreateTableForm; idx: number; seatNumber: number; findSeatDeck: (ref: string) => Deck | undefined }) {
  const { t } = useTranslation()
  const cfg = form.seatConfigs[idx]
  if (!cfg) return null
  const human = isHumanSeatType(cfg.type)
  const deck = findSeatDeck(cfg.deckName)
  const total = deck ? deck.cards.reduce((sum, c) => sum + c.amount, 0) : 0
  const deckEmpty = !deck || total === 0
  const typeOptions = [HUMAN_SEAT, ...form.playerTypes]
  const typeLabel = (pt: string) => (isHumanSeatType(pt) ? t('lobby', 'create_seat_human_short') : seatTypeLabel(pt, t))

  const onTypeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const chips = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'))
    const next = radioNavIndex(e.key, chips.indexOf(e.target as HTMLElement), chips.length)
    if (next === null) return
    e.preventDefault()
    form.setSeatType(idx, typeOptions[next])
    chips[next].focus()
  }

  return (
    <div className="seat-editor" data-testid={`seat-editor-${idx}`}>
      <div className="seat-editor-head">
        <span className="seat-title">
          <Icon name={human ? 'user' : 'bot'} size={13} /> {t('lobby', 'create_seat_number', { num: seatNumber })}
        </span>
      </div>
      <Field group label={t('lobby', 'create_seat_type_label')}>
        <div className="seat-type-options" role="radiogroup" aria-label={t('lobby', 'create_seat_type_label')} data-testid={`seat-type-${idx}`} onKeyDown={onTypeKeyDown}>
          {typeOptions.map((pt) => {
            const selected = isHumanSeatType(pt) ? human : !human && normalizeSeatType(pt) === normalizeSeatType(cfg.type)
            return (
              <ChipButton
                key={pt}
                pill
                role="radio"
                aria-checked={selected}
                active={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => form.setSeatType(idx, pt)}
              >
                {typeLabel(pt)}
              </ChipButton>
            )
          })}
        </div>
      </Field>
      {human ? (
        <span className="wizard-hint-box"><Icon name="user" size={11} /> {t('lobby','create_seat_human_waiting')}</span>
      ) : (
        <>
          <Field label={t('lobby','create_field_seat_skill')}>
            <select data-testid={`seat-skill-${idx}`} value={cfg.skill ?? 2} onChange={(e) => form.setSeatSkill(idx, Number(e.target.value))} className="create-seat-select create-seat-select--skill">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field
            group
            label={t('lobby','create_seat_deck_label',{num: seatNumber})}
            hint={deckEmpty ? t('lobby','create_warn_seat_deck_empty') : `${total} ${t('decks','total_cards')}`}
            hintTone={deckEmpty ? 'warn' : 'muted'}
          >
            <DeckCarousel
              decks={form.availableDecks}
              selected={cfg.deckName}
              onSelect={(ref) => form.setSeatDeck(idx, ref)}
              label={t('lobby','create_seat_deck_label',{num: seatNumber})}
              disabled={form.availableDecks.length === 0}
            />
          </Field>
        </>
      )}
    </div>
  )
}
