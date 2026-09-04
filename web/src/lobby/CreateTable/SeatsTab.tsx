import { useTranslation } from '../../i18n'
import type { CreateTableForm } from './useCreateTableForm'

export default function SeatsTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3>🤖 {t('lobby','create_tab_multi')}</h3>
        <p>Tu asiento, tu mazo y los bots rivales.</p>
      </div>
      <div className="create-seats-section">
        <div className="create-seat-box human-seat-box">
          <div className="seat-box-header">
            <span className="seat-title">👤 {t('common','player')}</span>
            <button
              type="button"
              className={`chip ${form.humanSeat ? 'on' : ''}`}
              onClick={() => form.setHumanSeat(!form.humanSeat)}
            >
              {form.humanSeat ? `✓ ${t('common','player')}` : `👁️ ${t('lobby','spectators')}`}
            </button>
          </div>
          {form.humanSeat && (
            <label>
              {t('lobby','active_deck')}
              <select
                value={form.myDeck.name}
                onChange={(e) => form.selectMyDeck(e.target.value)}
              >
                {form.availableDecks.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.cards.reduce((sum, c) => sum + c.amount, 0)} {t('decks','total_cards')})
                  </option>
                ))}
              </select>
            </label>
          )}
          {!form.humanSeat && <span className="wizard-hint-box">Entrarás como espectador. Podrás unirte luego desde la sala de espera.</span>}
        </div>

        <div className="create-seat-box ai-seat-box">
          <div className="seat-box-header">
            <span className="seat-title">🤖 {t('lobby','ai')} — {form.seatConfigs.length} {form.seatConfigs.length === 1 ? 'plaza' : 'plazas'} BOT ({form.numPlayers} total)</span>
            {form.numPlayers !== (form.selectedGameTypeInfo?.maxPlayers ?? form.numPlayers) && form.selectedGameTypeInfo && (
              <span className="wizard-warn-badge">Config: {form.numPlayers} / {form.selectedGameTypeInfo.maxPlayers} max</span>
            )}
          </div>
          {form.numPlayers > 2 && (
            <div className="wizard-hint-box" style={{ marginBottom: 8 }}>
              {form.isMultiplayerGame ? 'Modo multijugador: cada plaza extra es un bot. Ajusta número de jugadores en la pestaña General.' : 'Ajusta el número de jugadores en General para añadir plazas.'}
            </div>
          )}
          {form.seatConfigs.length === 0 ? (
            <div className="wizard-hint-box">Sin plazas BOT — entrarás solo (útil para tests). Añade jugadores en General o activa tu asiento.</div>
          ) : (
            <div className="create-seats-section">
              {form.seatConfigs.map((cfg, idx) => (
                <div key={idx} className="create-seat-box" style={{ background: 'rgba(22,28,56,0.5)' }}>
                  <div className="seat-box-header">
                    <span className="seat-title">Plaza {idx + 2} {form.humanSeat ? `→ ${idx + 2}` : `→ ${idx + 1}`}</span>
                    <select value={cfg.type} onChange={(e) => form.setSeatType(idx, e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
                      <option value="SIM">🤖 SIM</option>
                      {form.playerTypes.map((pt) => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                  </div>
                  {cfg.type === 'SIM' && (
                    <label>
                      Mazo plaza {idx + 2}
                      <select value={cfg.deckName} onChange={(e) => form.setSeatDeck(idx, e.target.value)}>
                        {form.availableDecks.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name} ({d.cards.reduce((sum, c) => sum + c.amount, 0)})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {cfg.type !== 'SIM' && <span className="wizard-hint-box">Bot {cfg.type} — usa mazo interno del servidor</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <div className="field">
              <span>Atajo: aplicar a todas las plazas BOT</span>
              <div className="chip-row">
                <button type="button" className={form.playerTypesSel.includes('SIM') ? 'chip on' : 'chip'} onClick={() => form.toggleAi('SIM')}>🤖 SIM</button>
                {form.playerTypes.map((pt) => (
                  <button key={pt} type="button" className={form.playerTypesSel.includes(pt) ? 'chip on' : 'chip'} onClick={() => {
                    form.toggleAi(pt)
                    form.applySeatTypeToAll(pt)
                  }}>{pt}</button>
                ))}
              </div>
            </div>
            <label style={{ marginTop: 8 }}>
              Mazo global para SIM (atajo)
              <select value={form.simDeck.name} onChange={(e) => form.selectGlobalSimDeck(e.target.value)}>
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
