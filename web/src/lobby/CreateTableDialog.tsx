import { useCreateTableForm } from './CreateTable/useCreateTableForm'
import GeneralTab from './CreateTable/GeneralTab'
import TimingTab from './CreateTable/TimingTab'
import SecurityTab from './CreateTable/SecurityTab'
import SeatsTab from './CreateTable/SeatsTab'
import DevTab from './CreateTable/DevTab'
import SummaryStrip from './CreateTable/SummaryStrip'
import { useTranslation } from '../i18n'
import './CreateTableDialog.css'

export * from './CreateTable/constants'
export type { CreateTableForm } from './CreateTable/useCreateTableForm'

export default function CreateTableDialog({ onClose }: { onClose: () => void }) {
  const { t, tError } = useTranslation()
  const form = useCreateTableForm(onClose)
  const { wizardSteps, activeTab, setActiveTab, activeIndex, goNext, goPrev, isLastStep, isFirstStep } = form

  return (
    <div className="overlay">
      <div className="dialog panel create-table-dialog">
        <div className="create-table-header">
          <div className="create-table-header-title">
            <h2>⚔️ {t('lobby.create_table_btn')}</h2>
            <span className="create-table-subtitle">{t('lobby','create_header_subtitle')}</span>
          </div>
          <button type="button" className="create-dialog-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="wizard-progress-track" aria-hidden>
          <div className="wizard-progress-fill" style={{ width: `${((activeIndex + 1) / wizardSteps.length) * 100}%` }} />
        </div>
        <div className="wizard-step-counter">
          Paso {activeIndex + 1} de {wizardSteps.length} · {wizardSteps[activeIndex]?.icon} {wizardSteps[activeIndex]?.labelKey ? t('lobby', wizardSteps[activeIndex].labelKey as any) : wizardSteps[activeIndex]?.titleFallback}
        </div>

        <nav className="wizard-stepper" aria-label="Pasos de creación de mesa">
          {wizardSteps.map((step, idx) => {
            const isActive = idx === activeIndex
            const isCompleted = idx < activeIndex
            const label = step.labelKey ? t('lobby', step.labelKey as any) : step.titleFallback
            return (
              <button
                key={step.id}
                type="button"
                className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => setActiveTab(step.id)}
                aria-current={isActive ? 'step' : undefined}
                title={label}
              >
                <span className="wizard-step-circle">
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span className="wizard-step-label">
                  <span className="wizard-step-icon">{step.icon}</span>
                  <span className="wizard-step-text">{label}</span>
                </span>
                {idx < wizardSteps.length - 1 && <span className={`wizard-connector ${isCompleted ? 'done' : ''}`} />}
              </button>
            )
          })}
        </nav>

        <div className="create-table-body">
          {activeTab === 'general' && <GeneralTab form={form} />}
          {activeTab === 'timing' && <TimingTab form={form} />}
          {activeTab === 'security' && <SecurityTab form={form} />}
          {activeTab === 'seats' && <SeatsTab form={form} />}
          {activeTab === 'dev' && <DevTab form={form} />}
        </div>

        <SummaryStrip form={form} />

        {form.error && <div className="error-box">⚠️ {tError(form.error)}</div>}

        <div className="dialog-actions wizard-actions">
          <div className="wizard-actions-left">
            {!isFirstStep && (
              <button type="button" onClick={goPrev} disabled={form.busy}>
                ← Atrás
              </button>
            )}
            <button type="button" onClick={onClose} disabled={form.busy}>
              {t('common','cancel')}
            </button>
          </div>
          <div className="wizard-actions-right">
            {!isLastStep ? (
              <button type="button" className="primary" onClick={goNext} disabled={form.busy}>
                Siguiente →
              </button>
            ) : (
              <button type="button" className="primary create-submit-btn" disabled={form.busy || !!form.compatibilityError || !form.name.trim()} onClick={() => void form.submit()} title={form.compatibilityError || undefined}>
                {form.busy ? `${t('lobby','create_table_btn')}…` : form.isDraftLimited ? `${t('lobby','create_submit_draft')} 🃏` : `${t('lobby','create_table_btn')} 🚀`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
