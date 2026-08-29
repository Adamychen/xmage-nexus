import { returnToLobby, useStore, useGame } from '../state/store'
import './GameEndDialog.css'

/** Resumen del fin de partida/match (END_GAME_INFO o GAME_OVER del servidor).
 *  Muestra la victoria/derrota para jugadores activos y el ganador para espectadores. */
export default function GameEndDialog() {
  const end = useStore((s) => s.gameEnd)
  const game = useGame()
  if (!end) return null

  const me = game?.players?.find((p) => p.controlled)
  const isSpectator = !me
  const matchOver = end.matchView?.endTime != null || /won the match/i.test(end.matchInfo ?? '') || isSpectator

  // Extraer el nombre del ganador del mensaje si está presente
  let winnerName: string | null = null
  const wonMatch = (end.gameInfo || end.matchInfo || '').match(/(.+?)\s+(?:has won the game|has won the match|won the match|won the game|ha ganado)/i)
  if (wonMatch) {
    winnerName = wonMatch[1].trim()
  }

  return (
    <div className="end-backdrop" role="presentation">
      <section className="end-dialog panel" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <h2 id="end-title">
          {isSpectator ? '🏆 Fin de la Partida' : (end.won ? '🎉 ¡Victoria!' : '💀 Fin de partida')}
        </h2>

        {winnerName && (
          <div className="end-winner-badge">
            <span>Ganador: <strong>{winnerName}</strong></span>
          </div>
        )}

        {end.gameInfo && <p className="end-info">{end.gameInfo}</p>}
        {end.matchInfo && end.matchInfo !== end.gameInfo && <p className="end-match">{end.matchInfo}</p>}

        {!isSpectator && (end.wins != null || end.winsNeeded != null) && (
          <p className="end-score">
            Marcador: {end.wins ?? 0}–{end.loses ?? 0} (necesitas {end.winsNeeded ?? 1} victorias)
          </p>
        )}

        {matchOver ? (
          <button className="primary" onClick={returnToLobby}>
            Volver al lobby
          </button>
        ) : (
          <p className="end-hint">El match continúa — esperando la siguiente partida…</p>
        )}
      </section>
    </div>
  )
}
