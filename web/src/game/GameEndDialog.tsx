import { returnToLobby, useStore, useGame, clearGameEnd } from '../state/store'
import { handleWatchGame } from '../state/events/game'
import { findFollowGameId } from './spectatorFollow'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import { formatMatchDuration } from '../lobby/FinishedMatchesPanel'
import { downloadLatestGameLog, toSavedEntries } from '../system/gameLogs'
import { localizeGameEndMessage } from './serverMessageTranslation'
import { getMatchStats, keyCardOf } from './matchStats'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { particleVectors } from '../board/impactFx'
import { cardName } from '../cards/cardImages'
import type { CardView } from '../net/types'
import './GameEndDialog.css'
import Button from '../ui/Button'

type Tone = 'victory' | 'defeat' | 'neutral'

function EndCinematic({ tone, title }: { tone: Tone; title: string }) {
  return (
    <div className={`end-cinematic ${tone}`} data-testid="end-cinematic" aria-hidden="true">
      <span className="end-cinematic-rays" />
      <span className="end-cinematic-title" data-title={title} />
      {tone !== 'neutral' && particleVectors(tone === 'victory' ? 7 : 13, 22, 420).map((p, i) => (
        <span
          key={i}
          className="end-cinematic-particle"
          style={{
            '--px': `${50 + p.dx / 9}%`,
            '--dx': `${Math.round(p.dx / 4)}px`,
            '--s': p.size.toFixed(2),
            animationDelay: `${p.delay * 8}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

function KeyCard({ card, label }: { card: CardView; label: string }) {
  const url = useCardImageUrl(card)
  const name = cardName(card)
  return (
    <div className="end-key-card" data-testid="end-key-card">
      {url ? <img src={url} alt={name} draggable={false} /> : <span className="end-key-card-fallback">{name}</span>}
      <span className="end-key-card-label">{label}</span>
      <span className="end-key-card-name">{name}</span>
    </div>
  )
}

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
  const wonMatch = rawEndInfo.match(/(?:Player\s+)?(.+?)\s+(?:has won the game|has won the match|have won the game|have won the match|won the match|won the game|is the winner|ha ganado)/i)
  if (wonMatch) {
    winnerName = wonMatch[1].trim()
    if (/^you$/i.test(winnerName)) {
      winnerName = t('game', 'you')
    }
  }

  const showScore = !isSpectator && (end.wins != null || end.winsNeeded != null)
  const hint = matchOver ? (followGameId ? t('game', 'spectator_game_changed') : null) : t('game', 'match_continues')

  const tone: Tone = isSpectator ? 'neutral' : end.won ? 'victory' : 'defeat'
  const title = isSpectator ? t('game', 'game_over') : (end.won ? t('game', 'victory') : t('game', 'defeat'))
  const stats = getMatchStats()
  const ownStats = !isSpectator && stats.gameId != null && stats.gameId === watchedGameId
  const keyCard = ownStats ? keyCardOf(stats) : null
  const statTiles = ownStats
    ? [
        { key: 'turns', label: t('game', 'end_stat_turns'), value: stats.turns },
        { key: 'taken', label: t('game', 'end_stat_life_taken'), value: stats.lifeTaken },
        { key: 'lost', label: t('game', 'end_stat_life_lost'), value: stats.lifeLost },
        { key: 'spells', label: t('game', 'end_stat_spells'), value: stats.spellsCast },
        { key: 'kills', label: t('game', 'end_stat_kills'), value: stats.creaturesKilled },
      ]
    : []

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
      title={title}
      trailing={<EndCinematic tone={tone} title={title} />}
    >
        {winnerName && (
          <div className="end-winner-badge">
            <span>{t('game', 'winner')} <strong>{winnerName}</strong></span>
          </div>
        )}

        {(end.gameInfo || (end.matchInfo && end.matchInfo !== end.gameInfo)) && (
          <div className="end-summary">
            {end.gameInfo && <p className="end-info">{gameInfoText}</p>}
            {end.matchInfo && end.matchInfo !== end.gameInfo && <p className="end-match">{matchInfoText}</p>}
          </div>
        )}

        {(showScore || duration) && (
          <div className="end-stats">
            {showScore && (
              <p className="end-score">
                {t('game', 'score')} {end.wins ?? 0}–{end.loses ?? 0} ({t('game', 'match_wins')}: {end.winsNeeded ?? 1})
              </p>
            )}
            {duration && (
              <p className="end-duration">
                {t('system', 'match_duration')}: {duration}
              </p>
            )}
          </div>
        )}

        {(statTiles.length > 0 || keyCard) && (
          <div className="end-match-stats" data-testid="end-match-stats">
            {keyCard && <KeyCard card={keyCard} label={t('game', 'end_key_card')} />}
            {statTiles.length > 0 && (
              <dl className="end-stat-grid">
                {statTiles.map((s) => (
                  <div key={s.key} className="end-stat-tile" data-stat={s.key}>
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {hint && <p className="end-hint">{hint}</p>}

        <div className="end-actions">
          <Button variant="subtle" data-testid="end-download-log" onClick={handleDownloadLog}>
            {t('system', 'log_download')}
          </Button>
          {matchOver ? (
            <>
              {followGameId && (
                <>
                  <Button onClick={returnToLobby}>
                    {t('game', 'return_to_lobby')}
                  </Button>
                  <Button variant="primary" onClick={() => handleWatchGame(followGameId)}>
                    {t('game', 'follow_game')}
                  </Button>
                </>
              )}
              {!followGameId && (
                <Button variant="primary" onClick={returnToLobby}>
                  {t('game', 'return_to_lobby')}
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" onClick={clearGameEnd}>
              {t('common', 'close')}
            </Button>
          )}
        </div>
    </DialogShell>
  )
}
