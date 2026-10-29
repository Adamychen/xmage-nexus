import type { KeyboardEvent } from 'react'
import { plural, useTranslation } from '../../i18n'
import Button from '../../ui/Button'
import Chip from '../../ui/Chip'
import ChipButton from '../../ui/ChipButton'
import Field from '../../ui/Field'
import Icon from '../../ui/Icon'
import { Switch } from '../../ui/Toggle'
import { useStore } from '../../state/store'
import { deckRef, type Deck } from '../decks'
import StarterDecksOffer from '../../decks/StarterDecksOffer'
import { normalizeSeatType, HUMAN_SEAT, isHumanSeatType, seatTypeLabel, type SeatConfig } from './constants'
import DeckCarousel from './DeckCarousel'
import DevTab from './DevTab'
import { radioNavIndex } from './radioNav'
import type { CreateTableForm } from './types'

const DEFAULT_BOT_TYPE = 'COMPUTER_MAD'
const BOTS_REASON_ID = 'trn-seats-bots-reason'

/** The tournament's Seats step: the seats as a list, the deck pickers of a constructed tournament, and the developer options. */
export default function TourneySeatsStep({ form, onEditDeck }: { form: CreateTableForm; onEditDeck?: (deckId: string) => void }) {
  const { t } = useTranslation()
  const username = useStore((s) => s.conn?.username ?? '')
  const limited = form.isDraftLimited
  const botType = form.playerTypes.find((pt) => normalizeSeatType(pt) === DEFAULT_BOT_TYPE) ?? DEFAULT_BOT_TYPE
  const bots = form.seatConfigs.filter((s) => !isHumanSeatType(s.type)).length
  const open = form.seatConfigs.length - bots

  const counter = [
    form.humanSeat ? t('lobby', 'seat_node_you') : null,
    t('lobby', 'trn_d_counter_open', { count: open }),
    plural('lobby', 'trn_d_counter_bots', bots, { count: bots }),
  ].filter(Boolean).join(' · ')

  const findSeatDeck = (ref: string): Deck | undefined =>
    form.availableDecks.find((d) => deckRef(d) === ref) ?? form.availableDecks.find((d) => d.name === ref)

  return (
    <div className="create-tab-content trn-seats">
      <div className="trn-seats-head">
        <div className="trn-seats-summary">
          <span className="trn-seats-total">{t('lobby', 'staging_seats_count', { count: form.numPlayers })}</span>
          <span className="trn-seats-counter" data-testid="trn-seats-counter">{counter}</span>
        </div>
        <div className="trn-seats-play">
          <span className="trn-seats-play-label" id="trn-seats-play-label">{t('lobby', 'trn_d_switch_play')}</span>
          <Switch
            checked={form.humanSeat}
            onChange={form.setHumanSeat}
            aria-labelledby="trn-seats-play-label"
            data-testid="trn-host-switch"
          />
        </div>
      </div>

      <div className="trn-seats-shortcuts">
        <Button size="sm" variant="secondary" onClick={() => form.applySeatTypeToAll(HUMAN_SEAT)}>
          {t('lobby', 'trn_d_all_open')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon="bot"
          disabled={limited}
          aria-describedby={limited ? BOTS_REASON_ID : undefined}
          onClick={() => form.applySeatTypeToAll(botType)}
        >
          {t('lobby', 'trn_d_fill_bots')}
        </Button>
        {limited && (
          <p className="trn-seats-reason" id={BOTS_REASON_ID}>
            <Icon name="alert" size={13} /> {t('lobby', 'trn_d_bots_limited')}
          </p>
        )}
      </div>

      <ol className="trn-seat-list" aria-label={t('lobby', 'create_seats_title')}>
        {form.humanSeat && (
          <li className="trn-seat trn-seat--you" data-testid="trn-seat-0">
            <div className="trn-seat-head">
              <span className="trn-seat-number">{t('lobby', 'create_seat_number', { num: 1 })}</span>
              <span className="trn-seat-icon"><Icon name="user" size={15} /></span>
              <span className="trn-seat-text">
                <span className="trn-seat-name">{t('lobby', 'seat_node_you')} · {username}</span>
                <span className="trn-seat-sub">{t('lobby', 'trn_d_host')}</span>
              </span>
            </div>
          </li>
        )}
        {form.seatConfigs.map((cfg, idx) => {
          const seatNumber = idx + (form.humanSeat ? 2 : 1)
          return (
            <SeatRowItem
              key={idx}
              seatNumber={seatNumber}
              seatIdx={idx}
              cfg={cfg}
              limited={limited}
              form={form}
              botType={botType}
              deck={findSeatDeck(cfg.deckName)}
            />
          )
        })}
      </ol>

      {limited ? (
        <div className="wizard-hint-box wizard-hint-box--info trn-seats-note">
          <Icon name="layers" size={13} /> {t('lobby', 'trn_d_limited_no_deck')}
        </div>
      ) : (
        <section className="trn-seats-decks">
          {form.humanSeat && (
            <>
              <Field group label={t('lobby', 'active_deck')}>
                <DeckCarousel
                  decks={form.availableDecks}
                  selected={form.myDeck ? deckRef(form.myDeck) : ''}
                  onSelect={form.selectMyDeck}
                  label={t('lobby', 'active_deck')}
                />
              </Field>
              <div className="seat-editor-row">
                {!form.myDeck && <Chip tone="warn" size="xs" pill icon="alert">{t('lobby', 'create_err_no_deck')}</Chip>}
                <Button
                  variant="ghost"
                  size="sm"
                  icon="package"
                  data-testid="create-edit-deck"
                  disabled={!form.myDeck || !onEditDeck}
                  title={t('lobby', 'create_edit_deck')}
                  onClick={() => { if (form.myDeck) onEditDeck?.(deckRef(form.myDeck)) }}
                >
                  {t('lobby', 'create_edit_deck')}
                </Button>
              </div>
              {form.decksLoaded && form.availableDecks.length === 0 && (
                <StarterDecksOffer onAdded={form.adoptStarterDecks} />
              )}
            </>
          )}
          <Field label={t('lobby', 'trn_d_bots_deck')}>
            <select
              data-testid="trn-bots-deck"
              value={form.simDeck ? deckRef(form.simDeck) : ''}
              disabled={form.availableDecks.length === 0}
              onChange={(e) => form.selectGlobalSimDeck(e.target.value)}
            >
              {!form.simDeck && <option value="">{t('lobby', 'create_warn_seat_deck_empty')}</option>}
              {form.availableDecks.map((d) => (
                <option key={deckRef(d)} value={deckRef(d)}>{d.name}</option>
              ))}
            </select>
          </Field>
        </section>
      )}


      {import.meta.env.DEV && (
        <details className="trn-seats-dev">
          <summary>{t('lobby', 'trn_d_dev_options')}</summary>
          <DevTab form={form} />
        </details>
      )}
    </div>
  )
}

function SeatRowItem({ seatNumber, seatIdx, cfg, limited, form, botType, deck }: {
  seatNumber: number
  seatIdx: number
  cfg: SeatConfig
  limited: boolean
  form: CreateTableForm
  botType: string
  deck: Deck | undefined
}) {
  const { t } = useTranslation()
  const human = isHumanSeatType(cfg.type)
  const deckCards = deck ? deck.cards.reduce((sum, c) => sum + c.amount, 0) : 0
  const deckEmpty = !deck || deckCards === 0

  const onKindKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    const next = radioNavIndex(e.key, radios.indexOf(e.target as HTMLButtonElement), radios.length)
    if (next === null || (next === 1 && limited)) return
    e.preventDefault()
    form.setSeatType(seatIdx, next === 0 ? HUMAN_SEAT : botType)
    radios[next].focus()
  }

  return (
    <li className={`trn-seat ${human ? 'trn-seat--human' : 'trn-seat--bot'}`} data-testid={`trn-seat-${seatNumber - 1}`}>
      <div className="trn-seat-head">
        <span className="trn-seat-number">{t('lobby', 'create_seat_number', { num: seatNumber })}</span>
        <span className="trn-seat-icon"><Icon name={human ? 'user' : 'bot'} size={15} /></span>
        <span className="trn-seat-text">
          <span className="trn-seat-name">{human ? t('lobby', 'trn_d_open_seat') : t('lobby', 'trn_d_bot_name')}</span>
          {!human && <span className="trn-seat-sub">{seatTypeLabel(cfg.type, t)} · {cfg.skill ?? 2}</span>}
        </span>
        <div
          className="trn-seat-kind"
          role="radiogroup"
          aria-label={t('lobby', 'create_seat_type_label')}
          aria-describedby={limited ? BOTS_REASON_ID : undefined}
          onKeyDown={onKindKeyDown}
        >
          <ChipButton
            pill
            role="radio"
            aria-checked={human}
            aria-pressed={undefined}
            active={human}
            tabIndex={human ? 0 : -1}
            className="trn-seat-kind-option"
            onClick={() => form.setSeatType(seatIdx, HUMAN_SEAT)}
          >
            {t('lobby', 'create_seat_human_short')}
          </ChipButton>
          <ChipButton
            pill
            role="radio"
            aria-checked={!human}
            aria-pressed={undefined}
            active={!human}
            tabIndex={human ? -1 : 0}
            disabled={limited}
            className="trn-seat-kind-option"
            onClick={() => form.setSeatType(seatIdx, botType)}
          >
            {t('lobby', 'trn_d_bot_name')}
          </ChipButton>
        </div>
      </div>
      {!human && (
        <div className="trn-seat-controls">
          <Field label={t('lobby', 'trn_d_bot_type')}>
            <select
              data-testid={`seat-type-${seatIdx}`}
              value={normalizeSeatType(cfg.type)}
              onChange={(e) => form.setSeatType(seatIdx, e.target.value)}
            >
              {form.playerTypes.map((pt) => (
                <option key={pt} value={normalizeSeatType(pt)}>{seatTypeLabel(pt, t)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('lobby', 'create_field_seat_skill')}>
            <select
              data-testid={`seat-skill-${seatIdx}`}
              value={cfg.skill ?? 2}
              onChange={(e) => form.setSeatSkill(seatIdx, Number(e.target.value))}
              className="create-seat-select create-seat-select--skill"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
          {!limited && (
            <Field
              label={t('lobby', 'create_seat_deck_label', { num: seatNumber })}
              hint={deckEmpty ? t('lobby', 'create_warn_seat_deck_empty') : `${deckCards} ${t('decks', 'total_cards')}`}
              hintTone={deckEmpty ? 'warn' : 'muted'}
            >
              <select
                data-testid={`seat-deck-${seatIdx}`}
                value={deck ? deckRef(deck) : ''}
                disabled={form.availableDecks.length === 0}
                onChange={(e) => form.setSeatDeck(seatIdx, e.target.value)}
              >
                {!deck && <option value="">{t('lobby', 'create_warn_seat_deck_empty')}</option>}
                {form.availableDecks.map((d) => (
                  <option key={deckRef(d)} value={deckRef(d)}>{d.name}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}
    </li>
  )
}
