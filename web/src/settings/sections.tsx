import { useState, type ReactNode } from 'react'
import { useSettings, setSetting } from '../state/store'
import IconButton from '../ui/IconButton'
import CloseButton from '../ui/CloseButton'
import { useTranslation } from '../i18n'
import { SLEEVES } from '../appearance/sleeves'
import { APPEARANCE_CHOICES } from '../appearance/appearanceChoice'
import CustomSleeveTile from '../appearance/CustomSleeveTile'
import CustomCardArtManager from '../appearance/CustomCardArtManager'
import BoardDemo from './BoardDemo'
import BoardLivePreview from './BoardLivePreview'
import LayoutDemo from './LayoutDemo'
import OptionPreview, { type OptionPreviewKind } from './OptionPreview'
import PlaymatPicker from '../appearance/PlaymatPicker'
import { ZOOM_PRESETS, isZoomPreset, stepZoom, zoomPercent } from '../appearance/zoom'
import SoundFxControls from './SoundFxControls'
import PresetPicker from './PresetPicker'
import { boardLayoutChoiceOf, chooseBoardLayout, type BoardLayoutChoice } from './boardLayoutChoice'
import { HAND_RAIL_MAX_W, HAND_RAIL_MIN_W, KEYWORD_AURA_MODES, KEYWORD_ICON_SETS, PT_BADGE_MODES, SICKNESS_STYLES } from '../board/cardOverlays'
import Button from '../ui/Button'
import { CARD_STYLES, TAP_STYLES } from '../board/compactCard'
import { CARD_PREVIEW_SCALE_DEFAULT, CARD_PREVIEW_SCALE_MAX, CARD_PREVIEW_SCALE_MIN, CARD_PREVIEW_SCALE_STEP, cardPreviewPercent, normalizeCardPreviewScale } from '../board/cardPreviewScale'
import { saveBoardRewind, saveBrowserNotifications, saveGameLogAutoSave, saveTurnRecap, type ManaPaymentStored } from '../state/persistence'
import { clearRewind } from '../game/rewind'
import { notificationsSupported, requestNotificationPermission } from '../game/attentionAlerts'
import { clearAutoAnswers, removeAutoAnswer } from '../game/autoAnswers'
import { PhaseStopGrid } from '../game/PhaseStopSelector'
import { togglePhaseStop } from '../game/phaseStops'
import Icon from '../ui/Icon'
import { BOARD_TABS, type BoardTab } from './settingsIndex'
import { Segmented, SettingsGroup, SettingsRow, SwitchRow, pickerColumns } from './settingsUi'
import '../game/GameMenu.css'
import '../game/PhaseStopSelector.css'
import './SettingsModal.css'
import '../appearance/SleevePickerModal.css'

export const LAYOUTS: Array<{ id: BoardLayoutChoice; labelKey: string; descKey: string }> = [
  { id: 'standard', labelKey: 'board_standard', descKey: 'board_standard_desc' },
  { id: 'pod', labelKey: 'board_pod', descKey: 'board_pod_desc' },
  { id: 'arena', labelKey: 'board_arena', descKey: 'board_arena_desc' },
  { id: 'table', labelKey: 'board_table', descKey: 'board_table_desc' },
]

export function LanguageSection() {
  const { t, lang, setLanguage, languages, cardLang, setCardLanguage, cardLanguages } = useTranslation()
  return (
    <SettingsGroup>
      <SettingsRow id="ui-language" label={t('common', 'language')} hint={t('lobby', 'settings_ui_lang_hint')}>
        {({ controlId, hintId }) => (
          <select
            id={controlId}
            className="settings-select"
            value={lang}
            aria-describedby={hintId}
            onChange={(e) => setLanguage(e.target.value as Parameters<typeof setLanguage>[0])}
            data-testid="settings-ui-lang"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        )}
      </SettingsRow>
      <SettingsRow id="card-language" label={t('common', 'card_language')} hint={t('lobby', 'settings_card_lang_hint')}>
        {({ controlId, hintId }) => (
          <select
            id={controlId}
            className="settings-select"
            value={cardLang}
            aria-describedby={hintId}
            onChange={(e) => setCardLanguage(e.target.value)}
            data-testid="settings-card-lang"
          >
            {cardLanguages.map((cl) => (
              <option key={cl.code} value={cl.code}>{cl.name}</option>
            ))}
          </select>
        )}
      </SettingsRow>
    </SettingsGroup>
  )
}

export function InterfaceSection() {
  const { t, lang } = useTranslation()
  const settings = useSettings()
  const cjkLang = lang === 'ja' || lang === 'zhs'
  const preset = ZOOM_PRESETS.find((value) => isZoomPreset(settings.uiScale, value))
  return (
    <>
      <SettingsGroup title={t('lobby', 'scheme_title')}>
        <SettingsRow id="theme" label={t('lobby', 'settings_theme')} hint={t('lobby', 'scheme_hint')}>
          {({ labelId }) => (
            <Segmented
              labelledBy={labelId}
              value={settings.appearance}
              onChange={(choice) => setSetting('appearance', choice)}
              options={APPEARANCE_CHOICES.map((choice) => ({
                id: choice,
                label: t('lobby', `scheme_${choice}`),
                testId: `settings-appearance-${choice}`,
              }))}
            />
          )}
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title={t('lobby', 'settings_group_size')}>
        <SettingsRow id="ui-scale" label={t('lobby', 'ui_scale_title')} hint={t('lobby', 'ui_scale_hint')}>
          {({ labelId }) => (
            <div className="settings-zoom">
              <button
                type="button"
                className="settings-step-value"
                onClick={() => setSetting('uiScale', 1)}
                title={t('lobby', 'zoom_reset')}
                data-testid="settings-zoom-current"
              >
                {zoomPercent(settings.uiScale)}%
              </button>
              <IconButton label={t('lobby', 'zoom_out')} size="sm"
                onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, -1))}
                data-testid="settings-zoom-minus">
                −
              </IconButton>
              <Segmented
                labelledBy={labelId}
                value={preset == null ? null : String(preset)}
                onChange={(value) => setSetting('uiScale', Number(value))}
                options={ZOOM_PRESETS.map((value) => ({
                  id: String(value),
                  label: `${Math.round(value * 100)}%`,
                  testId: `settings-zoom-${String(value).replace('.', '-')}`,
                }))}
              />
              <IconButton label={t('lobby', 'zoom_in')} size="sm"
                onClick={() => setSetting('uiScale', stepZoom(settings.uiScale, 1))}
                data-testid="settings-zoom-plus">
                +
              </IconButton>
            </div>
          )}
        </SettingsRow>
        <CardPreviewSizeControl />
        <SwitchRow
          id="cjk-boost"
          checked={settings.cjkBoost}
          onChange={(v) => setSetting('cjkBoost', v)}
          label={t('lobby', 'cjk_boost_label')}
          disabled={!cjkLang}
          hint={cjkLang ? undefined : t('lobby', 'cjk_boost_only')}
        />
      </SettingsGroup>
      <SettingsGroup title={t('lobby', 'settings_group_dialogs')}>
        <SwitchRow
          id="transparent-dialogs"
          checked={settings.transparentDialogs}
          onChange={(v) => setSetting('transparentDialogs', v)}
          label={t('lobby', 'dialog_backdrop_label')}
          hint={t('lobby', 'dialog_backdrop_hint')}
        />
      </SettingsGroup>
    </>
  )
}

function CardPreviewSizeControl() {
  const { t } = useTranslation()
  const { cardPreviewScale } = useSettings()
  const percent = cardPreviewPercent(cardPreviewScale)
  return (
    <SettingsRow
      id="card-preview-size"
      label={t('lobby', 'card_preview_size_title')}
      hint={t('lobby', 'card_preview_size_hint')}
      testId="settings-card-preview-size"
    >
      {({ controlId, hintId }) => (
        <>
          <input
            id={controlId}
            type="range"
            min={CARD_PREVIEW_SCALE_MIN}
            max={CARD_PREVIEW_SCALE_MAX}
            step={CARD_PREVIEW_SCALE_STEP}
            className="audio-slider"
            value={normalizeCardPreviewScale(cardPreviewScale)}
            aria-describedby={hintId}
            aria-valuetext={`${percent}%`}
            data-testid="settings-card-preview-scale"
            onChange={(e) => setSetting('cardPreviewScale', normalizeCardPreviewScale(Number(e.target.value)))}
          />
          <span className="settings-row-value" data-testid="settings-card-preview-value">{percent}%</span>
          <IconButton
            label={t('lobby', 'card_preview_size_reset')}
            size="sm"
            disabled={percent === 100}
            onClick={() => setSetting('cardPreviewScale', CARD_PREVIEW_SCALE_DEFAULT)}
            icon="reset"
            data-testid="settings-card-preview-reset"
          />
        </>
      )}
    </SettingsRow>
  )
}

interface PickerOption<T extends string> {
  id: T
  label: string
  desc?: string
  demo: ReactNode
  testId: string
}

function Picker<T extends string>({ settingId, title, hint, value, options, onPick, disabled = false }: {
  settingId: string
  title: string
  hint: string
  value: T
  options: ReadonlyArray<PickerOption<T>>
  onPick: (id: T) => void
  disabled?: boolean
}) {
  return (
    <SettingsGroup title={title} hint={hint} settingId={settingId} className="settings-picker">
      <div className="settings-cards" style={pickerColumns(options.length)}>
        {options.map((o) => (
          <Button
            key={o.id}
            variant="ghost"
            disabled={disabled}
            className={`settings-card ${value === o.id ? 'selected' : ''}`}
            onClick={() => onPick(o.id)}
            aria-pressed={value === o.id}
            data-testid={o.testId}
          >
            {o.demo}
            <span className="settings-card-label">{o.label}</span>
            {o.desc && <span className="settings-card-desc">{o.desc}</span>}
            {value === o.id && <span className="settings-card-check" aria-hidden="true">✓</span>}
          </Button>
        ))}
      </div>
    </SettingsGroup>
  )
}

function OptionSwitch({ id, kind, label, hint, value, onChange }: {
  id: string
  kind: OptionPreviewKind
  label: string
  hint: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <SwitchRow
      id={id}
      label={label}
      hint={hint}
      checked={value}
      onChange={onChange}
      testId={`option-switch-${kind}`}
      extra={<span className="settings-row-thumb"><OptionPreview kind={kind} on={value} /></span>}
    />
  )
}

function LayoutTab() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <>
      <Picker
        settingId="board-layout"
        title={t('lobby', 'appearance_board_title')}
        hint={t('lobby', 'appearance_board_hint')}
        value={boardLayoutChoiceOf(settings)}
        onPick={chooseBoardLayout}
        options={LAYOUTS.map((l) => ({
          id: l.id,
          label: t('lobby', l.labelKey as 'board_standard'),
          desc: t('lobby', l.descKey as 'board_standard_desc'),
          demo: <LayoutDemo layout={l.id} />,
          testId: `settings-layout-${l.id}`,
        }))}
      />
      <SettingsGroup title={t('lobby', 'settings_group_field_hand')}>
        <OptionSwitch id="board-fill" kind="boardFill" label={t('lobby', 'board_fill_show')} hint={t('lobby', 'board_fill_show_hint')}
          value={settings.boardFill} onChange={(v) => setSetting('boardFill', v)} />
        <OptionSwitch id="board-spotlight" kind="boardSpotlight" label={t('lobby', 'board_spotlight_show')} hint={t('lobby', 'board_spotlight_show_hint')}
          value={settings.boardSpotlight} onChange={(v) => setSetting('boardSpotlight', v)} />
        <OptionSwitch id="hand-rail" kind="handRail" label={t('lobby', 'hand_rail_show')} hint={t('lobby', 'hand_rail_show_hint')}
          value={settings.handRail} onChange={(v) => setSetting('handRail', v)} />
        <OptionSwitch id="hand-row" kind="handRow" label={t('lobby', 'hand_row_show')} hint={t('lobby', 'hand_row_show_hint')}
          value={settings.handRow} onChange={(v) => setSetting('handRow', v)} />
        {(settings.handRail || settings.handRow) && (
          <SettingsRow id="hand-rail-width" label={t('lobby', 'hand_rail_width')}>
            {({ controlId }) => (
              <>
                <input
                  id={controlId}
                  type="range"
                  min={HAND_RAIL_MIN_W}
                  max={HAND_RAIL_MAX_W}
                  step={10}
                  className="audio-slider"
                  value={settings.handRailWidth}
                  data-testid="hand-rail-width"
                  onChange={(e) => setSetting('handRailWidth', Number(e.target.value))}
                />
                <span className="settings-row-value">{settings.handRailWidth}px</span>
              </>
            )}
          </SettingsRow>
        )}
      </SettingsGroup>
    </>
  )
}

function CardsTab() {
  const { t } = useTranslation()
  const settings = useSettings()
  const rendered = settings.cardRender === 'rendered'
  return (
    <>
      <Picker
        settingId="card-style"
        title={t('lobby', 'card_style_title')}
        hint={rendered ? t('lobby', 'card_style_rendered_note') : t('lobby', 'card_style_hint')}
        value={settings.cardStyle}
        disabled={rendered}
        onPick={(style) => setSetting('cardStyle', style)}
        options={CARD_STYLES.map((style) => ({
          id: style,
          label: t('lobby', `card_style_${style}`),
          desc: t('lobby', `card_style_${style}_desc`),
          demo: <BoardDemo spec={{ kind: 'cardStyle', value: style }} />,
          testId: `settings-card-style-${style}`,
        }))}
      />
      <Picker
        settingId="tap-style"
        title={t('lobby', 'tap_style_title')}
        hint={t('lobby', 'tap_style_hint')}
        value={settings.tapStyle}
        onPick={(style) => setSetting('tapStyle', style)}
        options={TAP_STYLES.map((style) => ({
          id: style,
          label: t('lobby', `tap_style_${style}`),
          desc: t('lobby', `tap_style_${style}_desc`),
          demo: <BoardDemo spec={{ kind: 'tapStyle', value: style }} />,
          testId: `settings-tap-style-${style}`,
        }))}
      />
      <SettingsGroup title={t('lobby', 'settings_group_card_text')}>
        <OptionSwitch id="card-render" kind="rendered" label={t('lobby', 'card_render_show')} hint={t('lobby', 'card_render_show_hint')}
          value={rendered} onChange={(v) => setSetting('cardRender', v ? 'rendered' : 'image')} />
        {!rendered && (
          <OptionSwitch id="stack-caption" kind="stackCaption" label={t('lobby', 'stack_caption_show')} hint={t('lobby', 'stack_caption_show_hint')}
            value={settings.stackCaption} onChange={(v) => setSetting('stackCaption', v)} />
        )}
      </SettingsGroup>
      <SettingsGroup title={t('lobby', 'custom_card_art_title')} hint={t('lobby', 'custom_card_art_hint')} settingId="custom-card-art" className="settings-picker">
        <CustomCardArtManager />
      </SettingsGroup>
    </>
  )
}

function OverlaysTab() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <>
      <Picker
        settingId="pt-badge"
        title={t('lobby', 'pt_badge_title')}
        hint={t('lobby', 'pt_badge_hint')}
        value={settings.ptBadgeMode}
        onPick={(mode) => setSetting('ptBadgeMode', mode)}
        options={PT_BADGE_MODES.map((mode) => ({
          id: mode,
          label: t('lobby', `pt_badge_${mode}`),
          desc: t('lobby', `pt_badge_${mode}_desc`),
          demo: <BoardDemo spec={{ kind: 'ptBadge', value: mode }} />,
          testId: `settings-pt-badge-${mode}`,
        }))}
      />
      <Picker
        settingId="sickness-style"
        title={t('lobby', 'sickness_style_title')}
        hint={t('lobby', 'sickness_style_hint')}
        value={settings.sicknessStyle}
        onPick={(style) => setSetting('sicknessStyle', style)}
        options={SICKNESS_STYLES.map((style) => ({
          id: style,
          label: t('lobby', `sickness_style_${style}`),
          desc: t('lobby', `sickness_style_${style}_desc`),
          demo: <BoardDemo spec={{ kind: 'sickness', value: style }} />,
          testId: `settings-sickness-style-${style}`,
        }))}
      />
      <Picker
        settingId="keyword-icons"
        title={t('lobby', 'keyword_icons_title')}
        hint={t('lobby', 'keyword_icons_hint')}
        value={settings.keywordIcons}
        onPick={(set) => setSetting('keywordIcons', set)}
        options={KEYWORD_ICON_SETS.map((set) => ({
          id: set,
          label: t('lobby', `keyword_icons_${set}`),
          desc: t('lobby', `keyword_icons_${set}_desc`),
          demo: <BoardDemo spec={{ kind: 'keywordIcons', value: set }} />,
          testId: `settings-keyword-icons-${set}`,
        }))}
      />
      <Picker
        settingId="keyword-aura"
        title={t('lobby', 'keyword_aura_title')}
        hint={t('lobby', 'keyword_aura_hint')}
        value={settings.keywordAura}
        onPick={(mode) => setSetting('keywordAura', mode)}
        options={KEYWORD_AURA_MODES.map((mode) => ({
          id: mode,
          label: t('lobby', `keyword_aura_${mode}`),
          desc: t('lobby', `keyword_aura_${mode}_desc`),
          demo: <BoardDemo spec={{ kind: 'keywordAura', value: mode }} />,
          testId: `settings-keyword-aura-${mode}`,
        }))}
      />
      <SettingsGroup title={t('lobby', 'card_overlays_title')} hint={t('lobby', 'card_overlays_hint')}>
        <OptionSwitch id="hand-cost" kind="handCost" label={t('lobby', 'hand_cost_show')} hint={t('lobby', 'hand_cost_show_hint')}
          value={settings.showHandCost} onChange={(v) => setSetting('showHandCost', v)} />
        <OptionSwitch id="mana-source" kind="manaSource" label={t('lobby', 'mana_source_show')} hint={t('lobby', 'mana_source_show_hint')}
          value={settings.showManaSource} onChange={(v) => setSetting('showManaSource', v)} />
      </SettingsGroup>
    </>
  )
}

function TableTab() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <>
      <SettingsGroup title={t('lobby', 'playmat_title')} hint={t('lobby', 'playmat_hint')} settingId="playmat" className="settings-picker">
        <PlaymatPicker testIdPrefix="settings-playmat" />
      </SettingsGroup>
      <SettingsGroup title={t('lobby', 'sleeve_pick_title')} hint={t('lobby', 'sleeve_pick_subtitle')} settingId="sleeve" className="settings-picker">
        <div className="appearance-sleeve-grid">
          {SLEEVES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sleeve-item ${settings.sleeveId === s.id ? 'selected' : ''}`}
              aria-pressed={settings.sleeveId === s.id}
              onClick={() => setSetting('sleeveId', s.id)}
              data-testid={`settings-sleeve-${s.id}`}
              title={s.name}
            >
              <div className="sleeve-preview" style={s.kind === 'css' ? { background: s.css } : undefined}>
                {s.kind === 'css' ? (
                  <span className="sleeve-preview-emblem" style={{ color: s.accent }}>{s.emblem}</span>
                ) : (
                  <img src={s.imageUrl} alt={s.name} draggable={false} />
                )}
                {settings.sleeveId === s.id && <span className="sleeve-check">✓</span>}
              </div>
              <span className="sleeve-name">{s.name}</span>
            </button>
          ))}
          <CustomSleeveTile selectedId={settings.sleeveId} testIdPrefix="settings-sleeve" />
        </div>
      </SettingsGroup>
    </>
  )
}

const TAB_LABEL: Record<BoardTab, 'settings_board_tab_layout' | 'settings_board_tab_cards' | 'settings_board_tab_overlays' | 'settings_board_tab_table'> = {
  layout: 'settings_board_tab_layout',
  cards: 'settings_board_tab_cards',
  overlays: 'settings_board_tab_overlays',
  table: 'settings_board_tab_table',
}

/** SET-7: four tabs next to a live preview. Controlled by the settings dialog (search jumps to a tab), uncontrolled in the setup wizard. */
export function BoardSection({ tab, onTabChange }: { tab?: BoardTab; onTabChange?: (tab: BoardTab) => void } = {}) {
  const { t } = useTranslation()
  const settings = useSettings()
  const [ownTab, setOwnTab] = useState<BoardTab>('layout')
  const current = tab ?? ownTab
  const pick = onTabChange ?? setOwnTab
  return (
    <div className="settings-board" data-testid="settings-board" data-tab={current}>
      <div className="settings-board-tabs">
        <Segmented
          label={t('lobby', 'settings_board')}
          value={current}
          onChange={pick}
          options={BOARD_TABS.map((id) => ({ id, label: t('lobby', TAB_LABEL[id]), testId: `settings-board-tab-${id}` }))}
        />
      </div>
      <div className="settings-board-body">
        <div className="settings-board-options" data-testid={`settings-board-tab-panel-${current}`}>
          {current === 'layout' && <LayoutTab />}
          {current === 'cards' && <CardsTab />}
          {current === 'overlays' && <OverlaysTab />}
          {current === 'table' && <TableTab />}
        </div>
        <aside className="settings-board-preview">
          {current === 'layout' ? (
            <figure className="board-live-preview" data-testid="board-layout-preview">
              <figcaption className="settings-group-title">{t('lobby', 'settings_live_preview')}</figcaption>
              <LayoutDemo layout={boardLayoutChoiceOf(settings)} />
              <p className="settings-group-hint">{t('lobby', LAYOUTS.find((l) => l.id === boardLayoutChoiceOf(settings))!.descKey as 'board_standard_desc')}</p>
            </figure>
          ) : (
            <BoardLivePreview />
          )}
        </aside>
      </div>
    </div>
  )
}

export function SoundSection() {
  return (
    <div className="settings-sound" data-testid="settings-sound-card">
      <SoundFxControls />
    </div>
  )
}

export function GameplaySection() {
  const { t } = useTranslation()
  const settings = useSettings()
  const [permission, setPermission] = useState<NotificationPermission | null>(() =>
    notificationsSupported() ? Notification.permission : null,
  )
  const manaRows: Array<{ id: string; key: keyof ManaPaymentStored; label: string; tip: string }> = [
    { id: 'mana-auto', key: 'auto', label: t('game', 'mana_payment_auto'), tip: t('game', 'mana_payment_auto_tip') },
    { id: 'mana-restricted', key: 'restricted', label: t('game', 'mana_payment_restricted'), tip: t('game', 'mana_payment_restricted_tip') },
    { id: 'mana-first', key: 'useFirstAbility', label: t('game', 'mana_payment_first'), tip: t('game', 'mana_payment_first_tip') },
    { id: 'mana-confirm', key: 'confirmEmptyPool', label: t('game', 'mana_payment_confirm'), tip: t('game', 'mana_payment_confirm_tip') },
    { id: 'mana-smart', key: 'smart', label: t('game', 'mana_payment_smart'), tip: t('game', 'mana_payment_smart_tip') },
  ]
  return (
    <>
      <SettingsGroup title={t('game', 'presets_title')} hint={t('game', 'presets_hint')} settingId="gameplay-preset" className="settings-picker">
        <PresetPicker />
      </SettingsGroup>
      <SettingsGroup title={t('game', 'automation')}>
        <SwitchRow
          id="hold-priority"
          checked={settings.holdPriority}
          onChange={(v) => setSetting('holdPriority', v)}
          label={t('game', 'hold_priority')}
          hint={t('game', 'hold_priority_title')}
        />
        <SwitchRow
          id="smart-stops"
          checked={settings.smartStops}
          onChange={(v) => setSetting('smartStops', v)}
          label={t('game', 'smart_stops')}
          hint={t('game', 'smart_stops_hint')}
        />
        <SwitchRow
          id="auto-mulligan"
          checked={settings.autoKeepMulligan}
          onChange={(v) => setSetting('autoKeepMulligan', v)}
          label={t('game', 'auto_mulligan')}
          hint={t('lobby', 'settings_auto_mulligan_hint')}
        />
      </SettingsGroup>
      <SettingsGroup title={t('lobby', 'settings_group_history')}>
        <SwitchRow
          id="log-autosave"
          checked={settings.gameLogAutoSave}
          onChange={(v) => {
            setSetting('gameLogAutoSave', v)
            saveGameLogAutoSave(v)
          }}
          label={t('system', 'log_autosave')}
          hint={t('system', 'log_autosave_hint')}
        />
        <SwitchRow
          id="board-rewind"
          checked={settings.boardRewind}
          onChange={(v) => {
            setSetting('boardRewind', v)
            saveBoardRewind(v)
            if (!v) clearRewind()
          }}
          label={t('game', 'rewind_setting')}
          hint={t('game', 'rewind_setting_hint')}
        />
        <SwitchRow
          id="turn-recap"
          checked={settings.turnRecap}
          onChange={(v) => {
            setSetting('turnRecap', v)
            saveTurnRecap(v)
          }}
          label={t('game', 'recap_setting')}
          hint={t('game', 'recap_setting_hint')}
          testId="settings-turn-recap"
        />
        {notificationsSupported() && (
          <SwitchRow
            id="browser-notifications"
            checked={settings.browserNotifications}
            onChange={(v) => {
              setSetting('browserNotifications', v)
              saveBrowserNotifications(v)
              if (v) void requestNotificationPermission().then((p) => setPermission(p))
            }}
            label={t('game', 'notify_setting')}
            hint={(
              <>
                {t('game', 'notify_setting_hint')}
                {settings.browserNotifications && permission === 'denied' && (
                  <span className="settings-row-warn" data-testid="notify-blocked">
                    <Icon name="warning" size={13} /> {t('game', 'notify_blocked')}
                  </span>
                )}
              </>
            )}
          />
        )}
      </SettingsGroup>
      <SettingsGroup title={t('game', 'mana_payment_title')}>
        {manaRows.map((row) => (
          <SwitchRow
            key={row.key}
            id={row.id}
            checked={settings.manaPayment[row.key]}
            onChange={() => setSetting('manaPayment', { ...settings.manaPayment, [row.key]: !settings.manaPayment[row.key] })}
            label={row.label}
            hint={row.tip}
          />
        ))}
      </SettingsGroup>
      <SettingsGroup title={t('game', 'phase_stops_default_title')} hint={t('game', 'phase_stops_default_hint')} settingId="phase-stops">
        <div className="settings-item phase-stop-selector settings-phase-stops" data-testid="settings-phase-stops">
          <PhaseStopGrid
            value={settings.phaseStops}
            onToggle={(turn, key) => setSetting('phaseStops', togglePhaseStop(settings.phaseStops, turn, key))}
            idPrefix="settings"
            showStepNames
          />
        </div>
      </SettingsGroup>
      <SettingsGroup title={t('game', 'auto_answers_title', { count: settings.autoAnswers.length })} settingId="auto-answers">
        {settings.autoAnswers.length === 0 && (
          <div className="settings-item settings-empty" data-testid="settings-auto-answers-empty">
            <span className="settings-empty-icon"><Icon name="chat" size={18} /></span>
            <span className="settings-row-text">
              <span className="settings-row-label">{t('lobby', 'settings_auto_answers_none')}</span>
              <span className="settings-row-hint">{t('lobby', 'settings_auto_answers_how', { remember: t('game', 'auto_answer_remember') })}</span>
            </span>
          </div>
        )}
        {settings.autoAnswers.map((rule) => (
          <div key={rule.id} className="settings-item settings-auto-row">
            <span className="settings-auto-text" title={rule.pattern}>{rule.pattern}</span>
            <span className={`settings-auto-badge ${rule.answer ? 'is-yes' : 'is-no'}`}>
              {rule.answer ? t('common', 'yes') : t('common', 'no')}
            </span>
            <CloseButton
              variant="danger"
              size="sm"
              label={t('game', 'auto_answers_delete', { pattern: rule.pattern })}
              onClick={() => setSetting('autoAnswers', removeAutoAnswer(settings.autoAnswers, rule.id))}
            />
          </div>
        ))}
        {settings.autoAnswers.length > 0 && (
          <div className="settings-item settings-auto-clear">
            <Button variant="link" size="sm" onClick={() => setSetting('autoAnswers', clearAutoAnswers())}>
              {t('game', 'auto_answers_clear')}
            </Button>
          </div>
        )}
      </SettingsGroup>
    </>
  )
}

export function GameplayQuickSection() {
  const { t } = useTranslation()
  const settings = useSettings()
  return (
    <>
      <SettingsGroup title={t('game', 'presets_title')} hint={t('game', 'presets_hint')} settingId="gameplay-preset" className="settings-picker">
        <PresetPicker />
      </SettingsGroup>
      <SettingsGroup title={t('game', 'automation')}>
        <SwitchRow
          id="smart-stops"
          checked={settings.smartStops}
          onChange={(v) => setSetting('smartStops', v)}
          label={t('game', 'smart_stops')}
          hint={t('game', 'smart_stops_hint')}
        />
        <SwitchRow
          id="auto-mulligan"
          checked={settings.autoKeepMulligan}
          onChange={(v) => setSetting('autoKeepMulligan', v)}
          label={t('game', 'auto_mulligan')}
          hint={t('lobby', 'settings_auto_mulligan_hint')}
        />
        <SwitchRow
          id="mana-auto"
          checked={settings.manaPayment.auto}
          onChange={() => setSetting('manaPayment', { ...settings.manaPayment, auto: !settings.manaPayment.auto })}
          label={t('game', 'mana_payment_auto')}
          hint={t('game', 'mana_payment_auto_tip')}
        />
      </SettingsGroup>
    </>
  )
}
