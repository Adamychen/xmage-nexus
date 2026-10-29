import type { ReactNode } from 'react'
import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import { RatedField, SkillField, WinsField } from './RuleFields'
import { BufferTimeField, TimeLimitField } from './TimingTab'
import { BannedUsersField, PasswordField, RatingFields, RollbackField, SpectatorsField } from './SecurityTab'
import { ConstructionTimeField, DraftTimingField, SingleGameField } from './DraftTab'
import { GameTypeField } from './TypeFields'
import type { CreateTableForm } from './types'

function RulesPanel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="trn-panel" aria-labelledby={id}>
      <h3 className="trn-panel-title" id={id}>{title}</h3>
      {children}
    </section>
  )
}

/** The Rules step: the options the proxy applies to a tournament, in matches, draft rules and access panels; the rare ones folded into Advanced. */
export default function TourneyRulesStep({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const changed = form.rollbackTurnsAllowed ? 0 : 1

  return (
    <div className="create-tab-content trn-rules">
      <div className={`trn-rules-grid${form.isDraftLimited ? '' : ' trn-rules-grid--stacked'}`}>
        <div className="trn-rules-col">
          <RulesPanel id="trn-rules-matches" title={t('lobby', 'trn_e_panel_matches')}>
            <WinsField form={form} />
            <TimeLimitField form={form} />
            <BufferTimeField form={form} />
          </RulesPanel>

          {form.isDraftLimited && (
            <RulesPanel id="trn-rules-draft" title={t('lobby', 'trn_e_panel_draft')}>
              <div className="create-grid-2col">
                <ConstructionTimeField form={form} />
                <DraftTimingField form={form} />
              </div>
              <SingleGameField form={form} />
            </RulesPanel>
          )}
        </div>

        <div className="trn-rules-col">
          <RulesPanel id="trn-rules-access" title={t('lobby', 'trn_e_fact_access')}>
            <PasswordField form={form} />
            <RatingFields form={form} />
            <SkillField form={form} />
            <RatedField form={form} />
            <SpectatorsField form={form} />
            <BannedUsersField form={form} />
          </RulesPanel>
        </div>
      </div>

      <details className="trn-advanced">
        <summary className="trn-advanced-summary">
          <span className="trn-advanced-title"><Icon name="settings" size={13} /> {t('lobby', 'trn_e_panel_advanced')}</span>
          {changed > 0 && <span className="trn-advanced-changed">{t('lobby', 'trn_e_advanced_changed', { count: changed })}</span>}
          <span className="trn-advanced-chevron"><Icon name="chevronDown" size={13} /></span>
        </summary>
        <div className="trn-advanced-body">
          {!form.isDraftLimited && <GameTypeField form={form} />}
          <RollbackField form={form} />
        </div>
      </details>
    </div>
  )
}
