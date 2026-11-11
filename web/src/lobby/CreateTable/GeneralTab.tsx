import Icon from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import Field from '../../ui/Field'
import Select from '../../ui/Select'
import TypeFields from './TypeFields'
import { RatedField, SkillField, WinsField } from './RuleFields'
import type { CreateTableForm } from './types'

/** The match wizard's first step: name, game type and format, and the match rules. */
export default function GeneralTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()

  const playersField = form.selectedGameTypeInfo && form.selectedGameTypeInfo.minPlayers !== form.selectedGameTypeInfo.maxPlayers && (
    <Field label={t('lobby','create_field_num_players')} hint={t('lobby', 'create_hint_min_max', { min: form.selectedGameTypeInfo.minPlayers, max: form.selectedGameTypeInfo.maxPlayers })}>
      <Select
        value={form.numPlayers}
        onChange={form.setNumPlayers}
        options={Array.from({ length: form.selectedGameTypeInfo.maxPlayers - form.selectedGameTypeInfo.minPlayers + 1 }, (_, i) => {
          const n = form.selectedGameTypeInfo!.minPlayers + i
          return { value: n, label: t('lobby','staging_seats_count',{count:n}) }
        })}
      />
    </Field>
  )

  return (
    <div className="create-tab-content">
      <div className="create-general-col">
        <Field label={t('lobby','create_field_table_name')}>
          <input
            value={form.name}
            onChange={(e) => form.setName(e.target.value)}
            maxLength={64}
            placeholder={t('lobby','placeholder_table_name')}
          />
        </Field>
        <TypeFields form={form} className="format-fields format-fields--stack" />
        {form.isLimited && (
          <div className="wizard-hint-box wizard-hint-box--warn wizard-hint-box--spaced">
            <Icon name="alert" size={13} /> {t('lobby', 'create_limited_match_hint')}
          </div>
        )}
        <WinsField form={form} />
        {playersField}
        <SkillField form={form} />
        <RatedField form={form} />
      </div>
    </div>
  )
}
