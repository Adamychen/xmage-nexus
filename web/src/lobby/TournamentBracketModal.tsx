import type { TableView, TournamentView } from '../net/types'
import TournamentBracket from './TournamentBracket'
import DialogShell from '../ui/DialogShell'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'

interface Props {
  table: TableView
  view: TournamentView | null
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => void
  onWatchMatch?: (tableId: string) => void
  watchingMatchId?: string | null
}

export default function TournamentBracketModal({ table, view, loading, error, onClose, onRefresh, onWatchMatch, watchingMatchId }: Props) {
  const { t } = useTranslation()
  return (
    <DialogShell
      labelledBy="tournament-modal-title"
      titleId="tournament-modal-title"
      size="lg"
      testId="tournament-modal"
      legacyBackdropClass="tournament-modal-backdrop"
      legacyPanelClass="tournament-modal"
      kickerIcon="trophy"
      kickerLabel={t('lobby', 'view_bracket')}
      title={table.tableName}
      topRight={(
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="tournament-refresh-btn" onClick={onRefresh} disabled={loading}>
            {loading ? t('lobby', 'matches_loading') : (<><Icon name="refresh" size={12} /> {t('lobby', 'matches_refresh')}</>)}
          </button>
          <button type="button" className="tournament-close-btn" onClick={onClose} aria-label={t('common', 'close')}>✕</button>
        </div>
      )}
      onBackdropClick={onClose}
    >
        <div className="tournament-modal-scroll">
          {loading && !view && <div className="tournament-modal-loading">{t('lobby','matches_loading')}</div>}
          {error && <div className="tournament-modal-error" data-testid="tournament-modal-error">{error}</div>}
          {view && (
            <TournamentBracket
              view={view}
              tournamentId={table.tableId}
              onClose={onClose}
              onWatchMatch={onWatchMatch}
              watchingMatchId={watchingMatchId}
            />
          )}
          {!view && !loading && !error && (
            <div className="tournament-modal-loading" data-testid="tournament-empty">
              {t('lobby','matches_empty')}
            </div>
          )}
        </div>
    </DialogShell>
  )
}
