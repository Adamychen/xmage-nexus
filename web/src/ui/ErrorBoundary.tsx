import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { t } from '../i18n'
import Button from '../ui/Button'
import { addLog } from '../state/state'
import { recordError } from '../system/errorLog'
import { buildReport, reportToMarkdown } from '../system/report'
import { downloadBlob } from '../utils/download'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  copied: boolean
}

/**
 * Recovery screen for render errors: if any component blows up, the player sees a message and a
 * way out instead of a dead tab (GPU/WebGL failures usually look like a frozen tab; with this
 * there is at least feedback and an exit).
 *
 * It also offers the report as text. A crash is exactly the moment the page cannot send anything
 * over itself, so the escape hatch is a copy/download of the same bundle, not a network call.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, copied: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[error-boundary]', error, info.componentStack)
    recordError('boundary', `${error.message}${info.componentStack ?? ''}`)
  }

  private copyReport() {
    const draft = buildReport('bug', `Page crashed: ${this.state.error?.message ?? 'unknown'}`)
    const markdown = reportToMarkdown(draft)
    addLog('system', 'report copied to the clipboard')
    void navigator.clipboard
      ?.writeText(markdown)
      .then(() => this.setState({ copied: true }))
      .catch(() => this.setState({ copied: false }))
  }

  private downloadReport() {
    const draft = buildReport('bug', `Page crashed: ${this.state.error?.message ?? 'unknown'}`)
    downloadBlob(
      new Blob([JSON.stringify(draft.wire, null, 2)], { type: 'application/json' }),
      `nexus-crash_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    )
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash-screen">
        <h1>{t('common', 'crash_title')}</h1>
        <p>{t('common', 'crash_desc')}</p>
        <pre>{String(this.state.error?.message ?? this.state.error)}</pre>
        <div className="crash-actions">
          <Button variant="secondary" onClick={() => this.copyReport()}>
            {this.state.copied ? t('system', 'report_copied') : t('system', 'report_copy')}
          </Button>
          <Button variant="secondary" onClick={() => this.downloadReport()}>
            {t('system', 'report_download')}
          </Button>
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('common', 'reload')}
          </Button>
        </div>
        <p className="crash-hint">{t('system', 'report_offline')}</p>
      </div>
    )
  }
}
