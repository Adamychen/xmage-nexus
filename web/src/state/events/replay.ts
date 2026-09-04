import { setState, addLog } from '../state'
import { gameViewFrom } from '../gameUtils'

export function handleReplayGame(objectId: string | null): void {
  addLog('replay', `Replay disponible: ${objectId?.slice(0, 8) ?? ''}`)
}

export function handleReplayUpdate(data: unknown): void {
  const gv = gameViewFrom(data)
  if (gv) {
    setState({ replayViewer: { gameView: gv } })
    setState({ game: gv, phase: 'game' })
  }
}

export function handleReplayDone(data: unknown): void {
  const text = typeof data === 'string' ? data : (data as { message?: string } | null)?.message ?? 'Replay terminado'
  addLog('replay', text)
  setState({ replayViewer: { gameView: null, result: text } })
}
