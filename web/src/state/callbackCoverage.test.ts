import { describe, expect, it } from 'vitest'

// @ts-expect-error node: specifiers are not in the DOM lib; this test runs in Node under vitest
import { readFileSync, existsSync } from 'node:fs'
// @ts-expect-error node: specifiers are not in the DOM lib; this test runs in Node under vitest
import { fileURLToPath } from 'node:url'
// @ts-expect-error node: specifiers are not in the DOM lib; this test runs in Node under vitest
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// 1. Lista canónica de callbacks (fuente: Mage.Common ClientCallbackMethod.java).
const JAVA_ENUM = resolve(
  here,
  '../../../Mage.Common/src/main/java/mage/interfaces/callback/ClientCallbackMethod.java',
)

// Fallback si se corre en CI web aislada sin el fork Java (mantener sincronizado con el enum).
const FALLBACK_CALLBACKS = [
  'CHATMESSAGE', 'SHOW_USERMESSAGE', 'SERVER_MESSAGE', 'JOINED_TABLE',
  'START_TOURNAMENT', 'TOURNAMENT_INIT', 'TOURNAMENT_UPDATE', 'TOURNAMENT_OVER',
  'START_DRAFT', 'SIDEBOARD', 'CONSTRUCT', 'DRAFT_OVER', 'DRAFT_INIT', 'DRAFT_PICK', 'DRAFT_UPDATE',
  'SHOW_TOURNAMENT', 'WATCHGAME', 'VIEW_LIMITED_DECK', 'VIEW_SIDEBOARD', 'USER_REQUEST_DIALOG', 'GAME_REDRAW_GUI',
  'START_GAME', 'GAME_INIT', 'GAME_UPDATE_AND_INFORM', 'GAME_INFORM_PERSONAL', 'GAME_ERROR', 'GAME_UPDATE',
  'GAME_TARGET', 'GAME_CHOOSE_ABILITY', 'GAME_CHOOSE_PILE', 'GAME_CHOOSE_CHOICE', 'GAME_ASK', 'GAME_SELECT',
  'GAME_PLAY_MANA', 'GAME_PLAY_XMANA', 'GAME_GET_AMOUNT', 'GAME_GET_MULTI_AMOUNT', 'GAME_OVER', 'END_GAME_INFO',
  'REPLAY_GAME', 'REPLAY_INIT', 'REPLAY_UPDATE', 'REPLAY_DONE',
]

function extractCallbacks(): string[] {
  if (!existsSync(JAVA_ENUM)) return FALLBACK_CALLBACKS
  const src = readFileSync(JAVA_ENUM, 'utf8')
  const names = new Set<string>()
  const re = /^\s*([A-Z][A-Z0-9_]*)\s*\(/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) names.add(m[1])
  names.delete('CLIENTCALLBACKMETHOD')
  const list = [...names].sort()
  // El enum no se parseó bien: usar fallback para no enmascarar drift real.
  return list.length >= 30 ? list : FALLBACK_CALLBACKS
}

// 2. Callbacks sin UI hoy (planeados). Deben tener `case` en eventHandler/feedback O estar aquí.
const KNOWN_UNHANDLED: Record<string, string> = {
}

const eventHandlerSrc = readFileSync(resolve(here, './eventHandler.ts'), 'utf8')
const feedbackSrc = readFileSync(resolve(here, '../game/feedback.ts'), 'utf8')
const combined = eventHandlerSrc + '\n' + feedbackSrc

const hasCase = (name: string) => combined.includes(`case '${name}':`)

describe('callback coverage — eventHandler/feedback', () => {
  const callbacks = extractCallbacks()

  it('todos los callbacks del proxy tienen case o están documentados en KNOWN_UNHANDLED', () => {
    const sinTratar = callbacks.filter((n) => !hasCase(n) && !(n in KNOWN_UNHANDLED))
    expect(sinTratar, `Callbacks sin manejar ni documentados: ${sinTratar.join(', ')}`).toEqual([])
  })

  it('KNOWN_UNHANDLED no está obsoleto (ninguno tiene case hoy)', () => {
    const obsoletos = Object.keys(KNOWN_UNHANDLED).filter((n) => hasCase(n))
    expect(obsoletos, `Ya tienen case; quitar de KNOWN_UNHANDLED: ${obsoletos.join(', ')}`).toEqual([])
  })

  it('los callbacks documentados como manejados realmente tienen case', () => {
    const rotos = callbacks.filter((n) => !(n in KNOWN_UNHANDLED) && !hasCase(n))
    expect(rotos, `Documentados como manejados pero sin case: ${rotos.join(', ')}`).toEqual([])
  })
})

// 3. Drift doc <-> código: la matriz debe listar exactamente los callbacks del enum.
const COVERAGE_MD = resolve(here, '../INTERACTION_COVERAGE.md')
describe('callback coverage — matriz de documentación', () => {
  it('INTERACTION_COVERAGE.md lista todos los callbacks del enum', () => {
    if (!existsSync(COVERAGE_MD)) return
    const md = readFileSync(COVERAGE_MD, 'utf8')
    const enumSet = new Set(extractCallbacks())
    const docSet = new Set<string>()
    const re = /^\|\s*`?([A-Z][A-Z0-9_]*)`?\s*\|/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(md))) {
      if (enumSet.has(m[1])) docSet.add(m[1])
    }
    const faltan = [...enumSet].filter((n) => !docSet.has(n))
    expect(faltan, `Faltan en la matriz: ${faltan.join(', ')}`).toEqual([])
  })
})
