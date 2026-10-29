import type { TableView, TournamentView } from '../net/types'
import TournamentBracket from './TournamentBracket'
import DialogShell from '../ui/DialogShell'
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
  /** id REAL del torneo (no el de la mesa): necesario para quitTournament */
  tournamentId?: string | null
  /** false = torneo ajeno/espectador: no ofrece "Abandonar torneo" */
  canQuit?: boolean
  /** ms epoch of the last successful refresh of the bracket */
  updatedAt?: number | null
}

export default function TournamentBracketModal({ table, view, loading, error, onClose, onRefresh, onWatchMatch, watchingMatchId, tournamentId, canQuit, updatedAt }: Props) {
  const { t } = useTranslation()
  return (
    <DialogShell
      labelledBy="tournament-modal-title"
      titleId="tournament-modal-title"
      size="lg"
      testId="tournament-modal"
      legacyBackdropClass="tournament-modal-backdrop"
      legacyPanelClass="tournament-modal"
      title={view?.tournamentName ?? table.tableName}
      onBackdropClick={onClose}
      onClose={onClose}
    >
      <div className="tournament-modal-scroll">
        {loading && !view && <div className="tournament-modal-loading">{t('lobby', 'matches_loading')}</div>}
        {error && <div className="tournament-modal-error" data-testid="tournament-modal-error">{error}</div>}
        {view && (
          <TournamentBracket
            view={view}
            tournamentId={tournamentId ?? undefined}
            onWatchMatch={onWatchMatch}
            watchingMatchId={watchingMatchId}
            canQuit={canQuit}
            showName={false}
            updatedAt={updatedAt}
            refreshing={loading}
            onRefresh={onRefresh}
          />
        )}
        {!view && !loading && !error && (
          <div className="tournament-modal-loading" data-testid="tournament-empty">
            {t('lobby', 'matches_empty')}
          </div>
        )}
      </div>
    </DialogShell>
  )
}
