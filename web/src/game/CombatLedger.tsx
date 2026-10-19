import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../state/store'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import { useFeedItems } from './useFeedItems'
import { buildCombatLedger, ledgerWindowOpen } from './combatLedgerModel'
import { COMMANDER_LETHAL } from './CommanderDamageMatrix'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import './CombatLedger.css'

export default function CombatLedger() {
  const { t } = useTranslation()
  const game = useGame()
  const items = useFeedItems()
  const [dismissedTurn, setDismissedTurn] = useState<number | null>(null)
  const turn = game?.turn ?? 0
  const open = ledgerWindowOpen(game?.step) && dismissedTurn !== turn
  const ledger = useMemo(() => (open ? buildCombatLedger(items, game) : null), [open, items, game])

  useEffect(() => {
    if (!ledgerWindowOpen(game?.step)) setDismissedTurn((cur) => (cur === turn ? cur : null))
  }, [game?.step, turn])

  if (!ledger) return null

  const players = game?.players
  const dot = (ownerId: string | null) => (
    <span
      className="combat-ledger-dot"
      aria-hidden="true"
      style={{ background: ownerId ? seatColorVar(seatIndexOf(players, ownerId)) : 'var(--fg-3)' }}
    />
  )

  return (
    <section className="combat-ledger" data-testid="combat-ledger" aria-label={t('game', 'combat_damage_title')}>
      <header className="combat-ledger-head">
        <span className="combat-ledger-title">
          <Icon name="swords" size={13} />
          {t('game', 'combat_damage_title')}
        </span>
        {ledger.attacker && <span className="combat-ledger-sub">{t('game', 'ledger_attacks', { player: ledger.attacker })}</span>}
        <IconButton icon="x" label={t('common', 'close')} variant="ghost" size="xs" onClick={() => setDismissedTurn(turn)} />
      </header>
      <ul className="combat-ledger-rows">
        {ledger.rows.map((row) => (
          <li key={`${row.source}|${row.target}`} className={`combat-ledger-row${row.toPlayer ? ' to-player' : ''}`} data-testid="combat-ledger-row">
            <span className="combat-ledger-who">
              <span className="combat-ledger-names">
                {dot(row.sourceOwnerId)}
                <span className="combat-ledger-source">{row.source}</span>
                <span className="combat-ledger-arrow" aria-hidden="true">→</span>
                {dot(row.targetOwnerId)}
                <span className="combat-ledger-target">{row.target}</span>
              </span>
              {row.commander && row.toPlayer && (
                <span className="combat-ledger-tags">
                  <span className="combat-ledger-tag">{t('game', 'tab_commander')}</span>
                </span>
              )}
            </span>
            <span className="combat-ledger-amount">
              {row.amount}
              {row.commanderTotal != null && (
                <small data-testid="combat-ledger-commander">
                  {Math.max(0, row.commanderTotal - row.amount)} → {row.commanderTotal} / {COMMANDER_LETHAL}
                </small>
              )}
            </span>
          </li>
        ))}
      </ul>
      {ledger.totals.length > 0 && (
        <footer className="combat-ledger-totals">
          {ledger.totals.map((total) => (
            <span key={total.name} className="combat-ledger-total" data-testid="combat-ledger-total">
              {total.name}{' '}
              {total.lifeAfter != null ? (
                <>
                  {total.lifeAfter + total.amount} → <b>{total.lifeAfter}</b>
                </>
              ) : (
                <b>−{total.amount}</b>
              )}
            </span>
          ))}
        </footer>
      )}
    </section>
  )
}
