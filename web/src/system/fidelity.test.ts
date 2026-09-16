import { afterEach, describe, expect, it } from 'vitest'
import {
  checkFidelity,
  collectPainted,
  isFidelityEnabled,
  maybeRunFidelityCheck,
  type PaintedCardState,
  type PaintedSnapshot,
} from './fidelity'
import type { GameView } from '../net/types'

function makeGame(overrides: Record<string, unknown> = {}): GameView {
  return {
    priorityTime: 0,
    bufferTime: 0,
    players: [],
    myHand: {},
    myHelperEmblems: {},
    opponentHands: {},
    watchedHands: {},
    stack: {},
    exiles: [],
    revealed: [],
    lookedAt: [],
    companion: [],
    combat: [],
    phase: 'MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    priorityPlayerName: 'Alice',
    turn: 5,
    special: false,
    rollbackTurnsAllowed: false,
    totalErrorsCount: 0,
    totalEffectsCount: 0,
    gameCycle: 0,
    ...overrides,
  } as unknown as GameView
}

function cardState(overrides: Partial<PaintedCardState> = {}): PaintedCardState {
  return { ownerId: null, tapped: null, pt: null, damage: null, counters: null, attacking: false, isAttachment: false, ...overrides }
}

function painted(ids: string[], statusText: string | null = 'Turno 5', pills = 1, extra: Partial<PaintedSnapshot> = {}): PaintedSnapshot {
  const cardStates: Record<string, PaintedCardState> = {}
  for (const id of ids) cardStates[id] = cardState()
  return {
    cardIdsInPaintOrder: ids,
    cardStates,
    players: [],
    hasPromptMarker: false,
    gameStatusText: statusText,
    activePhasePills: pills,
    attachmentGroups: [],
    zoneCounts: {},
    myHandCount: null,
    ...extra,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('fidelity (P2)', () => {
  it('juego limpio: sin discrepancias', () => {
    const game = makeGame({
      players: [{ playerId: 'p1', name: 'Alice', battlefield: { c1: { id: 'c1' } } }],
      stack: { s1: { id: 's1' } },
      myHand: { h1: { id: 'h1' } },
    })
    expect(checkFidelity(game, painted(['c1', 's1', 'h1']))).toEqual([])
  })

  it('detecta permanente no pintado e ignora faseados', () => {
    const game = makeGame({
      players: [{ playerId: 'p1', name: 'Alice', battlefield: { c1: { id: 'c1' }, c2: { id: 'c2', phasedIn: false } } }],
    })
    const out = checkFidelity(game, painted([]))
    expect(out.map((d) => d.code)).toEqual(['battlefield-missing'])
    expect(out[0].detail).toContain('c1')
    expect(out[0].detail).not.toContain('c2')
  })

  it('detecta carta pintada desconocida', () => {
    const game = makeGame()
    const out = checkFidelity(game, painted(['zz9']))
    expect(out.map((d) => d.code)).toContain('painted-unknown')
  })

  it('detecta orden de pila distinto', () => {
    const game = makeGame({ stack: { s1: { id: 's1' }, s2: { id: 's2' } } })
    expect(checkFidelity(game, painted(['s1', 's2'])).map((d) => d.code)).not.toContain('stack-order')
    const out = checkFidelity(game, painted(['s2', 's1']))
    expect(out.map((d) => d.code)).toContain('stack-order')
  })

  it('detecta turno y pastillas de fase', () => {
    const game = makeGame({ turn: 5 })
    expect(checkFidelity(game, painted([], 'Turno 5', 1)).map((d) => d.code)).not.toContain('turn-mismatch')
    expect(checkFidelity(game, painted([], 'Turno 6', 1)).map((d) => d.code)).toContain('turn-mismatch')
    expect(checkFidelity(game, painted([], 'Turno 5', 0)).map((d) => d.code)).toContain('phase-ambiguous')
    expect(checkFidelity(game, painted([], 'Turno 5', 2)).map((d) => d.code)).toContain('phase-ambiguous')
  })

  it('collectPainted lee el DOM en orden de pintado', () => {
    document.body.innerHTML = `
      <div data-testid="game-status">Turno 5</div>
      <div data-card-id="a"></div>
      <div><span data-card-id="b"></span></div>
      <button class="phase-badge active">x</button>`
    const snap = collectPainted(document)
    expect(snap.cardIdsInPaintOrder).toEqual(['a', 'b'])
    expect(snap.gameStatusText).toContain('Turno 5')
    expect(snap.activePhasePills).toBe(1)
  })

  it('apagado por defecto (flag localStorage)', () => {
    expect(isFidelityEnabled()).toBe(false)
    expect(() => maybeRunFidelityCheck(null)).not.toThrow()
  })

  describe('v2: P/T, girado, contadores, daño, vida, lado y prompts', () => {
    const creature = (overrides: Record<string, unknown> = {}) => ({
      id: 'c1',
      cardTypes: ['Creature'],
      power: '2',
      toughness: '2',
      ...overrides,
    })

    function gameWithPerm(perm: Record<string, unknown>) {
      return makeGame({
        players: [{ playerId: 'p1', name: 'Alice', battlefield: { c1: { id: 'c1', ...perm } } }],
      })
    }

    it('P/T: falta la pastilla o no coincide', () => {
      const game = gameWithPerm(creature())
      expect(checkFidelity(game, painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ pt: '2/2' }) } }))).toEqual([])
      expect(checkFidelity(game, painted(['c1'])).map((d) => d.code)).toContain('pt-mismatch')
      const out = checkFidelity(game, painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ pt: '4/4' }) } }))
      expect(out.map((d) => d.code)).toContain('pt-mismatch')
    })

    it('girado: compara con el servidor y exime al atacante que la UI gira', () => {
      const game = gameWithPerm(creature({ tapped: true }))
      const ok = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ tapped: '1', pt: '2/2' }) } })
      expect(checkFidelity(game, ok)).toEqual([])
      const bad = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ tapped: '0' }) } })
      expect(checkFidelity(game, bad).map((d) => d.code)).toContain('tapped-mismatch')
      const attacker = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ tapped: '1', attacking: true }) } })
      expect(checkFidelity(gameWithPerm(creature({ tapped: false })), attacker).map((d) => d.code)).not.toContain('tapped-mismatch')
    })

    it('contadores: firma exacta en ambos sentidos', () => {
      const game = gameWithPerm(creature({ counters: [{ name: '+1/+1', count: 2 }] }))
      const ok = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ counters: '+1/+1:2', pt: '2/2' }) } })
      expect(checkFidelity(game, ok)).toEqual([])
      const missing = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState() } })
      expect(checkFidelity(game, missing).map((d) => d.code)).toContain('counters-mismatch')
      const extra = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ counters: 'shield:1' }) } })
      expect(checkFidelity(gameWithPerm(creature()), extra).map((d) => d.code)).toContain('counters-mismatch')
    })

    it('daño: badge ausente o con otro número', () => {
      const game = gameWithPerm(creature({ damage: 3 }))
      const ok = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ damage: '3', pt: '2/2' }) } })
      expect(checkFidelity(game, ok)).toEqual([])
      expect(checkFidelity(game, painted(['c1'])).map((d) => d.code)).toContain('damage-mismatch')
      const bad = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ damage: '2' }) } })
      expect(checkFidelity(game, bad).map((d) => d.code)).toContain('damage-mismatch')
    })

    it('vida: compara la pintada con la del servidor', () => {
      const game = makeGame({ players: [{ playerId: 'p1', name: 'Alice', life: 20, battlefield: {} }] })
      const ok = painted([], 'Turno 5', 1, { players: [{ playerId: 'p1', life: '20' }] })
      expect(checkFidelity(game, ok)).toEqual([])
      const bad = painted([], 'Turno 5', 1, { players: [{ playerId: 'p1', life: '18' }] })
      expect(checkFidelity(game, bad).map((d) => d.code)).toContain('life-mismatch')
    })

    it('lado: permanente pintado en la zona de otro jugador', () => {
      const game = makeGame({
        players: [
          { playerId: 'p1', name: 'Alice', battlefield: { c1: { id: 'c1' } } },
          { playerId: 'p2', name: 'Bob', battlefield: {} },
        ],
      })
      const ok = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ ownerId: 'p1' }) } })
      expect(checkFidelity(game, ok)).toEqual([])
      const bad = painted(['c1'], 'Turno 5', 1, { cardStates: { c1: cardState({ ownerId: 'p2' }) } })
      expect(checkFidelity(game, bad).map((d) => d.code)).toContain('controller-side')
    })

    it('prompt pendiente sin marcador pintado', () => {
      const game = makeGame()
      expect(checkFidelity(game, painted([], 'Turno 5', 1, { hasPromptMarker: true }), true)).toEqual([])
      expect(checkFidelity(game, painted([], 'Turno 5', 1), true).map((d) => d.code)).toContain('prompt-missing')
      expect(checkFidelity(game, painted([], 'Turno 5', 1), false)).toEqual([])
    })

    it('collectPainted lee data-attrs de permanente, vida y marcador de prompt', () => {
      document.body.innerHTML = `
        <div data-player-id="p1" data-life="17">
          <div data-card-id="c1" data-tapped="1" data-pt="2/2" data-damage="1" data-counters="+1/+1:2|shield:1" class="card-slot attacking"></div>
        </div>
        <span data-prompt-method="GAME_TARGET" data-prompt-mode="uuid" hidden></span>`
      const snap = collectPainted(document)
      expect(snap.cardStates.c1).toEqual({
        ownerId: 'p1',
        tapped: '1',
        pt: '2/2',
        damage: '1',
        counters: '+1/+1:2|shield:1',
        attacking: true,
        isAttachment: false,
      })
      expect(snap.players).toEqual([{ playerId: 'p1', life: '17' }])
      expect(snap.hasPromptMarker).toBe(true)
    })
  })

  describe('v3: adjuntos y tamaños de mano/biblioteca/cementerio/exilio', () => {
    const hostPerm = (overrides: Record<string, unknown> = {}) => ({
      id: 'host',
      name: 'Elvish Mystic',
      cardTypes: ['Creature'],
      power: '1',
      toughness: '1',
      attachments: ['aura-1'],
      ...overrides,
    })
    const auraPerm = { id: 'aura-1', name: 'Rancor', cardTypes: ['Enchantment', 'Aura'] }

    function gameWithAura() {
      return makeGame({
        players: [{ playerId: 'p1', name: 'Alice', battlefield: { host: hostPerm(), 'aura-1': auraPerm } }],
      })
    }

    it('adjuntos: grupo pintado anidando la carta adjunta en su host', () => {
      const game = gameWithAura()
      const ok = painted(['host', 'aura-1'], 'Turno 5', 1, {
        attachmentGroups: [{ hostId: 'host', ids: ['aura-1'], ownerId: 'p1' }],
        cardStates: { host: cardState({ pt: '1/1' }), 'aura-1': cardState({ isAttachment: true, ownerId: 'p1' }) },
      })
      expect(checkFidelity(game, ok)).toEqual([])

      const missing = painted(['host'], 'Turno 5', 1)
      expect(checkFidelity(game, missing).map((d) => d.code)).toContain('attachments-mismatch')

      const wrong = painted(['host', 'aura-1'], 'Turno 5', 1, {
        attachmentGroups: [{ hostId: 'host', ids: [], ownerId: 'p1' }],
      })
      const out = checkFidelity(game, wrong)
      expect(out.map((d) => d.code)).toContain('attachments-mismatch')
      expect(out.some((d) => d.code === 'attachments-mismatch' && d.detail.includes('aura-1'))).toBe(true)
    })

    it('adjuntos: grupo pintado que el servidor no declara', () => {
      const game = makeGame({
        players: [{ playerId: 'p1', name: 'Alice', battlefield: { host: hostPerm({ attachments: [] }) } }],
      })
      const extra = painted(['host'], 'Turno 5', 1, {
        attachmentGroups: [{ hostId: 'host', ids: ['aura-9'], ownerId: 'p1' }],
      })
      const out = checkFidelity(game, extra)
      expect(out.map((d) => d.code)).toContain('attachments-mismatch')
      expect(out.some((d) => d.detail.includes('sin adjuntos en el servidor'))).toBe(true)
    })

    it('adjunto: una carta adjunta no exige badges P/T ni girado', () => {
      const game = makeGame({
        players: [
          {
            playerId: 'p1',
            name: 'Alice',
            battlefield: {
              host: hostPerm(),
              'aura-1': { ...auraPerm, cardTypes: ['Creature', 'Aura'], power: '2', toughness: '2', tapped: true },
            },
          },
        ],
      })
      const snap = painted(['host', 'aura-1'], 'Turno 5', 1, {
        attachmentGroups: [{ hostId: 'host', ids: ['aura-1'], ownerId: 'p1' }],
        cardStates: {
          host: cardState({ pt: '1/1' }),
          'aura-1': cardState({ isAttachment: true, ownerId: 'p1', tapped: '0' }),
        },
      })
      const codes = checkFidelity(game, snap).map((d) => d.code)
      expect(codes).not.toContain('pt-mismatch')
      expect(codes).not.toContain('tapped-mismatch')
    })

    it('tamaños: mano, biblioteca, cementerio y exilio coinciden o discrepan', () => {
      const game = makeGame({
        players: [
          {
            playerId: 'p1',
            name: 'Alice',
            handCount: 3,
            libraryCount: 40,
            graveyard: { g1: { id: 'g1' }, g2: { id: 'g2' } },
            exile: { e1: { id: 'e1' } },
          },
        ],
      })
      const ok = painted([], 'Turno 5', 1, {
        zoneCounts: { p1: { hand: 3, library: 40, graveyard: 2, exile: 1 } },
      })
      expect(checkFidelity(game, ok)).toEqual([])

      const bad = painted([], 'Turno 5', 1, {
        zoneCounts: { p1: { hand: 2, library: 39, graveyard: 1, exile: 0 } },
      })
      expect(checkFidelity(game, bad).map((d) => d.code)).toEqual([
        'hand-mismatch',
        'library-mismatch',
        'graveyard-mismatch',
        'exile-mismatch',
      ])
    })

    it('mano: el hand-bar manda para mi jugador', () => {
      const game = makeGame({ myPlayerId: 'p1', players: [{ playerId: 'p1', name: 'Alice', handCount: 5 }] })
      const ok = painted([], 'Turno 5', 1, { myHandCount: 5 })
      expect(checkFidelity(game, ok)).toEqual([])
      const bad = painted([], 'Turno 5', 1, { myHandCount: 4 })
      expect(checkFidelity(game, bad).map((d) => d.code)).toContain('hand-mismatch')
    })

    it('cuenta solo las zonas pintadas (jugadores sin render no cuentan)', () => {
      const game = makeGame({
        players: [
          { playerId: 'p1', name: 'Alice', handCount: 1, libraryCount: 10, graveyard: {}, exile: {} },
          { playerId: 'p2', name: 'Bob', handCount: 7, libraryCount: 99, graveyard: {}, exile: {} },
        ],
      })
      const ok = painted([], 'Turno 5', 1, {
        zoneCounts: { p1: { hand: 1, library: 10, graveyard: 0, exile: 0 } },
      })
      expect(checkFidelity(game, ok)).toEqual([])
    })

    it('collectPainted lee adjuntos, hand-bar y contadores de zona', () => {
      document.body.innerHTML = `
        <div data-player-id="p1" class="board-zone">
          <div class="hand-zone" data-hand-count="4"></div>
          <button data-testid="hand-switch-btn" data-switched="p2"></button>
          <button data-library-count="40"></button>
          <button data-graveyard-count="2"></button>
          <button data-exile-count="1"></button>
          <div class="card-attachment-group" data-attachment-host="host">
            <div class="attachments-list">
              <div class="card-slot attachment-subcard" data-card-id="aura-1"></div>
            </div>
            <div class="card-slot" data-card-id="host"></div>
          </div>
        </div>
        <div data-testid="hand-bar" data-hand-count="6"></div>`
      const snap = collectPainted(document)
      expect(snap.attachmentGroups).toEqual([{ hostId: 'host', ids: ['aura-1'], ownerId: 'p1' }])
      expect(snap.myHandCount).toBe(6)
      expect(snap.zoneCounts.p1).toEqual({ hand: null, library: 40, graveyard: 2, exile: 1 })
      expect(snap.cardStates['aura-1'].isAttachment).toBe(true)
    })
  })
})
