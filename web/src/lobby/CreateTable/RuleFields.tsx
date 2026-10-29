import ChipButton from '../../ui/ChipButton'
import Checkbox from '../../ui/Checkbox'
import Field from '../../ui/Field'
import Icon from '../../ui/Icon'
import Tabs from '../../ui/Tabs'
import { useTranslation } from '../../i18n'
import { SKILL_LEVEL_OPTIONS } from './constants'
import type { CreateTableForm } from './types'

export function WinsField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Field group label={t('lobby', 'create_field_wins_needed')}>
      <Tabs
        variant="segmented"
        size="sm"
        label={t('lobby', 'create_field_wins_needed')}
        value={String(form.wins)}
        onChange={(id) => form.setWins(Number(id))}
        items={[1, 2, 3, 4, 5].map((wins) => ({ id: String(wins), label: `Bo${wins * 2 - 1}` }))}
      />
    </Field>
  )
}

export function SkillField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Field group label={t('lobby', 'create_field_skill')}>
      <div className="chip-row">
        {SKILL_LEVEL_OPTIONS.map((opt) => {
          const label = opt.value === 'BEGINNER' ? t('lobby', 'create_skill_beginner') : opt.value === 'CASUAL' ? t('lobby', 'create_skill_casual') : t('lobby', 'create_skill_competitive')
          return (
            <ChipButton
              pill
              active={form.skillLevel === opt.value}
              key={opt.value}
              onClick={() => form.setSkillLevel(opt.value)}
            >
              {Array.from({ length: opt.stars }, (_, i) => <Icon key={i} name="star" size={11} />)} {label}
            </ChipButton>
          )
        })}
      </div>
    </Field>
  )
}

export function RatedField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Checkbox
      card
      checked={form.rated}
      onChange={form.setRated}
      icon="star"
      label={t('lobby', 'create_field_rated')}
      description={t('lobby', 'create_desc_rated')}
    />
  )
}
