import type { TableView, TournamentView } from '../net/types'
import TournamentBracket from './TournamentBracket'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'

interface Props {
  table: TableView
  view: TournamentView | null
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => void
}

export default function TournamentBracketModal({ table, view, loading, error, onClose, onRefresh }: Props) {
  const { t } = useTranslation()
  return (
    <div className="tournament-modal-backdrop" role="presentation" onClick={onClose} data-testid="tournament-modal-backdrop">
      <div className="tournament-modal" role="dialog" aria-modal="true" aria-label={t('lobby','view_bracket')} onClick={(e) => e.stopPropagation()} data-testid="tournament-modal">
        <div className="tournament-bracket-toolbar">
          <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}><Icon name="trophy" size={12} /> {table.tableName}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="tournament-refresh-btn" onClick={onRefresh} disabled={loading}>
              {loading ? t('lobby','matches_loading') : (<><Icon name="refresh" size={12} /> {t('lobby','matches_refresh')}</>)}
            </button>
            <button type="button" className="tournament-close-btn" onClick={onClose} aria-label={t('common','close')}>✕</button>
          </div>
        </div>
        <div className="tournament-modal-scroll">
          {loading && !view && <div className="tournament-modal-loading">{t('lobby','matches_loading')}</div>}
          {error && <div className="tournament-modal-error" data-testid="tournament-modal-error">{error}</div>}
          {view && (
            <TournamentBracket
              view={view}
              tournamentId={table.tableId}
              onClose={onClose}
            />
          )}
          {!view && !loading && !error && (
            <div className="tournament-modal-loading" data-testid="tournament-empty">
              {t('lobby','matches_empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
