import { returnToLobby, useStore, useGame, clearGameEnd } from '../state/store'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './GameEndDialog.css'

export default function GameEndDialog() {
  const end = useStore((s) => s.gameEnd)
  const sideboardScreen = useStore((s) => s.sideboardScreen)
  const game = useGame()
  const { t } = useTranslation()

  if (!end || sideboardScreen) return null

  const me = game?.players?.find((p) => p.controlled)
  const isSpectator = !me
  const matchOver = end.matchView?.endTime != null || /won the match/i.test(end.matchInfo ?? '') || isSpectator

  let winnerName: string | null = null
  const wonMatch = (end.gameInfo || end.matchInfo || '').match(/(.+?)\s+(?:has won the game|has won the match|won the match|won the game|ha ganado)/i)
  if (wonMatch) {
    winnerName = wonMatch[1].trim()
  }

  return (
    <div className="end-backdrop" role="presentation">
      <section className="end-dialog panel" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <h2 id="end-title">
          {isSpectator ? (<><Icon name="trophy" size={20} /> {t('game', 'game_over')}</>) : (end.won ? (<><Icon name="trophy" size={20} /> {t('game', 'victory')}</>) : (<><Icon name="skull" size={20} /> {t('game', 'defeat')}</>))}
        </h2>

        {winnerName && (
          <div className="end-winner-badge">
            <span>{t('game', 'winner')} <strong>{winnerName}</strong></span>
          </div>
        )}

        {end.gameInfo && <p className="end-info">{end.gameInfo}</p>}
        {end.matchInfo && end.matchInfo !== end.gameInfo && <p className="end-match">{end.matchInfo}</p>}

        {!isSpectator && (end.wins != null || end.winsNeeded != null) && (
          <p className="end-score">
            {t('game', 'score')} {end.wins ?? 0}–{end.loses ?? 0} ({t('game', 'match_wins')}: {end.winsNeeded ?? 1})
          </p>
        )}

        {matchOver ? (
          <button className="primary" onClick={returnToLobby}>
            {t('game', 'return_to_lobby')}
          </button>
        ) : (
          <div className="end-actions">
            <p className="end-hint">{t('game', 'match_continues')}</p>
            <button className="primary" onClick={clearGameEnd}>
              {t('common', 'close')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
