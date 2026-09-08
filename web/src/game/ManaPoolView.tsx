import type { PlayerView } from '../net/types'
import { ManaPip } from '../decks/ArenaManaSymbols'
import { useTranslation } from '../i18n'
import './ManaPoolView.css'

export type ManaPoolKey = keyof PlayerView['manaPool']

export const MANA_POOL_ORDER: Array<{ key: ManaPoolKey; symbol: string; className: string }> = [
  { key: 'white', symbol: 'W', className: 'mana-w' },
  { key: 'blue', symbol: 'U', className: 'mana-u' },
  { key: 'black', symbol: 'B', className: 'mana-b' },
  { key: 'red', symbol: 'R', className: 'mana-r' },
  { key: 'green', symbol: 'G', className: 'mana-g' },
  { key: 'colorless', symbol: 'C', className: 'mana-c' },
]

interface ManaPoolViewProps {
  pool: Partial<Record<ManaPoolKey, number>>
  canPay?: boolean
  onPay?: (key: ManaPoolKey) => void
  size?: number
}

export default function ManaPoolView({ pool, canPay = false, onPay, size = 16 }: ManaPoolViewProps) {
  const { t } = useTranslation()
  const total = MANA_POOL_ORDER.reduce((sum, c) => sum + (pool[c.key] ?? 0), 0)
  return (
    <div
      className="mana-inline"
      title={`${t('game', 'mana_title')}: ${total}`}
      data-testid="mana-inline"
    >
      {MANA_POOL_ORDER.map((c) => {
        const count = pool[c.key] ?? 0
        const clickable = canPay && !!onPay && count > 0
        const pip = (
          <>
            <ManaPip symbol={c.symbol} size={size} />
            <span className="mana-inline-count">{count}</span>
          </>
        )
        return clickable ? (
          <button
            key={c.key}
            type="button"
            className={`mana-inline-pip ${c.className}`}
            data-testid={`mana-pay-${c.symbol}`}
            title={t('game', 'mana_payment_restricted_tip')}
            aria-label={`${t('game', 'mana_title')}: ${c.symbol} (${count})`}
            onClick={() => onPay(c.key)}
          >
            {pip}
          </button>
        ) : (
          <span key={c.key} className={`mana-inline-pip ${c.className} ${count === 0 ? 'is-zero' : ''}`}>
            {pip}
          </span>
        )
      })}
    </div>
  )
}
