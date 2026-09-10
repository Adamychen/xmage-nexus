import { useTranslation } from '../i18n'
import DialogShell from '../ui/DialogShell'
import DownloadPanel from './DownloadPanel'
import './DownloadImagesDialog.css'

export interface DownloadImagesDialogProps {
  onClose: () => void
}

export default function DownloadImagesDialog({ onClose }: DownloadImagesDialogProps) {
  const { t } = useTranslation()

  return (
    <DialogShell
      labelledBy="download-title"
      titleId="download-title"
      size="lg"
      legacyBackdropClass="download-dialog-backdrop"
      legacyPanelClass="download-dialog"
      kickerIcon="download"
      kickerLabel={t('dialogs', 'download_source')}
      title={<>{t('dialogs', 'download_title')} (XMage Downloader)</>}
      topRight={(
        <button type="button" className="download-dialog-close" onClick={onClose} title={t('common', 'close')} aria-label={t('common', 'close')}>
          ✕
        </button>
      )}
      onBackdropClick={onClose}
    >
      <DownloadPanel showClearCache showCloseButton onClose={onClose} />
    </DialogShell>
  )
}
