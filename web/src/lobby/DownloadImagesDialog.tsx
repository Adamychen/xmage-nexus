import { useState, useEffect } from 'react'
import {
  imageDownloader,
  POPULAR_SETS,
  type DownloadSource,
  type DownloadScope,
  type DownloadProgress,
  type CacheStats,
} from '../services/imageDownloader'
import './DownloadImagesDialog.css'

export interface DownloadImagesDialogProps {
  onClose: () => void
}

export default function DownloadImagesDialog({ onClose }: DownloadImagesDialogProps) {
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
    if (window.confirm('¿Seguro que deseas eliminar todas las imágenes y símbolos de la caché local?')) {
      await imageDownloader.clearCache()
      await updateStats()
    }
  }

  const handleDownloadSymbols = async () => {
    setSymbolsBusy(true)
    setSymbolsStatus('Descargando símbolos oficiales de Scryfall...')
    const res = await imageDownloader.downloadSymbols((done, total) => {
      setSymbolsStatus(`Descargando símbolos: ${done}/${total}`)
    })
    setSymbolsBusy(false)
    if (res.success) {
      setSymbolsStatus(`✓ ¡${res.count} símbolos de maná y fases guardados en local!`)
      await updateStats()
    } else {
      setSymbolsStatus('❌ Error al descargar los símbolos.')
    }
    setTimeout(() => setSymbolsStatus(null), 5000)
  }

  const isRunning = progress.status === 'running' || progress.status === 'fetching_list'
  const isPaused = progress.status === 'paused'
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0
  const mbInDisk = (cacheStats.estimatedBytes / (1024 * 1024)).toFixed(1)

  return (
    <div className="download-dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="download-dialog panel" role="dialog" aria-label="Descargar Imágenes y Símbolos">
        <header className="download-dialog-header">
          <div className="download-dialog-title">
            <span className="download-header-icon">📥</span>
            <h2>Descargar Imágenes y Símbolos (XMage Downloader)</h2>
          </div>
          <button type="button" className="download-dialog-close" onClick={onClose} title="Cerrar ventana" aria-label="Cerrar ventana">
            ✕
          </button>
        </header>

        <div className="download-dialog-body">
          {/* Configuration Form */}
          <div className="download-form-grid">
            <div className="form-group">
              <label htmlFor="dl-source">Fuente de descarga (Source):</label>
              <select
                id="dl-source"
                value={source}
                disabled={isRunning}
                onChange={(e) => setSource(e.target.value as DownloadSource)}
                className="download-select"
              >
                <option value="scryfall_normal">Scryfall (Normal - Calidad recomendada, ~10 GB)</option>
                <option value="scryfall_large">Scryfall (Large / HD - Alta definición, ~15 GB)</option>
                <option value="scryfall_small">Scryfall (Small - Miniaturas ligeras, ~1.5 GB)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dl-scope">Expansión / Alcance (Sets):</label>
              <select
                id="dl-scope"
                value={scope}
                disabled={isRunning}
                onChange={(e) => setScope(e.target.value as DownloadScope)}
                className="download-select"
              >
                <optgroup label="Colecciones y Formatos">
                  <option value="ALL">- ALL images from selected source (Todas las cartas de MTG)</option>
                  <option value="STANDARD">- STANDARD (Formato Estándar actual)</option>
                  <option value="MODERN">- MODERN (Formato Modern)</option>
                  <option value="COMMANDER">- COMMANDER (Staples principales)</option>
                  <option value="MY_DECKS">- MIS MAZOS (Todas las cartas de tus mazos guardados)</option>
                  <option value="BASIC_LANDS">- TIERRAS BÁSICAS (Llanura, Isla, Pantano, etc.)</option>
                  <option value="TOKENS">- FICHAS Y EMBLEMAS</option>
                </optgroup>
                <optgroup label="Expansiones Recientes">
                  {POPULAR_SETS.map((s) => (
                    <option key={s.code} value={s.code}>
                      [{s.code}] {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dl-threads">Hilos concurrentes (Threads):</label>
              <select
                id="dl-threads"
                value={concurrency}
                disabled={isRunning}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="download-select"
              >
                <option value={1}>1 hilo (Bajo consumo de red)</option>
                <option value={2}>2 hilos (Moderado)</option>
                <option value={5}>5 hilos (Recomendado)</option>
                <option value={10}>10 hilos (Rápido)</option>
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
                <span>Solo descargar imágenes faltantes (evita re-descargar cartas existentes)</span>
              </label>
            </div>
          </div>

          {/* Symbology section */}
          <div className="download-symbology-box">
            <div className="symbology-info">
              <span className="symbology-icon">🔮</span>
              <div>
                <strong>Símbolos de Maná y Fases</strong>
                <p>Descarga todos los símbolos oficiales (WUBRG, números, giro, pirexiano, etc.) para juego instantáneo offline.</p>
              </div>
            </div>
            <button
              type="button"
              className="download-symbology-btn"
              disabled={symbolsBusy || isRunning}
              onClick={handleDownloadSymbols}
            >
              {symbolsBusy ? 'Descargando...' : 'Descargar Símbolos (1 MB)'}
            </button>
          </div>
          {symbolsStatus && <div className="symbology-status-banner">{symbolsStatus}</div>}

          {/* Progress & Live Stats */}
          <div className="download-progress-section">
            <div className="progress-header">
              <span className="progress-status-label">
                {progress.status === 'fetching_list' && '🔍 Consultando índice de cartas...'}
                {progress.status === 'running' && '⬇️ Descargando cartas...'}
                {progress.status === 'paused' && '⏸️ Descarga pausada'}
                {progress.status === 'done' && '✅ Descarga completada'}
                {progress.status === 'error' && '❌ Error en la descarga'}
                {progress.status === 'idle' && 'Listo para descargar'}
              </span>
              <span className="progress-pct-val">{pct}%</span>
            </div>

            <div className="progress-track-bar">
              <div className="progress-fill-bar" style={{ width: `${pct}%` }} />
            </div>

            <div className="progress-details-row">
              <span className="current-card-text" title={progress.currentItem}>
                {progress.currentItem || 'Selecciona un set y pulsa Iniciar Descarga.'}
              </span>
              {progress.total > 0 && (
                <span className="count-stats-text">
                  {progress.completed} / {progress.total}
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="download-metrics-row">
              <div className="metric-pill">
                <span className="metric-icon">⚡</span>
                <span className="metric-label">Velocidad:</span>
                <span className="metric-val">{progress.speedCardsPerSec} c/s</span>
              </div>
              <div className="metric-pill">
                <span className="metric-icon">💾</span>
                <span className="metric-label">En Disco:</span>
                <span className="metric-val">{cacheStats.cardCount} cartas ({mbInDisk} MB)</span>
              </div>
              <div className="metric-pill">
                <span className="metric-icon">🔮</span>
                <span className="metric-label">Símbolos:</span>
                <span className="metric-val">{cacheStats.symbolCount}</span>
              </div>
              {progress.failed > 0 && (
                <div className="metric-pill error">
                  <span className="metric-icon">⚠️</span>
                  <span className="metric-label">Fallos:</span>
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
            title="Borrar todas las imágenes de la caché local"
          >
            🧹 Limpiar Caché
          </button>

          <div className="footer-action-buttons">
            {isRunning && (
              <>
                <button type="button" className="download-btn-pause" onClick={handlePause}>
                  ⏸ Pausar
                </button>
                <button type="button" className="download-btn-cancel" onClick={handleCancel}>
                  ⏹ Cancelar
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button type="button" className="download-btn-primary" onClick={handleResume}>
                  ▶ Reanudar
                </button>
                <button type="button" className="download-btn-cancel" onClick={handleCancel}>
                  ⏹ Cancelar
                </button>
              </>
            )}

            {!isRunning && !isPaused && (
              <button type="button" className="download-btn-primary" onClick={handleStart}>
                ▶ Iniciar Descarga
              </button>
            )}

            <button type="button" className="download-btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
