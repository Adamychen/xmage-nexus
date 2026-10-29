import { useState } from 'react'
import CloseButton from '../ui/CloseButton'
import { useCreateTableForm } from './CreateTable/useCreateTableForm'
import GeneralTab from './CreateTable/GeneralTab'
import TourneyFormatStep from './CreateTable/TourneyFormatStep'
import TourneyRulesStep from './CreateTable/TourneyRulesStep'
import TimingTab from './CreateTable/TimingTab'
import SecurityTab from './CreateTable/SecurityTab'
import SeatsTab from './CreateTable/SeatsTab'
import TourneySeatsStep from './CreateTable/TourneySeatsStep'
import ReviewTab from './CreateTable/ReviewTab'
import TourneySummary from './CreateTable/TourneySummary'
import DevTab from './CreateTable/DevTab'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import './CreateTableDialog.css'
import Button from '../ui/Button'
import { tourneySummaries } from './CreateTable/tourneyFormat'

import type { CreateKind, CreateTab } from './CreateTable/constants'

export * from './CreateTable/constants'
export type { CreateTableForm } from './CreateTable/useCreateTableForm'

const STEP_DESC_KEY = {
  general: 'create_step_desc_general',
  format: 'trn_step_desc_format',
  rules: 'trn_step_desc_rules',
  timing: 'create_step_desc_timing',
  security: 'create_step_desc_security',
  seats: 'create_step_desc_seats',
  review: 'create_step_desc_review',
  dev: 'dev_subtitle',
} as const satisfies Record<CreateTab, string>

type CreateTableDialogProps = { onClose: () => void; onEditDeck?: (deckId: string) => void; kind?: CreateKind }

export default function CreateTableDialog(props: CreateTableDialogProps) {
  // "Reset to defaults" remounts the body so every hook initializer runs again
  const [generation, setGeneration] = useState(0)
  return <CreateTableDialogBody key={generation} {...props} onReset={() => setGeneration((g) => g + 1)} />
}

function CreateTableDialogBody({ onClose, onEditDeck, kind = 'match', onReset }: CreateTableDialogProps & { onReset: () => void }) {
  const { t, tError } = useTranslation()
  const form = useCreateTableForm(onClose, kind, onReset)
  const { wizardSteps, activeTab, activeIndex, goNext, goPrev, goToStep, isLastStep, isFirstStep } = form
  const tourney = kind === 'tourney'
  const stepMessage = t('lobby', STEP_DESC_KEY[activeTab])
  const submitBlockedBy = form.busy ? null : form.validateStep(wizardSteps[0].id)
  const inlineError = form.error ?? submitBlockedBy
  const editDeck = onEditDeck ? (id: string) => { onEditDeck(id); onClose() } : undefined
  const tourneyLines = tourney
    ? tourneySummaries({ tournamentType: form.tournamentType, numPlayers: form.numPlayers, wins: form.wins, timeLimit: form.timeLimit }, t)
    : null

  const stepSummary = (id: CreateTab): string => {
    if (tourneyLines && (id === 'format' || id === 'rules' || id === 'seats')) return tourneyLines[id]
    if (id === 'general') return form.name.trim()
    if (id === 'seats') return form.myDeck?.name ?? ''
    return ''
  }

  const submitLabel = tourney
    ? t('lobby', 'trn_submit')
    : t('lobby', 'create_table_btn')
  const submitButton = (
    <Button
      variant={isLastStep ? 'primary' : 'ghost'}
      type="button"
      className="create-submit-btn"
      disabled={form.busy || !!submitBlockedBy}
      onClick={() => void form.submit()}
      title={submitBlockedBy || undefined}
    >
      {form.busy
        ? `${submitLabel}…`
        : tourney
        ? (<><Icon name="trophy" size={13} /> {submitLabel}</>)
        : form.isDraftLimited
        ? (<><Icon name="layers" size={13} /> {t('lobby','create_submit_draft')}</>)
        : form.isConstructedTournament
        ? (<><Icon name="trophy" size={13} /> {t('lobby','create_submit_tournament_constructed')}</>)
        : (<><Icon name="play" size={13} /> {t('lobby','create_table_btn')}</>)}
    </Button>
  )
  const nextButton = (
    <Button variant="primary" type="button" onClick={goNext} disabled={form.busy}>
      {t('lobby','wizard_next')}
    </Button>
  )

  const stepBody = (
    <>
      {activeTab === 'general' && <GeneralTab form={form} />}
      {activeTab === 'format' && <TourneyFormatStep form={form} />}
      {activeTab === 'rules' && <TourneyRulesStep form={form} />}
      {activeTab === 'timing' && <TimingTab form={form} />}
      {activeTab === 'security' && <SecurityTab form={form} />}
      {activeTab === 'seats' && (tourney
        // Editing a deck navigates out of the wizard: `DeckBuilder` is not
        // a Modal, so a wizard left mounted (hidden or underneath) would
        // keep `Modal`'s Tab trap, which only defers to another Modal
        // with a higher z. Closing is simpler than fighting focus; the
        // form is lost, the deck is not.
        ? <TourneySeatsStep form={form} onEditDeck={editDeck} />
        : <SeatsTab form={form} onEditDeck={editDeck} />)}
      {activeTab === 'review' && <ReviewTab form={form} />}
      {activeTab === 'dev' && <DevTab form={form} />}
    </>
  )

  return (
    <DialogShell
      labelledBy="create-table-title"
      titleId="create-table-title"
      size="lg"
      ornate
      legacyPanelClass={tourney ? 'dialog create-table-dialog create-table-dialog--tourney' : 'dialog create-table-dialog'}
      title={kind === 'tourney' ? t('lobby', 'create_tournament_title') : t('lobby.create_table_btn')}
      message={stepMessage}
      topRight={(
        <CloseButton variant="plain" size="md" className="create-dialog-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      onEscape={onClose}
    >
        <nav className={`wizard-stepper${tourney ? ' wizard-stepper--tourney' : ''}`} aria-label={t('lobby', 'create_wizard_nav_aria')}>
          {wizardSteps.map((step, idx) => {
            const isActive = idx === activeIndex
            const isCompleted = idx < activeIndex
            const label = step.labelKey ? t('lobby', step.labelKey) : step.titleFallback
            const stepError = form.validateStep(step.id)
            const summary = tourney || isActive ? stepSummary(step.id) : ''
            return (
              <button
                key={step.id}
                type="button"
                className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${stepError ? 'has-error' : ''}`}
                onClick={() => goToStep(step.id)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={stepError ? `${label}: ${tError(stepError)}` : undefined}
                title={label}
              >
                <span className="wizard-step-circle">
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span className="wizard-step-label">
                  <span className="wizard-step-icon"><Icon name={step.icon} size={13} /></span>
                  <span className="wizard-step-text">{label}</span>
                  {summary && <span className="wizard-step-summary">{summary}</span>}
                </span>
                {idx < wizardSteps.length - 1 && <span className={`wizard-connector ${isCompleted ? 'done' : ''}`} />}
              </button>
            )
          })}
        </nav>

        <div className="create-table-body">
          {tourney ? (
            <div className="trn-layout">
              <div className="trn-layout-main">{stepBody}</div>
              <TourneySummary form={form} />
            </div>
          ) : stepBody}
        </div>

        {inlineError && <div className="error-box"><Icon name="alert" size={14} /> {tError(inlineError)}</div>}

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
            <Button variant="ghost" size="sm" type="button" onClick={form.resetToDefaults} disabled={form.busy}>
              {t('lobby','create_reset_defaults')}
            </Button>
          </div>
          <div className="wizard-actions-right">
            {tourney ? (
              isLastStep ? submitButton : nextButton
            ) : (
              <>
                {submitButton}
                {!isLastStep && nextButton}
              </>
            )}
          </div>
        </div>
    </DialogShell>
  )
}
