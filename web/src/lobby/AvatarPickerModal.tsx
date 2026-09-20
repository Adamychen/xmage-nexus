import CloseButton from '../ui/CloseButton'
import Button from '../ui/Button'
import ChipButton from '../ui/ChipButton'
import { useState } from 'react'
import { OFFICIAL_AVATARS } from './avatars'
import AvatarImage from './AvatarImage'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import './AvatarPickerModal.css'

interface AvatarPickerModalProps {
  selectedAvatarId: number
  onSelect: (avatarId: number) => void
  onClose: () => void
}

export default function AvatarPickerModal({
  selectedAvatarId,
  onSelect,
  onClose,
}: AvatarPickerModalProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'all' | 'standard' | 'special'>('all')

  const filteredAvatars = OFFICIAL_AVATARS.filter((a) => {
    if (filter === 'standard') return !a.isSpecial
    if (filter === 'special') return !!a.isSpecial
    return true
  })

  return (
    <DialogShell
      labelledBy="avatar-picker-title"
      titleId="avatar-picker-title"
      size="lg"
      legacyBackdropClass="overlay"
      legacyPanelClass="dialog avatar-picker-dialog"
      kickerIcon="user"
      kickerLabel={filter === 'all' ? t('lobby', 'avatar_filter_all', { count: OFFICIAL_AVATARS.length }) : filter === 'standard' ? t('lobby', 'avatar_filter_standard') : t('lobby', 'avatar_filter_special')}
      title={t('lobby', 'avatar_pick_title')}
      message={t('lobby', 'avatar_desc')}
      topRight={(
        <CloseButton variant="solid" size="lg" className="avatar-picker-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
    >
        {/* Filter Chips */}
        <div className="avatar-picker-tabs">
          <ChipButton pill active={filter === 'all'} onClick={() => setFilter('all')}>
            {t('lobby', 'avatar_filter_all', { count: OFFICIAL_AVATARS.length })}
          </ChipButton>
          <ChipButton pill active={filter === 'standard'} onClick={() => setFilter('standard')}>
            {t('lobby', 'avatar_filter_standard')}
          </ChipButton>
          <ChipButton pill active={filter === 'special'} onClick={() => setFilter('special')}>
            <Icon name="sparkles" size={12} /> {t('lobby', 'avatar_filter_special')}
          </ChipButton>
        </div>

        {/* Avatars Grid */}
        <div className="avatar-picker-grid">
          {filteredAvatars.map((a) => {
            const isSelected = a.id === selectedAvatarId
            return (
              <div
                key={a.id}
                className={`avatar-picker-item ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(a.id)
                  onClose()
                }}
              >
                <div className="avatar-item-img-wrap">
                  <AvatarImage avatarId={a.id} size="large" />
                  {isSelected && <span className="avatar-selected-check">✓</span>}
                  {a.isSpecial && <span className="avatar-special-spark"><Icon name="sparkles" size={12} /></span>}
                </div>
                <span className="avatar-item-name">{a.nameKey ? t(`lobby.${a.nameKey}`) : a.name}</span>
              </div>
            )
          })}
        </div>

        <div className="avatar-picker-footer">
          <Button onClick={onClose}>
            {t('common', 'cancel')}
          </Button>
        </div>
    </DialogShell>
  )
}
