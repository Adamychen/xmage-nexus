import { concedeMatch, dismissElimination, useStore } from '../state/store'
import DialogShell from '../ui/DialogShell'
import Button from '../ui/Button'
import { useTranslation } from '../i18n'
import './GameEndDialog.css'

export default function EliminatedDialog() {
  const { t } = useTranslation()
  const gameId = useStore((s) => s.gameId)
  const game = useStore((s) => s.game)
  const elimination = useStore((s) => s.elimination)
  const gameEnd = useStore((s) => s.gameEnd)
  const sideboardScreen = useStore((s) => s.sideboardScreen)

  if (!gameId || !game || gameEnd || sideboardScreen) return null
  if (elimination?.gameId === gameId && elimination.dismissed) return null
  const me = game.players?.find((p) => p.controlled)
  if (me?.hasLeft !== true && elimination?.gameId !== gameId) return null

  return (
    <DialogShell
      labelledBy="eliminated-title"
      titleId="eliminated-title"
      size="sm"
      legacyBackdropClass="end-backdrop"
      legacyPanelClass="end-dialog"
      kickerIcon="eye"
      kickerLabel={t('lobby', 'match_result_label')}
      title={t('game', 'eliminated_title')}
    >
      <p className="end-hint">{t('game', 'eliminated_hint')}</p>
      <div className="end-actions">
        <Button variant="subtle" data-testid="eliminated-watch" onClick={dismissElimination}>
          {t('common', 'close')}
        </Button>
        <Button variant="primary" data-testid="eliminated-leave" onClick={() => void concedeMatch(gameId)}>
          {t('game', 'return_to_lobby')}
        </Button>
      </div>
    </DialogShell>
  )
}
