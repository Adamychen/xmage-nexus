import { returnToLobby, useStore, useGame, clearGameEnd } from '../state/store'
import { handleWatchGame } from '../state/events/game'
import { findFollowGameId } from './spectatorFollow'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import { formatMatchDuration } from '../lobby/FinishedMatchesPanel'
import { downloadLatestGameLog, toSavedEntries } from '../system/gameLogs'
import { localizeGameEndMessage } from './serverMessageTranslation'
import './GameEndDialog.css'

export default function GameEndDialog() {
  const end = useStore((s) => s.gameEnd)
  const sideboardScreen = useStore((s) => s.sideboardScreen)
  const game = useGame()
  const log = useStore((s) => s.log)
  const watchedGameId = useStore((s) => s.gameId)
  const lobbyTables = useStore((s) => s.lobby?.tables)
  const { t } = useTranslation()

  if (!end || sideboardScreen) return null

  const me = game?.players?.find((p) => p.controlled)
  const isSpectator = !me
  const matchOver = end.matchView?.endTime != null || /won the match/i.test(end.matchInfo ?? '') || isSpectator
  // B.10: la mesa puede tener ya otra partida (Bo3/torneo); sin auto-follow,
  // solo aviso + botón Seguir (claves game.spectator_game_changed / game.follow_game).
  const followGameId = isSpectator ? findFollowGameId(lobbyTables, watchedGameId) : null
  const duration = formatMatchDuration(end.startTime, end.endTime ?? end.matchView?.endTime ?? undefined)

  const handleDownloadLog = () => {
    void downloadLatestGameLog({
      title: end.matchInfo ?? end.gameInfo ?? 'game',
      entries: toSavedEntries(log),
    })
  }

  let winnerName: string | null = null
  const rawEndInfo = end.gameInfo || end.matchInfo || ''
  const wonMatch = rawEndInfo.match(/(?:Player\s+)?(.+?)\s+(?:has won the game|has won the match|won the match|won the game|is the winner|ha ganado)/i)
  if (wonMatch) {
    winnerName = wonMatch[1].trim()
    if (/^you$/i.test(winnerName)) {
      winnerName = t('game', 'you')
    }
  }

  const gameInfoText = localizeGameEndMessage(end.gameInfo, t)
  const matchInfoText = localizeGameEndMessage(end.matchInfo, t)

  return (
    <DialogShell
      labelledBy="end-title"
      titleId="end-title"
      size="sm"
      legacyBackdropClass="end-backdrop"
      legacyPanelClass="end-dialog"
      kickerIcon={isSpectator || end.won ? 'trophy' : 'skull'}
      kickerLabel={t('lobby', 'match_result_label')}
      title={isSpectator ? t('game', 'game_over') : (end.won ? t('game', 'victory') : t('game', 'defeat'))}
    >
        {winnerName && (
          <div className="end-winner-badge">
            <span>{t('game', 'winner')} <strong>{winnerName}</strong></span>
          </div>
        )}

        {end.gameInfo && <p className="end-info">{gameInfoText}</p>}
        {end.matchInfo && end.matchInfo !== end.gameInfo && <p className="end-match">{matchInfoText}</p>}

        {!isSpectator && (end.wins != null || end.winsNeeded != null) && (
          <p className="end-score">
            {t('game', 'score')} {end.wins ?? 0}–{end.loses ?? 0} ({t('game', 'match_wins')}: {end.winsNeeded ?? 1})
          </p>
        )}

        {duration && (
          <p className="end-duration">
            {t('system', 'match_duration')}: {duration}
          </p>
        )}

        <div className="end-actions">
          <button type="button" data-testid="end-download-log" onClick={handleDownloadLog}>
            {t('system', 'log_download')}
          </button>
        </div>

        {matchOver ? (
          followGameId ? (
            <div className="end-actions">
              <p className="end-hint">{t('game', 'spectator_game_changed')}</p>
              <button className="primary" onClick={() => handleWatchGame(followGameId)}>
                {t('game', 'follow_game')}
              </button>
              <button onClick={returnToLobby}>
                {t('game', 'return_to_lobby')}
              </button>
            </div>
          ) : (
            <button className="primary" onClick={returnToLobby}>
              {t('game', 'return_to_lobby')}
            </button>
          )
        ) : (
          <div className="end-actions">
            <p className="end-hint">{t('game', 'match_continues')}</p>
            <button className="primary" onClick={clearGameEnd}>
              {t('common', 'close')}
            </button>
          </div>
        )}
    </DialogShell>
  )
}
