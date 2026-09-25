import { useEffect, useState } from 'react'
import { useStore, voteRollback, hideRollbackVote, dismissRollbackVote } from '../state/store'
import type { RollbackVoter } from '../state/store'
import { soundManager } from '../audio/soundManager'
import DialogShell from '../ui/DialogShell'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { useTranslation } from '../i18n'
import './RollbackVoteDialog.css'

export const ROLLBACK_HIDE_AFTER_MS = 30_000
export const ROLLBACK_AUTO_DISMISS_MS = 8_000

function VoterRow({ voter }: { voter: RollbackVoter }) {
  const { t } = useTranslation()
  const icon = voter.status === 'accepted' || voter.status === 'requested' ? 'check' : voter.status === 'denied' ? 'x' : 'hourglass'
  return (
    <li className={`rollback-voter is-${voter.status}`} data-testid="rollback-voter" data-status={voter.status}>
      <span className="rollback-voter-icon"><Icon name={icon} size={13} /></span>
      <span className="rollback-voter-name">
        {voter.name}
        {voter.me && <span className="rollback-voter-me"> ({t('dialogs', 'rollback_vote_you')})</span>}
      </span>
      <span className="rollback-voter-status">{t('dialogs', `rollback_vote_status_${voter.status}`)}</span>
    </li>
  )
}

export default function RollbackVoteDialog() {
  const { t } = useTranslation()
  const vote = useStore((s) => s.rollbackVote)
  const currentTurn = useStore((s) => s.game?.turn ?? null)
  const [busy, setBusy] = useState(false)
  const [canHide, setCanHide] = useState(false)

  const voting = vote?.outcome === 'voting'
  const startedAt = vote?.startedAt

  useEffect(() => {
    setCanHide(false)
    if (!voting || startedAt == null) return
    const id = setTimeout(() => setCanHide(true), Math.max(0, startedAt + ROLLBACK_HIDE_AFTER_MS - Date.now()))
    return () => clearTimeout(id)
  }, [voting, startedAt])

  useEffect(() => {
    if (!vote || voting || vote.hidden) return
    const id = setTimeout(() => dismissRollbackVote(), ROLLBACK_AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [vote, voting])

  if (!vote || vote.hidden) return null

  const targetTurn = Math.max(1, vote.requestedAtTurn - vote.turns)
  const drifted = voting && currentTurn != null && currentTurn > vote.requestedAtTurn
  const needsMyVote = voting && vote.myVote === 'pending'
  const accepted = vote.voters.filter((v) => v.status === 'accepted' || v.status === 'requested').length

  const onVote = async (accept: boolean) => {
    if (busy) return
    soundManager.play('ui_click', 'ui')
    setBusy(true)
    try {
      await voteRollback(vote.gameId, accept, vote.requesterUserId)
    } finally {
      setBusy(false)
    }
  }

  const title = vote.requestedByMe
    ? t('dialogs', 'rollback_vote_title_mine')
    : t('dialogs', 'rollback_vote_title', { name: vote.requester || '?' })

  let banner: { tone: 'wait' | 'ok' | 'err'; text: string }
  if (vote.outcome === 'applied') {
    banner = { tone: 'ok', text: t('dialogs', 'rollback_vote_applied', { turn: vote.appliedTurn ?? targetTurn }) }
  } else if (vote.outcome === 'denied') {
    banner = { tone: 'err', text: t('dialogs', 'rollback_vote_denied', { name: vote.deniedBy ?? '?' }) }
  } else if (vote.outcome === 'failed') {
    banner = { tone: 'err', text: t('dialogs', 'rollback_vote_failed', { reason: vote.failReason ?? '' }) }
  } else if (needsMyVote) {
    banner = { tone: 'wait', text: t('dialogs', 'rollback_vote_your_turn') }
  } else {
    banner = { tone: 'wait', text: t('dialogs', 'rollback_vote_waiting') }
  }

  return (
    <DialogShell
      labelledBy="rollback-vote-title"
      titleId="rollback-vote-title"
      testId="rollback-vote"
      legacyBackdropClass="feedback-backdrop"
      legacyPanelClass="feedback-dialog rollback-vote-dialog"
      kickerIcon="undo"
      kickerLabel={t('dialogs', 'rollback_vote_kicker')}
      title={title}
      message={t('dialogs', 'rollback_vote_target', { turn: targetTurn, from: vote.requestedAtTurn })}
      sectionProps={{ 'data-space-shortcut-off': 'true' } as Record<string, string>}
    >
      <div className="rollback-vote-progress" aria-live="polite">
        {t('dialogs', 'rollback_vote_progress', { count: accepted, total: vote.voters.length })}
      </div>
      <ul className="rollback-voter-list">
        {vote.voters.map((v) => <VoterRow key={v.name} voter={v} />)}
      </ul>

      {drifted && (
        <div className="rollback-priority-notice" role="alert">
          <Icon name="alert" size={13} /> {t('dialogs', 'rollback_vote_drift', { turn: currentTurn, target: Math.max(1, (currentTurn ?? 0) - vote.turns), requested: targetTurn })}
        </div>
      )}

      <div className={`rollback-vote-banner is-${banner.tone}`} role="status" data-testid="rollback-vote-outcome" data-outcome={vote.outcome}>
        {banner.tone === 'wait' && <span className="rollback-vote-spinner" aria-hidden="true" />}
        {banner.tone === 'ok' && <Icon name="check" size={14} />}
        {banner.tone === 'err' && <Icon name="x" size={14} />}
        <span>{banner.text}</span>
      </div>

      <div className="feedback-dialog-actions rollback-actions">
        {needsMyVote ? (
          <>
            <Button variant="primary" disabled={busy} onClick={() => void onVote(true)} data-testid="rollback-vote-accept">
              <Icon name="check" size={13} /> {t('dialogs', 'rollback_vote_accept')}
            </Button>
            <Button variant="subtle" className="cancel-btn" disabled={busy} onClick={() => void onVote(false)} data-testid="rollback-vote-deny">
              <Icon name="x" size={13} /> {t('dialogs', 'rollback_vote_deny')}
            </Button>
          </>
        ) : voting ? (
          canHide && (
            <Button variant="subtle" onClick={hideRollbackVote} data-testid="rollback-vote-hide">
              {t('dialogs', 'rollback_vote_hide')}
            </Button>
          )
        ) : (
          <Button variant="primary" onClick={dismissRollbackVote} data-testid="rollback-vote-close">
            {t('dialogs', 'rollback_vote_close')}
          </Button>
        )}
      </div>
    </DialogShell>
  )
}
