import { useState, useEffect } from 'react'
import {
  imageDownloader,
  POPULAR_SETS,
  type DownloadSource,
  type DownloadScope,
  type DownloadProgress,
  type CacheStats,
} from '../services/imageDownloader'
import { useTranslation } from '../i18n'
import './DownloadImagesDialog.css'

export interface DownloadImagesDialogProps {
  onClose: () => void
}

export default function DownloadImagesDialog({ onClose }: DownloadImagesDialogProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState<DownloadSource>('scryfall_normal')
  const [scope, setScope] = useState<DownloadScope>('STANDARD')
  const [concurrency, setConcurrency] = useState<number>(5)
  const [onlyMissing, setOnlyMissing] = useState<boolean>(true)
  const [progress, setProgress] = useState<DownloadProgress>(imageDownloader.getProgress())
  const [cacheStats, setCacheStats] = useState<CacheStats>({ cardCount: 0, symbolCount: 0, estimatedBytes: 0 })
  const [symbolsBusy, setSymbolsBusy] = useState<boolean>(false)
  const [symbolsStatus, setSymbolsStatus] = useState<string | null>(null)

  useEffect(() => {
    const unsub = imageDownloader.subscribe(setProgress)
    void updateStats()
    return unsub
  }, [])

  const updateStats = async () => {
    const stats = await imageDownloader.getCacheStats()
    setCacheStats(stats)
  }

  const handleStart = () => {
    void imageDownloader.startDownload(scope, source, concurrency, onlyMissing)
  }

  const handlePause = () => {
    imageDownloader.pause()
  }

  const handleResume = () => {
    imageDownloader.resume(concurrency)
  }

  const handleCancel = () => {
    imageDownloader.cancel()
    void updateStats()
  }

  const handleClearCache = async () => {
    if (window.confirm(t('dialogs', 'download_clear') + '?')) {
      await imageDownloader.clearCache()
      await updateStats()
    }
  }

  const handleDownloadSymbols = async () => {
    setSymbolsBusy(true)
    setSymbolsStatus(t('dialogs','download_status_downloading'))
    const res = await imageDownloader.downloadSymbols((done, total) => {
      setSymbolsStatus(`${t('dialogs','download_status_downloading')} ${done}/${total}`)
    })
    setSymbolsBusy(false)
    if (res.success) {
      setSymbolsStatus(`✓ ${res.count} ${t('dialogs','download_metrics_symbols')}!`)
      await updateStats()
    } else {
      setSymbolsStatus(t('dialogs','download_status_error'))
    }
    setTimeout(() => setSymbolsStatus(null), 5000)
  }

  const isRunning = progress.status === 'running' || progress.status === 'fetching_list'
  const isPaused = progress.status === 'paused'
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0
  const mbInDisk = (cacheStats.estimatedBytes / (1024 * 1024)).toFixed(1)

  return (
    <div className="download-dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="download-dialog panel" role="dialog" aria-label={t('dialogs','download_title')}>
        <header className="download-dialog-header">
          <div className="download-dialog-title">
            <span className="download-header-icon">📥</span>
            <h2>{t('dialogs','download_title')} (XMage Downloader)</h2>
          </div>
          <button type="button" className="download-dialog-close" onClick={onClose} title={t('common','close')} aria-label={t('common','close')}>
            ✕
          </button>
        </header>

        <div className="download-dialog-body">
          <div className="download-form-grid">
            <div className="form-group">
              <label htmlFor="dl-source">{t('dialogs','download_source')}:</label>
              <select
                id="dl-source"
                value={source}
                disabled={isRunning}
                onChange={(e) => setSource(e.target.value as DownloadSource)}
                className="download-select"
              >
                <option value="scryfall_normal">{t('dialogs','download_option_scryfall_normal')}</option>
                <option value="scryfall_large">{t('dialogs','download_option_scryfall_large')}</option>
                <option value="scryfall_small">{t('dialogs','download_option_scryfall_small')}</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dl-scope">{t('dialogs','download_scope_label')}</label>
              <select
                id="dl-scope"
                value={scope}
                disabled={isRunning}
                onChange={(e) => setScope(e.target.value as DownloadScope)}
                className="download-select"
              >
                <optgroup label={t('dialogs','download_group_collections')}>
                  <option value="ALL">{t('dialogs','download_scope_all')}</option>
                  <option value="STANDARD">{t('dialogs','download_scope_standard')}</option>
                  <option value="MODERN">{t('dialogs','download_scope_modern')}</option>
                  <option value="COMMANDER">{t('dialogs','download_scope_commander')}</option>
                  <option value="MY_DECKS">{t('dialogs','download_scope_my_decks')}</option>
                  <option value="BASIC_LANDS">{t('dialogs','download_scope_basic_lands')}</option>
                  <option value="TOKENS">{t('dialogs','download_scope_tokens')}</option>
                </optgroup>
                <optgroup label={t('dialogs','download_group_recent')}>
                  {POPULAR_SETS.map((s) => (
                    <option key={s.code} value={s.code}>
                      [{s.code}] {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dl-threads">{t('dialogs','download_threads')}:</label>
              <select
                id="dl-threads"
                value={concurrency}
                disabled={isRunning}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="download-select"
              >
                <option value={1}>{t('dialogs','download_threads_1')}</option>
                <option value={2}>{t('dialogs','download_threads_2')}</option>
                <option value={5}>{t('dialogs','download_threads_5')}</option>
                <option value={10}>{t('dialogs','download_threads_10')}</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={onlyMissing}
                  disabled={isRunning}
                  onChange={(e) => setOnlyMissing(e.target.checked)}
                />
                <span>{t('dialogs','download_checkbox_only_missing')}</span>
              </label>
            </div>
          </div>

          <div className="download-symbology-box">
            <div className="symbology-info">
              <span className="symbology-icon">🔮</span>
              <div>
                <strong>{t('dialogs','download_symbology_title')}</strong>
                <p>{t('dialogs','download_symbology_desc')}</p>
              </div>
            </div>
            <button
              type="button"
              className="download-symbology-btn"
              disabled={symbolsBusy || isRunning}
              onClick={handleDownloadSymbols}
            >
              {symbolsBusy ? t('dialogs','download_status_downloading') : t('dialogs','download_symbols_btn')}
            </button>
          </div>
          {symbolsStatus && <div className="symbology-status-banner">{symbolsStatus}</div>}

          <div className="download-progress-section">
            <div className="progress-header">
              <span className="progress-status-label">
                {progress.status === 'fetching_list' && t('dialogs','download_progress_index')}
                {progress.status === 'running' && t('dialogs','download_status_downloading')}
                {progress.status === 'paused' && t('dialogs','download_pause')}
                {progress.status === 'done' && t('dialogs','download_status_done')}
                {progress.status === 'error' && t('dialogs','download_status_error')}
                {progress.status === 'idle' && t('common','done')}
              </span>
              <span className="progress-pct-val">{pct}%</span>
            </div>

            <div className="progress-track-bar">
              <div className="progress-fill-bar" style={{ width: `${pct}%` }} />
            </div>

            <div className="progress-details-row">
              <span className="current-card-text" title={progress.currentItem}>
                {progress.currentItem || t('dialogs','download_title')}
              </span>
              {progress.total > 0 && (
                <span className="count-stats-text">
                  {progress.completed} / {progress.total}
                </span>
              )}
            </div>

            <div className="download-metrics-row">
              <div className="metric-pill">
                <span className="metric-icon">⚡</span>
                <span className="metric-label">{t('dialogs','download_metrics_speed')}:</span>
                <span className="metric-val">{progress.speedCardsPerSec} c/s</span>
              </div>
              <div className="metric-pill">
                <span className="metric-icon">💾</span>
                <span className="metric-label">{t('dialogs','download_metrics_disk')}:</span>
                <span className="metric-val">{cacheStats.cardCount} ({mbInDisk} MB)</span>
              </div>
              <div className="metric-pill">
                <span className="metric-icon">🔮</span>
                <span className="metric-label">{t('dialogs','download_metrics_symbols')}:</span>
                <span className="metric-val">{cacheStats.symbolCount}</span>
              </div>
              {progress.failed > 0 && (
                <div className="metric-pill error">
                  <span className="metric-icon">⚠️</span>
                  <span className="metric-label">{t('dialogs','download_metrics_errors')}:</span>
                  <span className="metric-val">{progress.failed}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="download-dialog-footer">
          <button
            type="button"
            className="download-btn-clear"
            disabled={isRunning}
            onClick={handleClearCache}
            title={t('dialogs','download_clear_cache')}
          >
            🧹 {t('dialogs','download_clear_cache')}
          </button>

          <div className="footer-action-buttons">
            {isRunning && (
              <>
                <button type="button" className="download-btn-pause" onClick={handlePause}>
                  ⏸ {t('dialogs','download_pause_btn')}
                </button>
                <button type="button" className="download-btn-cancel" onClick={handleCancel}>
                  ⏹ {t('dialogs','download_cancel_btn')}
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button type="button" className="download-btn-primary" onClick={handleResume}>
                  ▶ {t('dialogs','download_resume_btn')}
                </button>
                <button type="button" className="download-btn-cancel" onClick={handleCancel}>
                  ⏹ {t('dialogs','download_cancel_btn')}
                </button>
              </>
            )}

            {!isRunning && !isPaused && (
              <button type="button" className="download-btn-primary" onClick={handleStart}>
                ▶ {t('dialogs','download_start_btn')}
              </button>
            )}

            <button type="button" className="download-btn-secondary" onClick={onClose}>
              {t('common','close')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
