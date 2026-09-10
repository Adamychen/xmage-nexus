import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import { HUMAN_SEAT, SIM_SEAT, isHumanSeatType, isSimSeatType, seatTypeLabel } from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function SeatsTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const humansWaiting = form.seatConfigs.filter((s) => isHumanSeatType(s.type)).length
  const bots = form.seatConfigs.length - humansWaiting
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3><Icon name="bot" size={15} /> {t('lobby','create_tab_multi')}</h3>
        <p>{t('lobby','create_step_desc_seats')}</p>
      </div>
      <div className="create-seats-section">
        <div className="create-seat-box human-seat-box">
          <div className="seat-box-header">
            <span className="seat-title"><Icon name="user" size={13} /> {t('common','player')}</span>
            <button
              type="button"
              className={`chip ${form.humanSeat ? 'on' : ''}`}
              onClick={() => form.setHumanSeat(!form.humanSeat)}
            >
              {form.humanSeat ? (<><Icon name="check" size={12} /> {t('common','player')}</>) : (<><Icon name="eye" size={12} /> {t('lobby','spectators')}</>)}
            </button>
          </div>
          {form.humanSeat && (
            <>
              {form.isDraftLimited ? (
                <div className="wizard-hint-box" style={{ borderColor: 'rgba(92,160,255,0.4)', color: '#90caf9', marginBottom: 8 }}>
                  <Icon name="layers" size={13} /> {t('lobby', 'create_tourney_draft_timing_desc')}
                </div>
              ) : (
                <>
                  <label>
                    {t('lobby','active_deck')}
                    <select
                      value={form.myDeck?.name ?? ''}
                      onChange={(e) => form.selectMyDeck(e.target.value)}
                      disabled={form.availableDecks.length === 0}
                    >
                      {form.availableDecks.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name} ({d.cards.reduce((sum, c) => sum + c.amount, 0)} {t('decks','total_cards')})
                        </option>
                      ))}
                    </select>
                  </label>
                  {!form.myDeck && (
                    <span className="wizard-warn-badge"><Icon name="alert" size={11} /> {t('lobby','create_err_no_deck')}</span>
                  )}
                </>
              )}
              <label>
                {t('lobby','create_field_my_skill')}
                <select data-testid="my-skill" value={form.mySkill} onChange={(e) => form.setMySkill(Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {!form.humanSeat && <span className="wizard-hint-box">{t('lobby','create_enter_as_spectator')}</span>}
        </div>

        <div className="create-seat-box ai-seat-box">
          <div className="seat-box-header">
            <span className="seat-title"><Icon name="bot" size={13} /> {t('lobby','create_seats_title')} — {form.seatConfigs.length} ({t('lobby','create_seats_waiting_count',{count:humansWaiting})} · {t('lobby','create_seats_bot_count',{count:bots})}, {t('lobby','create_seats_total_count',{total:form.numPlayers})})</span>
            {form.numPlayers !== (form.selectedGameTypeInfo?.maxPlayers ?? form.numPlayers) && form.selectedGameTypeInfo && (
              <span className="wizard-warn-badge">Config: {form.numPlayers} / {form.selectedGameTypeInfo.maxPlayers} max</span>
            )}
          </div>
          {form.numPlayers > 2 && (
            <div className="wizard-hint-box" style={{ marginBottom: 8 }}>
              {form.isTournament ? t('lobby','create_seats_hint_tourney') : form.isMultiplayerGame ? t('lobby','create_seats_hint_multi') : t('lobby','create_seats_hint_duel')}
            </div>
          )}
          {form.seatConfigs.length === 0 ? (
            <div className="wizard-hint-box">{t('lobby','create_seats_no_extra')}</div>
          ) : (
            <div className="create-seats-section">
              {form.seatConfigs.map((cfg, idx) => (
                <div key={idx} className="create-seat-box" style={{ background: 'rgba(22,28,56,0.5)' }}>
                  <div className="seat-box-header">
                    <span className="seat-title">{t('lobby','create_seat_number',{num:idx+2})} {form.humanSeat ? `→ ${idx + 2}` : `→ ${idx + 1}`}</span>
                    <select data-testid={`seat-type-${idx}`} value={cfg.type} onChange={(e) => form.setSeatType(idx, e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
                      <option value={HUMAN_SEAT}>{seatTypeLabel(HUMAN_SEAT, t)}</option>
                      <option value={SIM_SEAT}>{seatTypeLabel(SIM_SEAT, t)}</option>
                      {form.playerTypes.map((pt) => (
                        <option key={pt} value={pt}>{seatTypeLabel(pt, t)}</option>
                      ))}
                    </select>
                  </div>
                  {!isHumanSeatType(cfg.type) && (
                  <label>
                    {t('lobby','create_field_seat_skill')}
                    <select data-testid={`seat-skill-${idx}`} value={cfg.skill ?? 2} onChange={(e) => form.setSeatSkill(idx, Number(e.target.value))} style={{ width: 'auto', minWidth: 80 }}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  )}
                  {isHumanSeatType(cfg.type) && <span className="wizard-hint-box"><Icon name="user" size={11} /> {t('lobby','create_seat_human_waiting')}</span>}
                  {!isHumanSeatType(cfg.type) && !form.isDraftLimited && (() => {
                    const deck = form.availableDecks.find((d) => d.name === cfg.deckName)
                    const total = deck ? deck.cards.reduce((sum, c) => sum + c.amount, 0) : 0
                    return (
                      <>
                        <label>
                          {t('lobby','create_seat_deck_label',{num:idx+2})}
                          <select value={cfg.deckName} onChange={(e) => form.setSeatDeck(idx, e.target.value)} disabled={form.availableDecks.length === 0}>
                            {form.availableDecks.map((d) => (
                              <option key={d.name} value={d.name}>
                                {d.name} ({d.cards.reduce((sum, c) => sum + c.amount, 0)})
                              </option>
                            ))}
                          </select>
                        </label>
                        {(!deck || total === 0) ? (
                          <span className="wizard-warn-badge"><Icon name="alert" size={11} /> {t('lobby','create_warn_seat_deck_empty')}</span>
                        ) : (
                          <span className="wizard-hint-box">{total} {t('decks','total_cards')}</span>
                        )}
                      </>
                    )
                  })()}
                  {!isSimSeatType(cfg.type) && !isHumanSeatType(cfg.type) && <span className="wizard-hint-box">{t('lobby','create_seat_bot_internal',{type:seatTypeLabel(cfg.type, t)})}</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <div className="field">
              <span>{t('lobby','create_seats_apply_all_shortcut')}</span>
              <div className="chip-row">
                <button type="button" className={form.playerTypesSel.includes(HUMAN_SEAT) ? 'chip on' : 'chip'} onClick={() => {
                  form.toggleAi(HUMAN_SEAT)
                  form.applySeatTypeToAll(HUMAN_SEAT)
                }}><Icon name="user" size={12} /> {t('lobby','create_seat_human_short')}</button>
                <button type="button" className={form.playerTypesSel.includes(SIM_SEAT) ? 'chip on' : 'chip'} onClick={() => form.toggleAi(SIM_SEAT)}><Icon name="bot" size={12} /> SIM</button>
                {form.playerTypes.map((pt) => (
                  <button key={pt} type="button" className={form.playerTypesSel.includes(pt) ? 'chip on' : 'chip'} onClick={() => {
                    form.toggleAi(pt)
                    form.applySeatTypeToAll(pt)
                  }}>{seatTypeLabel(pt, t)}</button>
                ))}
              </div>
            </div>
            <label style={{ marginTop: 8 }}>
              {t('lobby','create_sim_deck_global_shortcut')}
              <select value={form.simDeck?.name ?? ''} onChange={(e) => form.selectGlobalSimDeck(e.target.value)} disabled={form.availableDecks.length === 0}>
                {form.availableDecks.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.cards.reduce((sum, c) => sum + c.amount, 0)} {t('decks','total_cards')})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
