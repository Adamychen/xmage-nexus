import { useTranslation } from '../../i18n'
import Checkbox from '../../ui/Checkbox'
import Icon from '../../ui/Icon'
import type { CreateTableForm } from './useCreateTableForm'
import Button from '../../ui/Button'

export default function DevTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3><Icon name="settings" size={15} /> {t('lobby','dev_title')}</h3>
        <p>{t('lobby','dev_subtitle')}</p>
      </div>
      <div className="dev-options-notice">
        <span><Icon name="alert" size={12} /> {t('lobby','dev_notice')}</span>
      </div>

      <div className="dev-demo-box">
        <h4>{t('lobby','dev_demo_title')}</h4>
        <p>{t('lobby','dev_demo_desc')}</p>
        <Button variant="primary"
          type="button"
          className="dev-demo-btn"
          onClick={() => void form.runDemoTable()}
          disabled={form.busy}
        >
          <Icon name="play" size={13} /> {t('lobby','watch_btn')} ({t('lobby','ai')} vs {t('lobby','ai')})
        </Button>
      </div>

      <Checkbox
        card
        checked={form.skipInitShuffling}
        onChange={form.setSkipInitShuffling}
        icon="layers"
        label={t('lobby','create_toggle_skip_shuffle')}
        description={t('lobby','dev_skip_shuffle_desc')}
      />

      <Checkbox
        card
        checked={form.skipStartingPlayerChoice}
        onChange={form.setSkipStartingPlayerChoice}
        icon="dice"
        label={t('lobby','create_toggle_skip_starting')}
        description={t('lobby','dev_skip_starting_desc')}
      />
    </div>
  )
}
