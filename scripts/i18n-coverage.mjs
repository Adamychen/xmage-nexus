#!/usr/bin/env node
// i18n coverage guard — verifica que no haya claves faltantes y que el % de
// valores idénticos a en (copias sin traducir) no supere umbrales.
// Whitelist: términos Magic / marcas / falsos positivos donde en==es es correcto.
// Uso: node scripts/i18n-coverage.mjs [--json] [--threshold-es=15] [--threshold-other=500]
//   --json: emite JSON para dashboard
//   --threshold-es: máximo de idénticas permitidas en es tras whitelist (default 15)
//   --threshold-other: máximo en otros idiomas (default 500 — solo anti-regresión, no bloquea)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const localesDir = path.join(repoRoot, 'web/src/i18n/locales')

const WHITELIST = new Set([
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
  'keywords.bushido_name',
  'keywords.indestructible_name',
  'keywords.mentor_name',
  'keywords.modular_name',
  'keywords.ninjutsu_name',
])

function parseLocale(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  // extrae pares  key: 'value'  (valor con '...' permitiendo \')
  // Necesitamos también el path categoría.key
  const flat = {}
  let currentCategory = null
  const lines = raw.split('\n')
  for (const line of lines) {
    const catMatch = line.match(/^\s{2}(\w+):\s*\{\s*$/)
    if (catMatch) {
      currentCategory = catMatch[1]
      continue
    }
    if (/^\s{2}\},?$/.test(line)) {
      currentCategory = null
      continue
    }
    if (!currentCategory) continue
    // match key: 'value',  value puede contener \' y puede ser con " o '
    const m = line.match(/^\s{4}(\w+):\s*'(.*)',?\s*$/)
    if (m) {
      const key = m[1]
      let val = m[2]
      // desescapar \'
      val = val.replace(/\\'/g, "'")
      flat[`${currentCategory}.${key}`] = val
      continue
    }
    const m2 = line.match(/^\s{4}(\w+):\s*"([^"]*)",?\s*$/)
    if (m2) {
      flat[`${currentCategory}.${m2[1]}`] = m2[2]
    }
  }
  return flat
}

function main() {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json')
  const thresholdEs = Number((args.find(a => a.startsWith('--threshold-es=')) || '').split('=')[1] || 15)
  const thresholdOther = Number((args.find(a => a.startsWith('--threshold-other=')) || '').split('=')[1] || 500)

  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.ts')).map(f => path.join(localesDir, f))
  const locales = {}
  for (const fp of files) {
    const lang = path.basename(fp, '.ts')
    locales[lang] = parseLocale(fp)
  }

  const base = locales['en']
  if (!base) {
    console.error('No se encontró locale base en')
    process.exit(1)
  }
  const baseKeys = new Set(Object.keys(base))
  const total = baseKeys.size

  const report = []
  let hasError = false

  for (const [lang, flat] of Object.entries(locales)) {
    const keys = new Set(Object.keys(flat))
    const missing = [...baseKeys].filter(k => !keys.has(k))
    const extra = [...keys].filter(k => !baseKeys.has(k))
    const empty = [...keys].filter(k => flat[k] === '')
    let identical = 0
    let identicalAfterWhitelist = 0
    const identicalKeys = []
    for (const k of baseKeys) {
      if (flat[k] === base[k]) {
        identical++
        if (!WHITELIST.has(k)) {
          identicalAfterWhitelist++
          identicalKeys.push(k)
        }
      }
    }
    const translatedReal = total - identicalAfterWhitelist
    const pctReal = ((translatedReal / total) * 100).toFixed(1)

    const status = lang === 'en' ? 'base' : lang === 'es' ? (identicalAfterWhitelist <= thresholdEs ? 'pass' : 'fail') : (identicalAfterWhitelist <= thresholdOther ? 'pass' : 'fail')
    if (status === 'fail') hasError = true

    report.push({
      lang,
      total,
      missing: missing.length,
      extra: extra.length,
      empty: empty.length,
      identical,
      identicalAfterWhitelist,
      translatedReal,
      pctReal,
      status,
      missingKeys: missing,
      identicalKeys: identicalKeys.slice(0, 20),
    })
  }

  if (jsonMode) {
    console.log(JSON.stringify({ total, whitelist: [...WHITELIST], report }, null, 2))
  } else {
    console.log(`\n i18n coverage — total claves base (en): ${total} — whitelist: ${WHITELIST.size} claves`)
    console.log(' ' + '-'.repeat(110))
    console.log(` ${'lang'.padEnd(6)} ${'total'.padEnd(6)} ${'missing'.padEnd(8)} ${'empty'.padEnd(6)} ${'identical'.padEnd(10)} ${'identical*'.padEnd(11)} ${'translated*'.padEnd(12)} ${'pct*'.padEnd(6)} ${'status'}`)
    console.log(' ' + '-'.repeat(110))
    for (const r of report.sort((a,b) => a.lang.localeCompare(b.lang))) {
      const identicalStr = `${r.identical}`.padEnd(10)
      const identicalW = `${r.identicalAfterWhitelist}`.padEnd(11)
      const trans = `${r.translatedReal}`.padEnd(12)
      const pct = `${r.pctReal}%`.padEnd(6)
      console.log(` ${r.lang.padEnd(6)} ${String(r.total).padEnd(6)} ${String(r.missing).padEnd(8)} ${String(r.empty).padEnd(6)} ${identicalStr} ${identicalW} ${trans} ${pct} ${r.status}`)
    }
    console.log(' ' + '-'.repeat(110))
    console.log(` *after whitelist (${WHITELIST.size} keys excluded). es threshold: ${thresholdEs}, other: ${thresholdOther}`)
    for (const r of report) {
      if (r.missing.length > 0) {
        console.log(`\n  ${r.lang} missing (${r.missing.length}): ${r.missingKeys.slice(0,5).join(', ')}${r.missing.length>5?'…':''}`)
      }
      if (r.identicalAfterWhitelist > 0 && r.lang !== 'en') {
        // mostrar sample de sospechosas
        if (r.lang === 'es' || r.identicalAfterWhitelist < 50) {
          console.log(`  ${r.lang} identical* sample (${r.identicalAfterWhitelist}): ${r.identicalKeys.slice(0,5).join(', ')}${r.identicalKeys.length>5?'…':''}`)
        }
      }
    }
    console.log('')
  }

  if (hasError) {
    console.error(`\n[FAIL] i18n coverage guard — alguna lengua supera el umbral. Revisa whitelist o traduce.`)
    console.error(`       Para actualizar baseline, revisa WHITELIST en scripts/i18n-coverage.mjs`)
    process.exit(1)
  } else {
    console.log('[PASS] i18n coverage guard')
  }
}

main()
