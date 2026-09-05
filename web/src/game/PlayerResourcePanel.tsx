import { useState } from 'react'
import type { PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import { useStore } from '../state/store'
import { sendPlayerManaType } from '../net/commands'
import { manaTypeOf } from './manaPayment'
import Icon from '../ui/Icon'
import './PlayerResourcePanel.css'

const MANA_COLORS: Array<{ key: keyof PlayerView['manaPool']; symbol: string; className: string }> = [
  { key: 'white', symbol: 'W', className: 'mana-w' },
  { key: 'blue', symbol: 'U', className: 'mana-u' },
  { key: 'black', symbol: 'B', className: 'mana-b' },
  { key: 'red', symbol: 'R', className: 'mana-r' },
  { key: 'green', symbol: 'G', className: 'mana-g' },
  { key: 'colorless', symbol: 'C', className: 'mana-c' },
]

export default function PlayerResourcePanel({ player, side }: { player: PlayerView; side: 'opp' | 'my' }) {
  const { t } = useTranslation()
  const [manaOpen, setManaOpen] = useState(false)
  const gameId = useStore((s) => s.gameId)
  const pool = player.manaPool
  const manaTotal = MANA_COLORS.reduce((sum, c) => sum + (pool[c.key] ?? 0), 0)
  const canPayMana = side === 'my' && !!gameId
  const payMana = (key: keyof PlayerView['manaPool']) => {
    const manaType = manaTypeOf(key)
    if (gameId && manaType) void sendPlayerManaType(gameId, player.playerId, manaType)
  }
  const graveyardCount = Object.keys(player.graveyard ?? {}).length
  const exileCount = Object.keys(player.exile ?? {}).length

  return (
    <div className={`player-resource-panel ${side}-resources`}>
      <div className="resource-mana-wrap">
        <button
          type="button"
          className="resource-mana"
          onClick={() => setManaOpen((v) => !v)}
          title={t('game', 'mana_title')}
        >
          <span>{manaTotal}</span>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
        </button>
        {manaOpen && (
          <div className="resource-mana-breakdown">
            {MANA_COLORS.map((c) => {
              const count = pool[c.key] ?? 0
              if (canPayMana && count > 0) {
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={`mana-pip ${c.className} is-clickable`}
                    data-testid={`mana-pay-${c.symbol}`}
                    title={t('game', 'mana_payment_restricted_tip')}
                    aria-label={`${t('game', 'mana_title')}: ${c.symbol} (${count})`}
                    onClick={() => payMana(c.key)}
                  >
                    <span>{c.symbol}</span>
                    <b>{count}</b>
                  </button>
                )
              }
              return (
                <div key={c.key} className={`mana-pip ${c.className}`}>
                  <span>{c.symbol}</span>
                  <b>{count}</b>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="resource-library" title={t('game', 'pile_library')}>
        <div className="resource-card-back">
          <span className="resource-card-back-mark"><Icon name="sparkles" size={14} /></span>
        </div>
        <span className="resource-library-count">{player.libraryCount}</span>
      </div>

      <div className="resource-side-piles">
        <div className="resource-pip" title={`${t('game', 'pile_graveyard')}: ${graveyardCount}`}>{graveyardCount}</div>
        <div className="resource-pip" title={`${t('game', 'pile_exile')}: ${exileCount}`}>{exileCount}</div>
      </div>
    </div>
  )
}
