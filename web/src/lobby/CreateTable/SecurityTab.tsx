import { useTranslation } from '../../i18n'
import IconButton from '../../ui/IconButton'
import Checkbox from '../../ui/Checkbox'
import Icon from '../../ui/Icon'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'
import Collapsible from './Collapsible'

export default function SecurityTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const restricted = form.minimumRating > 0 || form.quitRatio < 100 || (form.isMultiplayerGame && form.edhPowerLevel < 100)
  const restrictionSummary = [
    form.minimumRating > 0 ? `${t('lobby','create_field_min_rating')} ≥ ${form.minimumRating}` : null,
    form.quitRatio < 100 ? `${t('lobby','create_field_quit_ratio')} ${form.quitRatio}%` : null,
    form.isMultiplayerGame && form.edhPowerLevel < 100 ? `EDH ${form.edhPowerLevel}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="create-tab-content">
      <Field label={t('lobby','create_field_password')}>
        <div className="password-field-wrap">
          <input
            type={form.showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => form.setPassword(e.target.value)}
            placeholder={t('lobby','placeholder_password')}
          />
          <IconButton label={form.showPassword ? t('lobby','create_password_hide') : t('lobby','create_password_show')} size="lg" onClick={() => form.setShowPassword(!form.showPassword)}>
            {form.showPassword ? <Icon name="eyeOff" size={14} /> : <Icon name="eye" size={14} />}
          </IconButton>
        </div>
      </Field>

      <Collapsible
        title={<><Icon name="shield" size={13} /> {t('lobby','create_tab_restrictions')}</>}
        summary={restricted ? restrictionSummary : t('common','all')}
        defaultOpen={restricted}
      >
        <div className="create-restrictions-box">
          <div className="create-grid-2col">
            <Field label={t('lobby','create_field_min_rating')} hint={form.minimumRating > 0 ? `${t('lobby','create_field_min_rating')}: ≥ ${form.minimumRating}` : t('common','all')}>
              <input
                type="number"
                min={0}
                max={3000}
                step={50}
                value={form.minimumRating}
                onChange={(e) => form.setMinimumRating(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder={t('common','all')}
              />
            </Field>

            <Field label={t('lobby','create_field_quit_ratio')} hint={form.quitRatio < 100 ? `${t('lobby','create_field_quit_ratio')}: ${form.quitRatio}%` : t('common','all')}>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={form.quitRatio}
                onChange={(e) => form.setQuitRatio(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                placeholder={t('common','all')}
              />
            </Field>
          </div>

          {form.isMultiplayerGame && (
            <Field label={t('lobby','create_field_edh_power')} hint={form.edhPowerLevel < 100 ? `EDH Power: ${form.edhPowerLevel}` : `${t('common','all')} ${t('lobby','create_edh_no_limit')}`}>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={form.edhPowerLevel}
                onChange={(e) => form.setEdhPowerLevel(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                placeholder={t('common','all')}
              />
            </Field>
          )}
        </div>
      </Collapsible>

      <Field label={t('lobby','create_field_banned_users')}>
        <input
          value={form.bannedUsersRaw}
          onChange={(e) => form.setBannedUsersRaw(e.target.value)}
          placeholder={t('lobby','placeholder_banned_users')}
        />
      </Field>

      <Checkbox
        card
        checked={form.spectatorsAllowed}
        onChange={form.setSpectatorsAllowed}
        icon="eye"
        label={t('lobby','create_field_spectators')}
        description={t('lobby','create_desc_spectators')}
      />

      <Checkbox
        card
        checked={form.rollbackTurnsAllowed}
        onChange={form.setRollbackTurnsAllowed}
        icon="undo"
        label={t('lobby','create_field_rollback')}
        description={t('lobby','create_desc_rollback')}
      />
    </div>
  )
}
