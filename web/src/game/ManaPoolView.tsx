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
  /** Pinta los seis colores aunque estén a cero. Reservado al pago de maná en
   *  curso, que es cuando «tengo 0 de azul» es información accionable; `canPay`
   *  NO sirve como señal (es true durante toda la partida en la barra propia). */
  showAll?: boolean
}

export default function ManaPoolView({ pool, canPay = false, onPay, size = 16, showAll = false }: ManaPoolViewProps) {
  const { t } = useTranslation()
  const total = MANA_POOL_ORDER.reduce((sum, c) => sum + (pool[c.key] ?? 0), 0)
  /** Fuera del pago solo se pintan los colores con maná: seis ceros
   *  permanentes eran ruido. Filtrar nunca oculta un pip pagable, porque los
   *  de cuenta cero no son clicables. */
  const shown = showAll ? MANA_POOL_ORDER : MANA_POOL_ORDER.filter((c) => (pool[c.key] ?? 0) > 0)
  return (
    <div
      className={`mana-inline ${shown.length === 0 ? 'is-empty' : ''}`}
      title={`${t('game', 'mana_title')}: ${total}`}
      data-testid="mana-inline"
    >
      {shown.length === 0 && <span className="mana-inline-empty" aria-hidden="true">—</span>}
      {shown.map((c) => {
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
