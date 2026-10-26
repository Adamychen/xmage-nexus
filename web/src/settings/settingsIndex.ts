import type { t as translate } from '../i18n'
import { getState } from '../state/store'
import { notificationsSupported } from '../game/attentionAlerts'

export type SettingsSection = 'gameplay' | 'board' | 'interface' | 'language' | 'sound'
export type BoardTab = 'layout' | 'cards' | 'overlays' | 'table'

type T = typeof translate

export interface SettingEntry {
  id: string
  section: SettingsSection
  tab?: BoardTab
  group: (t: T) => string
  label: (t: T) => string
  hint?: (t: T) => string
  /** Rendered only in some states; the search skips the entry while it is not. */
  available?: () => boolean
}

export const SECTION_ORDER: ReadonlyArray<{ group: 'game' | 'app'; ids: SettingsSection[] }> = [
  { group: 'game', ids: ['gameplay', 'board'] },
  { group: 'app', ids: ['interface', 'language', 'sound'] },
]

export const BOARD_TABS: BoardTab[] = ['layout', 'cards', 'overlays', 'table']

export function sectionTitle(t: T, section: SettingsSection): string {
  return t('lobby', `settings_${section}` as 'settings_board')
}

export function sectionDescription(t: T, section: SettingsSection): string {
  return t('lobby', `settings_desc_${section}` as 'settings_desc_board')
}

const automation = (t: T) => t('game', 'automation')
const history = (t: T) => t('lobby', 'settings_group_history')
const mana = (t: T) => t('game', 'mana_payment_title')
const size = (t: T) => t('lobby', 'settings_group_size')
const fieldHand = (t: T) => t('lobby', 'settings_group_field_hand')
const cardText = (t: T) => t('lobby', 'settings_group_card_text')
const overlays = (t: T) => t('lobby', 'card_overlays_title')
const animations = (t: T) => t('lobby', 'settings_group_animations')
const sound = (t: T) => t('lobby', 'settings_group_sound')
const music = (t: T) => t('lobby', 'settings_group_music')
const languages = (t: T) => t('lobby', 'settings_language')

export const SETTINGS_INDEX: SettingEntry[] = [
  { id: 'gameplay-preset', section: 'gameplay', group: (t) => t('game', 'presets_title'), label: (t) => t('game', 'presets_title'), hint: (t) => t('game', 'presets_hint') },
  { id: 'hold-priority', section: 'gameplay', group: automation, label: (t) => t('game', 'hold_priority'), hint: (t) => t('game', 'hold_priority_title') },
  { id: 'smart-stops', section: 'gameplay', group: automation, label: (t) => t('game', 'smart_stops'), hint: (t) => t('game', 'smart_stops_hint') },
  { id: 'auto-mulligan', section: 'gameplay', group: automation, label: (t) => t('game', 'auto_mulligan'), hint: (t) => t('lobby', 'settings_auto_mulligan_hint') },
  { id: 'log-autosave', section: 'gameplay', group: history, label: (t) => t('system', 'log_autosave'), hint: (t) => t('system', 'log_autosave_hint') },
  { id: 'board-rewind', section: 'gameplay', group: history, label: (t) => t('game', 'rewind_setting'), hint: (t) => t('game', 'rewind_setting_hint') },
  { id: 'turn-recap', section: 'gameplay', group: history, label: (t) => t('game', 'recap_setting'), hint: (t) => t('game', 'recap_setting_hint') },
  { id: 'browser-notifications', section: 'gameplay', group: history, label: (t) => t('game', 'notify_setting'), hint: (t) => t('game', 'notify_setting_hint'), available: notificationsSupported },
  { id: 'mana-auto', section: 'gameplay', group: mana, label: (t) => t('game', 'mana_payment_auto'), hint: (t) => t('game', 'mana_payment_auto_tip') },
  { id: 'mana-restricted', section: 'gameplay', group: mana, label: (t) => t('game', 'mana_payment_restricted'), hint: (t) => t('game', 'mana_payment_restricted_tip') },
  { id: 'mana-first', section: 'gameplay', group: mana, label: (t) => t('game', 'mana_payment_first'), hint: (t) => t('game', 'mana_payment_first_tip') },
  { id: 'mana-confirm', section: 'gameplay', group: mana, label: (t) => t('game', 'mana_payment_confirm'), hint: (t) => t('game', 'mana_payment_confirm_tip') },
  { id: 'mana-smart', section: 'gameplay', group: mana, label: (t) => t('game', 'mana_payment_smart'), hint: (t) => t('game', 'mana_payment_smart_tip') },
  { id: 'phase-stops', section: 'gameplay', group: (t) => t('game', 'phase_stops_default_title'), label: (t) => t('game', 'phase_stops_default_title'), hint: (t) => t('game', 'phase_stops_default_hint') },
  { id: 'auto-answers', section: 'gameplay', group: (t) => t('game', 'auto_answers_title', { count: getState().settings.autoAnswers.length }), label: (t) => t('game', 'auto_answers_title', { count: getState().settings.autoAnswers.length }), hint: (t) => t('lobby', 'settings_auto_answers_how', { remember: t('game', 'auto_answer_remember') }) },

  { id: 'board-layout', section: 'board', tab: 'layout', group: (t) => t('lobby', 'appearance_board_title'), label: (t) => t('lobby', 'appearance_board_title'), hint: (t) => t('lobby', 'appearance_board_hint') },
  { id: 'board-fill', section: 'board', tab: 'layout', group: fieldHand, label: (t) => t('lobby', 'board_fill_show'), hint: (t) => t('lobby', 'board_fill_show_hint') },
  { id: 'board-spotlight', section: 'board', tab: 'layout', group: fieldHand, label: (t) => t('lobby', 'board_spotlight_show'), hint: (t) => t('lobby', 'board_spotlight_show_hint') },
  { id: 'hand-rail', section: 'board', tab: 'layout', group: fieldHand, label: (t) => t('lobby', 'hand_rail_show'), hint: (t) => t('lobby', 'hand_rail_show_hint') },
  { id: 'hand-row', section: 'board', tab: 'layout', group: fieldHand, label: (t) => t('lobby', 'hand_row_show'), hint: (t) => t('lobby', 'hand_row_show_hint') },
  { id: 'card-style', section: 'board', tab: 'cards', group: (t) => t('lobby', 'card_style_title'), label: (t) => t('lobby', 'card_style_title'), hint: (t) => t('lobby', 'card_style_hint') },
  { id: 'tap-style', section: 'board', tab: 'cards', group: (t) => t('lobby', 'tap_style_title'), label: (t) => t('lobby', 'tap_style_title'), hint: (t) => t('lobby', 'tap_style_hint') },
  { id: 'card-render', section: 'board', tab: 'cards', group: cardText, label: (t) => t('lobby', 'card_render_show'), hint: (t) => t('lobby', 'card_render_show_hint') },
  { id: 'stack-caption', section: 'board', tab: 'cards', group: cardText, label: (t) => t('lobby', 'stack_caption_show'), hint: (t) => t('lobby', 'stack_caption_show_hint'), available: () => getState().settings.cardRender !== 'rendered' },
  { id: 'custom-card-art', section: 'board', tab: 'cards', group: (t) => t('lobby', 'custom_card_art_title'), label: (t) => t('lobby', 'custom_card_art_title'), hint: (t) => t('lobby', 'custom_card_art_hint') },
  { id: 'pt-badge', section: 'board', tab: 'overlays', group: (t) => t('lobby', 'pt_badge_title'), label: (t) => t('lobby', 'pt_badge_title'), hint: (t) => t('lobby', 'pt_badge_hint') },
  { id: 'sickness-style', section: 'board', tab: 'overlays', group: (t) => t('lobby', 'sickness_style_title'), label: (t) => t('lobby', 'sickness_style_title'), hint: (t) => t('lobby', 'sickness_style_hint') },
  { id: 'keyword-icons', section: 'board', tab: 'overlays', group: (t) => t('lobby', 'keyword_icons_title'), label: (t) => t('lobby', 'keyword_icons_title'), hint: (t) => t('lobby', 'keyword_icons_hint') },
  { id: 'keyword-aura', section: 'board', tab: 'overlays', group: (t) => t('lobby', 'keyword_aura_title'), label: (t) => t('lobby', 'keyword_aura_title'), hint: (t) => t('lobby', 'keyword_aura_hint') },
  { id: 'hand-cost', section: 'board', tab: 'overlays', group: overlays, label: (t) => t('lobby', 'hand_cost_show'), hint: (t) => t('lobby', 'hand_cost_show_hint') },
  { id: 'mana-source', section: 'board', tab: 'overlays', group: overlays, label: (t) => t('lobby', 'mana_source_show'), hint: (t) => t('lobby', 'mana_source_show_hint') },
  { id: 'playmat', section: 'board', tab: 'table', group: (t) => t('lobby', 'playmat_title'), label: (t) => t('lobby', 'playmat_title'), hint: (t) => t('lobby', 'playmat_hint') },
  { id: 'sleeve', section: 'board', tab: 'table', group: (t) => t('lobby', 'sleeve_pick_title'), label: (t) => t('lobby', 'sleeve_pick_title'), hint: (t) => t('lobby', 'sleeve_pick_subtitle') },

  { id: 'theme', section: 'interface', group: (t) => t('lobby', 'scheme_title'), label: (t) => t('lobby', 'settings_theme'), hint: (t) => t('lobby', 'scheme_hint') },
  { id: 'ui-scale', section: 'interface', group: size, label: (t) => t('lobby', 'ui_scale_title'), hint: (t) => t('lobby', 'ui_scale_hint') },
  { id: 'card-preview-size', section: 'interface', group: size, label: (t) => t('lobby', 'card_preview_size_title'), hint: (t) => t('lobby', 'card_preview_size_hint') },
  { id: 'cjk-boost', section: 'interface', group: size, label: (t) => t('lobby', 'cjk_boost_label'), hint: (t) => t('lobby', 'cjk_boost_only') },
  { id: 'transparent-dialogs', section: 'interface', group: (t) => t('lobby', 'settings_group_dialogs'), label: (t) => t('lobby', 'dialog_backdrop_label'), hint: (t) => t('lobby', 'dialog_backdrop_hint') },

  { id: 'ui-language', section: 'language', group: languages, label: (t) => t('common', 'language'), hint: (t) => t('lobby', 'settings_ui_lang_hint') },
  { id: 'card-language', section: 'language', group: languages, label: (t) => t('common', 'card_language'), hint: (t) => t('lobby', 'settings_card_lang_hint') },

  { id: 'fx-effects', section: 'sound', group: animations, label: (t) => t('game', 'fx_effects'), hint: (t) => t('game', 'fx_effects_hint') },
  { id: 'fx-speed', section: 'sound', group: animations, label: (t) => t('game', 'fx_speed') },
  { id: 'sound-enabled', section: 'sound', group: sound, label: (t) => t('game', 'sound_enabled'), hint: (t) => t('game', 'sound_enabled_hint') },
  { id: 'volume-master', section: 'sound', group: sound, label: (t) => t('game', 'sound_volume_master') },
  { id: 'volume-sfx', section: 'sound', group: sound, label: (t) => t('game', 'sound_volume_sfx') },
  { id: 'volume-ui', section: 'sound', group: sound, label: (t) => t('game', 'sound_volume_ui') },
  { id: 'priority-sound', section: 'sound', group: sound, label: (t) => t('game', 'sound_priority_mode'), hint: (t) => t('game', 'sound_priority_mode_hint') },
  { id: 'music-enabled', section: 'sound', group: music, label: (t) => t('game', 'music_enabled'), hint: (t) => t('game', 'music_enabled_hint') },
  { id: 'music-volume', section: 'sound', group: music, label: (t) => t('game', 'music_volume') },
]

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export interface SearchHit {
  entry: SettingEntry
  label: string
  hint: string
  where: string
}

/** SET-6: every available setting whose label or explanation contains the query, ignoring case and accents. */
export function searchSettings(query: string, t: T): SearchHit[] {
  const q = normalizeSearch(query)
  if (!q) return []
  const hits: SearchHit[] = []
  for (const entry of SETTINGS_INDEX) {
    if (entry.available && !entry.available()) continue
    const label = entry.label(t)
    const hint = entry.hint?.(t) ?? ''
    if (!normalizeSearch(`${label} ${hint}`).includes(q)) continue
    const section = sectionTitle(t, entry.section)
    const group = entry.group(t)
    hits.push({ entry, label, hint, where: group === label || group === section ? section : `${section} › ${group}` })
  }
  return hits
}
