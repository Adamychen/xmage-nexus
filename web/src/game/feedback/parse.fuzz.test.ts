import { describe, it, expect } from 'vitest'
import { parseFeedback } from './parse'
import { feedbackCards, feedbackCardsFrom, optionEntries, cardOptions, targetOptions, multiAmountItems, stringList, boundsFrom, splitSourceSuffix, stripHtml } from './record'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const KEYS = ['message', 'question', 'gameId', 'options', 'targets', 'cards', 'cardsView1', 'choices', 'min', 'max', 'flag', 'special',
  'possibleAttackers', 'possibleBlockers', 'target', 'targets_chosen', 'required', 'amount', 'multiAmount', 'players', 'id', 'name',
  'cardView', 'controlledBy', 'zone', 'pile1', 'pile2', 'data', 'choice', 'secondMessage', 'subMessage', 'abilities', 'view']
const STRINGS = ['', ' ', 'Pay {2}{R}', '<b>x</b>', '<font color="#fff">a</font>', '__proto__', 'constructor', 'null', '12', '-3', '1e999',
  'x'.repeat(5000), '\u0000', '\ud800', 'Choose a creature [Lightning Bolt]', 'true']

function value(r: () => number, depth: number): unknown {
  const k = Math.floor(r() * (depth > 3 ? 6 : 9))
  switch (k) {
    case 0: return null
    case 1: return undefined
    case 2: return STRINGS[Math.floor(r() * STRINGS.length)]
    case 3: return Math.floor((r() - 0.5) * 20)
    case 4: return r() < 0.5
    case 5: return [NaN, Infinity, -0, 1.5][Math.floor(r() * 4)]
    case 6: return Array.from({ length: Math.floor(r() * 4) }, () => value(r, depth + 1))
    default: {
      const o: Record<string, unknown> = {}
      const n = Math.floor(r() * 6)
      for (let i = 0; i < n; i++) o[KEYS[Math.floor(r() * KEYS.length)]] = value(r, depth + 1)
      return o
    }
  }
}

const METHODS = [
  'GAME_ASK',
  'GAME_CHOOSE_ABILITY',
  'GAME_CHOOSE_BETWEEN',
  'GAME_CHOOSE_CARDS',
  'GAME_CHOOSE_CARDS_ORDER',
  'GAME_CHOOSE_CHOICE',
  'GAME_CHOOSE_COLOR',
  'GAME_CHOOSE_MODE',
  'GAME_CHOOSE_NUMBER',
  'GAME_CHOOSE_ONE',
  'GAME_CHOOSE_PILE',
  'GAME_CHOOSE_STRING',
  'GAME_GET_AMOUNT',
  'GAME_GET_MULTI_AMOUNT',
  'GAME_PLAY_MANA',
  'GAME_PLAY_XMANA',
  'GAME_SELECT',
  'GAME_SELECT_AMOUNT',
  'GAME_SELECT_CARDS',
  'GAME_SELECT_PLAYER',
  'GAME_SELECT_TARGETS',
  'GAME_TARGET',
  'GAME_TARGET_AMOUNT',
  'GAME_TARGET_PLAYER',
  'GAME_INFORM',
  'GAME_UNKNOWN',
  '',
]

describe('feedback parsing never throws on malformed server data', () => {
  it('parseFeedback survives 8000 random payloads for every method', () => {
    const r = rng(20261014)
    const crashes: string[] = []
    for (let i = 0; i < 8000; i++) {
      const method = METHODS[i % METHODS.length]
      const payload = value(r, 0)
      const id = r() < 0.2 ? null : 'game-1'
      try {
        const out = parseFeedback(method, id, payload)
        if (out !== null) {
          expect(typeof out.mode).toBe('string')
          expect(typeof out.message).toBe('string')
        }
      } catch (e) {
        crashes.push(`${method} ${JSON.stringify(payload)?.slice(0, 160)} -> ${String(e)}`)
        if (crashes.length > 5) break
      }
    }
    expect(crashes).toEqual([])
  })

  it('the record helpers survive random input', () => {
    const r = rng(7)
    const crashes: string[] = []
    const fns: Array<[string, (v: unknown) => unknown]> = [
      ['feedbackCards', (v) => feedbackCards(v as never)],
      ['feedbackCardsFrom', feedbackCardsFrom],
      ['optionEntries', optionEntries],
      ['cardOptions', cardOptions],
      ['targetOptions', (v) => targetOptions(v as never, (i, id) => `${i}:${id}`)],
      ['multiAmountItems', (v) => multiAmountItems(v, (i) => `#${i}`)],
      ['stringList', stringList],
      ['boundsFrom', (v) => boundsFrom(v as never)],
      ['splitSourceSuffix', (v) => splitSourceSuffix(String(v))],
      ['stripHtml', (v) => stripHtml(String(v))],
    ]
    for (let i = 0; i < 3000; i++) {
      const [name, fn] = fns[i % fns.length]
      const payload = value(r, 0)
      try {
        fn(name === 'feedbackCards' || name === 'targetOptions' || name === 'boundsFrom' ? (payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}) : payload)
      } catch (e) {
        crashes.push(`${name} ${JSON.stringify(payload)?.slice(0, 120)} -> ${String(e)}`)
        if (crashes.length > 5) break
      }
    }
    expect(crashes).toEqual([])
  })
})
