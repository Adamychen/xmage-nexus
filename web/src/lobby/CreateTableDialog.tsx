import CloseButton from '../ui/CloseButton'
import { useCreateTableForm } from './CreateTable/useCreateTableForm'
import GeneralTab from './CreateTable/GeneralTab'
import DraftTab from './CreateTable/DraftTab'
import TimingTab from './CreateTable/TimingTab'
import SecurityTab from './CreateTable/SecurityTab'
import SeatsTab from './CreateTable/SeatsTab'
import ReviewTab from './CreateTable/ReviewTab'
import DevTab from './CreateTable/DevTab'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import './CreateTableDialog.css'
import Button from '../ui/Button'

import type { CreateKind, CreateTab } from './CreateTable/constants'

export * from './CreateTable/constants'
export type { CreateTableForm } from './CreateTable/useCreateTableForm'

const STEP_DESC_KEY = {
  general: 'create_step_desc_general',
  draft: 'create_step_desc_draft',
  timing: 'create_step_desc_timing',
  security: 'create_step_desc_security',
  seats: 'create_step_desc_seats',
  review: 'create_step_desc_review',
  dev: 'dev_subtitle',
} as const satisfies Record<CreateTab, string>

export default function CreateTableDialog({ onClose, onEditDeck, kind = 'match' }: { onClose: () => void; onEditDeck?: (deckId: string) => void; kind?: CreateKind }) {
  const { t, tError } = useTranslation()
  const form = useCreateTableForm(onClose, kind)
  const { wizardSteps, activeTab, activeIndex, goNext, goPrev, goToStep, isLastStep, isFirstStep } = form
  const stepMessage = t('lobby', STEP_DESC_KEY[activeTab])

  return (
    <DialogShell
      labelledBy="create-table-title"
      titleId="create-table-title"
      size="lg"
      legacyPanelClass="dialog create-table-dialog"
      kickerIcon={wizardSteps[activeIndex]?.icon ?? 'settings'}
      kickerLabel={t('lobby', 'create_wizard_step_of', { current: activeIndex + 1, total: wizardSteps.length })}
      title={kind === 'tourney' ? t('lobby', 'create_tournament_title') : t('lobby.create_table_btn')}
      message={stepMessage}
      topRight={(
        <CloseButton variant="plain" size="md" className="create-dialog-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      onEscape={onClose}
    >
        <nav className="wizard-stepper" aria-label={t('lobby', 'create_wizard_nav_aria')}>
          {wizardSteps.map((step, idx) => {
            const isActive = idx === activeIndex
            const isCompleted = idx < activeIndex
            const label = step.labelKey ? t('lobby', step.labelKey) : step.titleFallback
            return (
              <button
                key={step.id}
                type="button"
                className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => goToStep(step.id)}
                aria-current={isActive ? 'step' : undefined}
                title={label}
              >
                <span className="wizard-step-circle">
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span className="wizard-step-label">
                  <span className="wizard-step-icon"><Icon name={step.icon} size={13} /></span>
                  <span className="wizard-step-text">{label}</span>
                </span>
                {idx < wizardSteps.length - 1 && <span className={`wizard-connector ${isCompleted ? 'done' : ''}`} />}
              </button>
            )
          })}
        </nav>

        <div className="create-table-body">
          {activeTab === 'general' && <GeneralTab form={form} />}
          {activeTab === 'draft' && <DraftTab form={form} />}
          {activeTab === 'timing' && <TimingTab form={form} />}
          {activeTab === 'security' && <SecurityTab form={form} />}
          {activeTab === 'seats' && (
            <SeatsTab
              form={form}
              // Editing a deck navigates out of the wizard: `DeckBuilder` is not
              // a Modal, so a wizard left mounted (hidden or underneath) would
              // keep `Modal`'s Tab trap, which only defers to another Modal
              // with a higher z. Closing is simpler than fighting focus; the
              // form is lost, the deck is not.
              onEditDeck={onEditDeck ? (id) => { onEditDeck(id); onClose() } : undefined}
            />
          )}
          {activeTab === 'review' && <ReviewTab form={form} />}
          {activeTab === 'dev' && <DevTab form={form} />}
        </div>

        {form.error && <div className="error-box"><Icon name="alert" size={14} /> {tError(form.error)}</div>}

        <div className="dialog-actions wizard-actions">
          <div className="wizard-actions-left">
            {!isFirstStep && (
              <Button onClick={goPrev} disabled={form.busy}>
                {t('lobby','wizard_back')}
              </Button>
            )}
            <Button onClick={onClose} disabled={form.busy}>
              {t('common','cancel')}
            </Button>
          </div>
          <div className="wizard-actions-right">
            <Button
              variant={isLastStep ? 'primary' : 'ghost'}
              type="button"
              className="create-submit-btn"
              disabled={form.busy || !!form.compatibilityError || !form.name.trim()}
              onClick={() => void form.submit()}
              title={form.compatibilityError || undefined}
            >
              {form.busy
                ? `${t('lobby','create_table_btn')}…`
                : form.isDraftLimited
                ? (<><Icon name="layers" size={13} /> {t('lobby','create_submit_draft')}</>)
                : form.isConstructedTournament
                ? (<><Icon name="trophy" size={13} /> {t('lobby','create_submit_tournament_constructed')}</>)
                : (<><Icon name="play" size={13} /> {t('lobby','create_table_btn')}</>)}
            </Button>
            {!isLastStep && (
              <Button variant="primary" type="button" onClick={goNext} disabled={form.busy}>
                {t('lobby','wizard_next')}
              </Button>
            )}
          </div>
        </div>
    </DialogShell>
  )
}
