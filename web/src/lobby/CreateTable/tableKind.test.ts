import { describe, expect, it } from 'vitest'
import {
  resolveTableKind,
  clampNumPlayers,
  defaultSeatTypeFor,
  computeTournamentSeats,
  computeMatchSeats,
  buildTournamentLimitedOptions,
  buildCreateTournamentArgs,
  buildCreateMatchArgs,
  tournamentJoinNeedsDeck,
  healTournamentBranch,
  expandDraftSetCodes,
  validateDraftSets,
  uniformDraftSet,
  limitedTourneyHasAiSeats,
  type TableKind,
  type TableKindInputs,
} from './tableKind'

const KNOWN = [
  'Constructed Elimination',
  'Constructed Swiss',
  'Booster Draft Elimination',
  'Booster Draft Swiss',
  'Sealed Elimination',
  'Sealed Swiss',
]

const base: TableKindInputs = {
  tableCategory: 'duel',
  tournamentCategory: 'limited',
  useDraftTournament: false,
  deckType: 'Constructed - Modern',
  tournamentType: 'Booster Draft Elimination',
  knownTournamentTypes: KNOWN,
}

describe('resolveTableKind — matriz de decisión del wizard', () => {
  const rows: Array<[string, Partial<TableKindInputs>, TableKind, string]> = [
    ['duelo Modern sin draft → match', {}, 'match', 'Booster Draft Elimination'],
    ['duelo Limited sin draft → match (ignora tournamentType)', { deckType: 'Limited' }, 'match', 'Booster Draft Elimination'],
    [
      'duelo Limited + draft → draft-tourney (flujo del usuario)',
      { deckType: 'Limited', useDraftTournament: true },
      'draft-tourney',
      'Booster Draft Elimination',
    ],
    [
      'multi Commander → match',
      { tableCategory: 'multi', deckType: 'Variant Magic - Commander' },
      'match',
      'Booster Draft Elimination',
    ],
    [
      'multi Limited + draft → draft-tourney',
      { tableCategory: 'multi', deckType: 'Limited', useDraftTournament: true },
      'draft-tourney',
      'Booster Draft Elimination',
    ],
    [
      'torneo limited + Booster Draft Elimination → draft-tourney',
      { tableCategory: 'tourney', tournamentType: 'Booster Draft Elimination' },
      'draft-tourney',
      'Booster Draft Elimination',
    ],
    [
      'torneo limited + Sealed Swiss → draft-tourney',
      { tableCategory: 'tourney', tournamentType: 'Sealed Swiss' },
      'draft-tourney',
      'Sealed Swiss',
    ],
    [
      'torneo constructed + Constructed Swiss → constructed-tourney',
      {
        tableCategory: 'tourney',
        tournamentCategory: 'constructed',
        tournamentType: 'Constructed Swiss',
      },
      'constructed-tourney',
      'Constructed Swiss',
    ],
    [
      'legacy Booster Draft se normaliza a Elimination',
      { tableCategory: 'tourney', tournamentType: 'Booster Draft' },
      'draft-tourney',
      'Booster Draft Elimination',
    ],
    [
      'tipo vacío cae al default draft',
      { tableCategory: 'tourney', tournamentType: '' },
      'draft-tourney',
      'Booster Draft Elimination',
    ],
    [
      'duelo Modern + tipo constructed rancio → constructed-tourney (documenta comportamiento)',
      { tournamentType: 'Constructed Swiss' },
      'constructed-tourney',
      'Constructed Swiss',
    ],
    [
      'tipo desconocido → invalid (antes NPE en el servidor)',
      { tableCategory: 'tourney', tournamentType: 'No Existe' },
      'invalid',
      'No Existe',
    ],
    [
      'draft con tipo constructed → invalid (antes mesa construida silenciosa)',
      {
        tableCategory: 'tourney',
        tournamentType: 'Constructed Elimination',
      },
      'invalid',
      'Constructed Elimination',
    ],
    [
      'duelo Limited + draft + tipo constructed → invalid',
      { deckType: 'Limited', useDraftTournament: true, tournamentType: 'Constructed Swiss' },
      'invalid',
      'Constructed Swiss',
    ],
    [
      'sin lista del servidor usa los defaults y resuelve draft',
      {
        tableCategory: 'tourney',
        tournamentType: 'Booster Draft',
        knownTournamentTypes: [],
      },
      'draft-tourney',
      'Booster Draft Elimination',
    ],
  ]

  it.each(rows)('%s', (_label, over, kind, normalized) => {
    const res = resolveTableKind({ ...base, ...over })
    expect(res.kind).toBe(kind)
    expect(res.normalizedTournamentType).toBe(normalized)
    expect(res.errorKey).toBe(kind === 'invalid' ? 'create_err_bad_tournament_type' : null)
  })

  it('los flags acompañan al kind en estados válidos', () => {
    const draft = resolveTableKind({
      ...base,
      tableCategory: 'tourney',
      tournamentType: 'Booster Draft Elimination',
    })
    expect(draft.isTournament).toBe(true)
    expect(draft.isDraftLimited).toBe(true)
    expect(draft.isConstructedTournament).toBe(false)

    const match = resolveTableKind(base)
    expect(match.isTournament).toBe(false)
    expect(match.isDraftLimited).toBe(false)
  })
})

describe('clampNumPlayers', () => {
  it.each([
    ['draft ignora el máx del gameType (Two Player Duel → 8)', 16, { draft: true, tourney: true }, 2, 2, 8],
    ['torneo construido permite hasta 32', 32, { draft: false, tourney: true }, 2, 2, 32],
    ['torneo construido recorta a 32', 40, { draft: false, tourney: true }, 2, 2, 32],
    ['match respeta el gameType', 4, { draft: false, tourney: false }, 2, 10, 4],
    ['match recorta al máx del gameType', 3, { draft: false, tourney: false }, 2, 2, 2],
    ['el mínimo siempre manda', 1, { draft: true, tourney: true }, 2, 2, 2],
  ])('%s', (_label, n, opts, min, max, expected) => {
    expect(clampNumPlayers(n, opts, min, max)).toBe(expected)
  })

  it('defaultSeatTypeFor: draft → draftbot, resto → SIM', () => {
    expect(defaultSeatTypeFor(true)).toBe('COMPUTER_DRAFT_BOT')
    expect(defaultSeatTypeFor(false)).toBe('SIM')
  })
})

describe('computeTournamentSeats / computeMatchSeats', () => {
  it('torneo usa asientos + rellena con HUMAN en draft', () => {
    const { playerTypesFinal, effectiveSeatTypes } = computeTournamentSeats({
      seatConfigs: [{ type: 'COMPUTER_DRAFT_BOT', deckName: '', skill: 2 }],
      playerTypesSel: ['SIM'],
      numPlayers: 4,
      humanSeat: true,
      draft: true,
    })
    expect(effectiveSeatTypes).toEqual(['COMPUTER_DRAFT_BOT'])
    expect(playerTypesFinal).toEqual(['HUMAN', 'COMPUTER_DRAFT_BOT', 'HUMAN', 'HUMAN'])
  })

  it('torneo construido rellena con SIM', () => {
    const { playerTypesFinal } = computeTournamentSeats({
      seatConfigs: [],
      playerTypesSel: ['SIM'],
      numPlayers: 2,
      humanSeat: true,
      draft: false,
    })
    expect(playerTypesFinal).toEqual(['HUMAN', 'SIM'])
  })

  it('match rellena con SIM y trunca sobrantes', () => {
    const { playerTypesFinal } = computeMatchSeats({
      seatConfigs: [
        { type: 'HUMAN', deckName: '', skill: 2 },
        { type: 'HUMAN', deckName: '', skill: 2 },
      ],
      playerTypesSel: ['SIM'],
      numPlayers: 2,
      humanSeat: true,
    })
    expect(playerTypesFinal).toEqual(['HUMAN', 'HUMAN'])
  })
})

describe('builders de payload', () => {
  it('torneo draft: deckType forzado a Limited, sin mazos', () => {
    const args = buildCreateTournamentArgs({
      name: 'Draft Night',
      username: 'player1',
      tournamentType: 'Booster Draft Elimination',
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Modern',
      draft: true,
      limitedOptions: buildTournamentLimitedOptions({
        draftSetsRaw: 'MH3',
        draftBoosters: 3,
        draftConstructionTime: 600,
        draftCubeName: '',
        draftTiming: 'REGULAR',
        tournamentType: 'Booster Draft Elimination',
      }),
      playerTypesFinal: ['HUMAN', 'COMPUTER_DRAFT_BOT'],
      password: '',
      spectatorsAllowed: true,
      wins: 1,
      numberRounds: 0,
      skillLevel: 'CASUAL',
      rated: false,
      rollbackTurnsAllowed: true,
      timeLimit: 'MIN__25',
      bufferTime: 'NONE',
      minimumRating: 0,
      quitRatio: 100,
      bannedUsersRaw: '',
      singleGame: false,
    })
    expect(args.tournamentType).toBe('Booster Draft Elimination')
    expect(args.deckType).toBe('Limited')
    expect(args.limited).toBe(true)
    expect(args).not.toHaveProperty('deck')
    expect(args).not.toHaveProperty('simDecks')
    expect((args.limitedOptions as Record<string, unknown>).timing).toBe('REGULAR')
    expect(args.bufferTime).toBeUndefined()
    expect(args.numberRounds).toBeUndefined()
    expect(args.quitRatio).toBe(100)
  })

  it('Sealed no lleva timing pero sí es limited', () => {
    const limited = buildTournamentLimitedOptions({
      draftSetsRaw: 'M21',
      draftBoosters: 6,
      draftConstructionTime: 900,
      draftCubeName: '',
      draftTiming: 'REGULAR',
      tournamentType: 'Sealed Swiss',
    })
    expect(limited).not.toHaveProperty('timing')
    expect(limited.numberBoosters).toBe(6)
  })

  it('torneo construido pasa deckType y limited=false', () => {
    const args = buildCreateTournamentArgs({
      name: 'Swiss',
      username: 'player1',
      tournamentType: 'Constructed Swiss',
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Modern',
      draft: false,
      limitedOptions: undefined,
      playerTypesFinal: ['HUMAN', 'COMPUTER_MAD'],
      password: '',
      spectatorsAllowed: true,
      wins: 2,
      numberRounds: 0,
      skillLevel: 'CASUAL',
      rated: false,
      rollbackTurnsAllowed: true,
      timeLimit: 'NONE',
      bufferTime: 'NONE',
      minimumRating: 0,
      quitRatio: 100,
      bannedUsersRaw: '',
      singleGame: false,
    })
    expect(args.deckType).toBe('Constructed - Modern')
    expect(args.limited).toBe(false)
    expect(args).not.toHaveProperty('limitedOptions')
    expect(args.quitRatio).toBe(100)
  })

  it('match mapea flags y poda undefined', () => {
    const args = buildCreateMatchArgs({
      name: 'Duel',
      username: 'player1',
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Modern',
      wins: 1,
      playerTypesFinal: ['HUMAN', 'COMPUTER_MAD'],
      seatSkills: [2, 2],
      password: '',
      skillLevel: 'CASUAL',
      rated: false,
      spectatorsAllowed: true,
      rollbackTurnsAllowed: true,
      timeLimit: 'NONE',
      bufferTime: 'NONE',
      freeMulligans: 0,
      showRangeAttack: false,
      attackOption: 'LEFT',
      range: 'ALL',
      minimumRating: 0,
      quitRatio: 100,
      edhPowerLevel: 100,
      bannedUsersRaw: '',
      mulliganType: 'GAME_DEFAULT',
      customStartLifeEnabled: false,
      customStartLife: 20,
      customStartHandSizeEnabled: false,
      customStartHandSize: 7,
      planeChase: false,
      simDecks: [],
      dev: false,
    })
    expect(args.playerTypes).toEqual(['HUMAN', 'COMPUTER_MAD'])
    expect(args.timeLimit).toBeUndefined()
    expect(args.attackOption).toBeUndefined()
    expect(args.quitRatio).toBe(100)
    expect(args).not.toHaveProperty('skipInitShuffling')
    expect(args.simDecks).toBeUndefined()
    expect(args.mulliganType).toBeUndefined()
  })
})

describe('tournamentJoinNeedsDeck', () => {
  it('solo los torneos construidos llevan mazo', () => {
    expect(tournamentJoinNeedsDeck('Constructed Swiss')).toBe(true)
    expect(tournamentJoinNeedsDeck('Constructed Elimination')).toBe(true)
    expect(tournamentJoinNeedsDeck('Booster Draft Elimination')).toBe(false)
    expect(tournamentJoinNeedsDeck('Sealed Swiss')).toBe(false)
    expect(tournamentJoinNeedsDeck(undefined)).toBe(false)
  })
})

describe('expandDraftSetCodes — un set por sobre (DraftImpl.openBooster)', () => {
  it('un solo código se repite por cada sobre (3× M21)', () => {
    expect(expandDraftSetCodes('M21', 3)).toEqual(['M21', 'M21', 'M21'])
  })

  it('sellado: un solo código se repite 6 veces', () => {
    expect(expandDraftSetCodes('m21', 6)).toEqual(['M21', 'M21', 'M21', 'M21', 'M21', 'M21'])
  })

  it('varios códigos se dejan intactos', () => {
    expect(expandDraftSetCodes('M21, MH3, DSK', 3)).toEqual(['M21', 'MH3', 'DSK'])
  })

  it('con un sobre no se expande', () => {
    expect(expandDraftSetCodes('M21', 1)).toEqual(['M21'])
  })

  it('vacío sigue vacío (lo rechaza el validador)', () => {
    expect(expandDraftSetCodes('', 3)).toEqual([])
  })

  it('el builder envía un código por sobre', () => {
    const limited = buildTournamentLimitedOptions({
      draftSetsRaw: 'M21',
      draftBoosters: 3,
      draftConstructionTime: 600,
      draftCubeName: '',
      draftTiming: 'REGULAR',
      tournamentType: 'Booster Draft Elimination',
    }) as Record<string, unknown>
    expect(limited.setCodes).toEqual(['M21', 'M21', 'M21'])
    expect(limited.sets).toEqual(['M21', 'M21', 'M21'])
  })
})

describe('validateDraftSets', () => {
  it('vacío → draft_no_sets', () => {
    expect(validateDraftSets('', 3)).toBe('draft_no_sets')
    expect(validateDraftSets(' , ', 3)).toBe('draft_no_sets')
  })

  it('un solo código siempre vale (se auto-repite)', () => {
    expect(validateDraftSets('M21', 3)).toBeNull()
  })

  it('lista completa vale', () => {
    expect(validateDraftSets('M21, MH3, DSK', 3)).toBeNull()
  })

  it('lista parcial → draft_sets_count_mismatch', () => {
    expect(validateDraftSets('M21, MH3', 3)).toBe('draft_sets_count_mismatch')
  })

  it('cubo exento del conteo', () => {
    expect(validateDraftSets('M21, MH3', 3, { cube: true })).toBeNull()
  })

  it('tipos random exentos del conteo', () => {
    expect(validateDraftSets('M21, MH3', 3, { random: true })).toBeNull()
  })
})

describe('uniformDraftSet', () => {
  it('un código suelto es uniforme', () => {
    expect(uniformDraftSet('M21')).toBe('M21')
  })

  it('repetido es uniforme', () => {
    expect(uniformDraftSet('M21, M21, M21')).toBe('M21')
  })

  it('mezcla no es uniforme', () => {
    expect(uniformDraftSet('M21, MH3, M21')).toBeNull()
  })

  it('vacío no es uniforme', () => {
    expect(uniformDraftSet('')).toBeNull()
  })
})

describe('limitedTourneyHasAiSeats', () => {
  it('todos humanos → false', () => {
    expect(limitedTourneyHasAiSeats(['HUMAN', 'HUMAN'])).toBe(false)
  })

  it('cualquier IA (SIM, draftbot, MAD) → true', () => {
    expect(limitedTourneyHasAiSeats(['HUMAN', 'SIM'])).toBe(true)
    expect(limitedTourneyHasAiSeats(['HUMAN', 'COMPUTER_DRAFT_BOT'])).toBe(true)
    expect(limitedTourneyHasAiSeats(['HUMAN', 'COMPUTER_MAD'])).toBe(true)
  })

  it('acepta alias (minúsculas)', () => {
    expect(limitedTourneyHasAiSeats(['human', 'human'])).toBe(false)
  })
})

describe('healTournamentBranch — invariante single source', () => {
  it('en modo torneo la categoría manda sobre el flag', () => {
    expect(
      healTournamentBranch({ tableCategory: 'tourney', tournamentCategory: 'limited', useDraftTournament: false }),
    ).toEqual({ tournamentCategory: 'limited', useDraftTournament: true })
    expect(
      healTournamentBranch({ tableCategory: 'tourney', tournamentCategory: 'constructed', useDraftTournament: true }),
    ).toEqual({ tournamentCategory: 'constructed', useDraftTournament: false })
  })

  it('fuera de torneo no toca nada (invariante vacuo)', () => {
    expect(
      healTournamentBranch({ tableCategory: 'duel', tournamentCategory: 'limited', useDraftTournament: false }),
    ).toEqual({ tournamentCategory: 'limited', useDraftTournament: false })
    expect(
      healTournamentBranch({ tableCategory: 'multi', tournamentCategory: 'constructed', useDraftTournament: true }),
    ).toEqual({ tournamentCategory: 'constructed', useDraftTournament: true })
  })
})
