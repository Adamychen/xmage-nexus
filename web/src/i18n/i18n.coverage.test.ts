import { describe, it, expect } from 'vitest'
import { en } from './locales/en'
import { es } from './locales/es'
import { de } from './locales/de'
import { fr } from './locales/fr'
import { it as itLocale } from './locales/it'
import { pt } from './locales/pt'
import { ja } from './locales/ja'
import { ru } from './locales/ru'
import { zhs } from './locales/zhs'
import type { TranslationSchema } from './types'

const WHITELIST = new Set<string>([
  'lobby.brand_title',
  'lobby.leaderboard_col_elo',
  'dialogs.voting_vs',
  'board.token',
  'board.morph',
  'board.manifest',
  'board.disguise',
  'board.cloak',
  'board.opp_dead',
  'decks.browser_filter_aggro',
  'decks.browser_filter_midrange',
  'decks.browser_filter_control',
  'decks.browser_filter_combo',
  'decks.browser_filter_ramp',
  'decks.browser_filter_tribal',
  'decks.browser_filter_precon',
  'decks.filter_cmc',
  'decks.sample_mulligan',
  'dialogs.mulligan_btn',
  'game.arena_view',
  'game.arena_view_active',
  'game.pod_view',
  'game.pod_view_active',
  'game.auto_mulligan',
  'game.auto_pass',
  'game.category_planeswalkers',
  'game.type_planeswalker',
  'game.construct_pool',
  'game.construct_total',
  'game.sideboard_pool',
  'game.draft_booster',
  'game.draft_title',
  'game.sideboard_title',
  'game.booster_label',
  'game.tab_chat',
  'game.tab_log',
  'game.visual_feed',
  'lobby.create_option_booster_draft',
  'lobby.create_option_elimination',
  'lobby.create_option_sealed',
  'lobby.create_skill_casual',
  'lobby.create_tab_general',
  'lobby.history_timeouts',
  'lobby.leaderboard_col_pos',
  'lobby.leaderboard_col_winrate',
  'lobby.leaderboard_progress_value',
  'login.avatar',
  'login.proxy',
  'login.server_local',
  'wiki.shortcuts_esc',
  'common.error',
  'common.no',
  'lobby.staging_vs',
  'board.pile_top',
  'lobby.board_pod',
  'lobby.board_arena',
])

function flatten(obj: TranslationSchema): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [cat, vals] of Object.entries(obj as unknown as Record<string, Record<string, string>>)) {
    for (const [k, v] of Object.entries(vals)) {
      out[`${cat}.${k}`] = v
    }
  }
  return out
}

const locales: Record<string, TranslationSchema> = { en, es, de, fr, it: itLocale, pt, ja, ru, zhs }

describe('i18n coverage guard', () => {
  it('no language has missing or extra keys vs en', () => {
    const base = flatten(en)
    const baseKeys = new Set(Object.keys(base))
    for (const [lang, dict] of Object.entries(locales)) {
      const flat = flatten(dict)
      const keys = new Set(Object.keys(flat))
      const missing = [...baseKeys].filter(k => !keys.has(k))
      const extra = [...keys].filter(k => !baseKeys.has(k))
      expect(missing, `${lang} missing keys: ${missing.join(', ')}`).toEqual([])
      expect(extra, `${lang} extra keys: ${extra.join(', ')}`).toEqual([])
      const empty = Object.entries(flat).filter(([, v]) => v === '').map(([k]) => k)
      expect(empty, `${lang} empty values: ${empty.join(', ')}`).toEqual([])
    }
  })

  it('es is 100% translated after whitelist (magic terms excluded)', () => {
    const base = flatten(en)
    const esFlat = flatten(es)
    let identicalAfterWhitelist = 0
    const identicalKeys: string[] = []
    for (const k of Object.keys(base)) {
      if (esFlat[k] === base[k] && !WHITELIST.has(k)) {
        identicalAfterWhitelist++
        identicalKeys.push(k)
      }
    }
    expect(identicalKeys, `es identical* (${identicalAfterWhitelist}): ${identicalKeys.join(', ')}`).toEqual([])
    expect(identicalAfterWhitelist).toBe(0)
  })

  it('other languages do not regress beyond baseline (threshold 500 identical* after whitelist)', () => {
    const base = flatten(en)
    const thresholdOther = 500
    for (const lang of ['de', 'fr', 'it', 'pt', 'ja', 'ru', 'zhs'] as const) {
      const flat = flatten(locales[lang])
      let identicalAfterWhitelist = 0
      for (const k of Object.keys(base)) {
        if (flat[k] === base[k] && !WHITELIST.has(k)) identicalAfterWhitelist++
      }
      expect(
        identicalAfterWhitelist,
        `${lang} identical* ${identicalAfterWhitelist} exceeds threshold ${thresholdOther} — traduce o ajusta whitelist`
      ).toBeLessThanOrEqual(thresholdOther)
    }
  })

  it('reports coverage table (snapshot sanity)', () => {
    const base = flatten(en)
    const total = Object.keys(base).length
    expect(total).toBeGreaterThan(800)
    // es debe estar cerca de 100% tras whitelist
    const esFlat = flatten(es)
    let identicalAfterWhitelist = 0
    for (const k of Object.keys(base)) if (esFlat[k] === base[k] && !WHITELIST.has(k)) identicalAfterWhitelist++
    const pct = ((total - identicalAfterWhitelist) / total) * 100
    expect(pct).toBeGreaterThanOrEqual(99.5)
  })
})
