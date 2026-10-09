import { useState } from 'react'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import DialogShell from '../ui/DialogShell'
import CloseButton from '../ui/CloseButton'
import Icon from '../ui/Icon'
import Tabs from '../ui/Tabs'
import { useEscape } from '../ui/useEscape'
import { useTranslation } from '../i18n'
import { addLog, getState } from '../state/state'
import { sendReport } from '../net/commands'
import { downloadBlob } from '../utils/download'
import { buildReport, reportToMarkdown, type ReportKind } from '../system/report'
import './ReportDialog.css'

export interface ReportDialogProps {
  initialText?: string
  /** Preselects the tab: the crash screen knows it is a bug, the menu does not. */
  kind?: ReportKind
  onClose: () => void
}

type Status = { phase: 'idle' | 'sending' } | { phase: 'sent'; stored: boolean; detail: string } | { phase: 'copied' }

/**
 * The one place a player tells us something. Everything the report needs beyond this textarea is
 * captured by `buildReport`; everything beyond "send" (the issue, the triage) happens on the host.
 * Nothing here sends by itself, and the payload never leaves the page without a click.
 */
export default function ReportDialog({ initialText = '', kind = 'bug', onClose }: ReportDialogProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ReportKind>(kind)
  const [text, setText] = useState(initialText)
  const [withGame, setWithGame] = useState(true)
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const [dump, setDump] = useState<string | null>(null)

  useEscape(onClose)

  const connected = getState().wsAlive === true

  const draft = () => {
    const built = buildReport(tab, text.trim())
    if (withGame) return built
    // No game data: the summary only. The frames are the part another player's board is made of.
    return { ...built, wire: { ...built.wire, errors: [], bundle: { ...built.wire.bundle, log: [], frames: [] } } }
  }

  const send = async () => {
    const built = draft()
    setStatus({ phase: 'sending' })
    const res = await sendReport(built)
    if (res.ok && res.ack.stored) {
      addLog('system', `report sent (${res.ack.id ?? '?'})`)
      setStatus({ phase: 'sent', stored: true, detail: `${t('system', 'report_sent')} ${res.ack.id ?? ''}`.trim() })
      return
    }
    const reason = res.ok ? (res.ack.reason ?? 'not stored') : (res.error ?? 'not sent')
    setStatus({ phase: 'sent', stored: false, detail: reason })
  }

  const copy = async () => {
    const built = draft()
    const markdown = reportToMarkdown(built)
    setDump(markdown)
    try {
      await navigator.clipboard.writeText(markdown)
      setStatus({ phase: 'copied' })
    } catch {
      // no clipboard (http, permissions): the text is on screen to select by hand
      setStatus({ phase: 'idle' })
    }
  }

  const download = () => {
    const built = draft()
    downloadBlob(
      new Blob([JSON.stringify(built.wire, null, 2)], { type: 'application/json' }),
      `nexus-report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    )
  }

  return (
    <DialogShell
      labelledBy="report-title"
      titleId="report-title"
      testId="report-dialog"
      legacyBackdropClass="feedback-backdrop report-backdrop"
      legacyPanelClass="report-dialog"
      kickerIcon="clipboard"
      kickerLabel={t('system', 'report_kicker')}
      title={t('system', 'report_title')}
      topRight={<CloseButton variant="plain" size="md" onClick={onClose} />}
      onBackdropClick={onClose}
      actions={
        <div className="report-actions">
          <div className="report-actions-secondary">
            <Button size="sm" variant="ghost" data-testid="report-copy" onClick={() => void copy()}>
              <Icon name="clipboard" size={12} /> {t('system', 'report_copy')}
            </Button>
            <Button size="sm" variant="ghost" data-testid="report-download" onClick={download}>
              <Icon name="download" size={12} /> {t('system', 'report_download')}
            </Button>
          </div>
          <div className="report-actions-primary">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('common', 'close')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-testid="report-send"
              disabled={!connected || status.phase === 'sending'}
              onClick={() => void send()}>
              {status.phase === 'sending' ? t('system', 'report_sending') : t('system', 'report_send')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="report-body">
        <Tabs
          variant="segmented"
          size="sm"
          label={t('system', 'report_title')}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'bug', label: t('system', 'report_kind_bug'), testId: 'report-tab-bug' },
            { id: 'feedback', label: t('system', 'report_kind_feedback'), testId: 'report-tab-feedback' },
          ]}
        />

        <label className="report-field">
          <span className="report-field-label">{t('system', 'report_what')}</span>
          <textarea
            className="report-textarea"
            rows={4}
            value={text}
            placeholder={t('system', 'report_placeholder')}
            data-testid="report-text"
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <Checkbox
          checked={withGame}
          onChange={setWithGame}
          inputTestId="report-with-game"
          label={t('system', 'report_include_data')}
          description={t('system', 'report_include_data_hint')}
        />

        <p className="report-status" data-testid="report-status">
          {status.phase === 'sent' && !status.stored && <span className="report-status-warn">{status.detail}</span>}
          {status.phase === 'sent' && status.stored && <span>{status.detail}</span>}
          {status.phase === 'copied' && <span>{t('system', 'report_copied')}</span>}
          {status.phase === 'idle' && (connected ? t('system', 'report_ready') : t('system', 'report_offline'))}
        </p>

        {dump !== null && (
          <textarea className="report-dump" rows={6} readOnly value={dump} data-testid="report-dump" />
        )}
      </div>
    </DialogShell>
  )
}
