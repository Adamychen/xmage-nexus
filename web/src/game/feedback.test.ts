import { describe, expect, it } from 'vitest'
import { parseFeedback } from './feedback'

describe('parseFeedback', () => {
  it('maps mulligan asks to boolean options (XMage: true = mulligan, false = keep)', () => {
    const prompt = parseFeedback('GAME_ASK', 'game-1', {
      message: 'Keep your hand or mulligan?',
      options: { keep: 'Keep hand', mulligan: 'Mulligan' },
    })
    expect(prompt?.mode).toBe('boolean')
    expect(prompt?.options).toEqual([
      { id: 'keep', label: 'Keep hand', value: 'false' },
      { id: 'mulligan', label: 'Mulligan', value: 'true' },
    ])
  })

  it('maps target UUIDs and labels them from cardsView1', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Choose a target',
      targets: ['card-1'],
      cardsView1: { 'card-1': { id: 'card-1', name: 'Forest' } },
    })
    expect(prompt?.mode).toBe('uuid')
    expect(prompt?.options).toEqual([{ id: 'card-1', label: 'Forest', value: 'card-1' }])
    expect(prompt?.required).toBe(true)
  })

  it('keeps optional target prompts finishable without selecting a target', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'You may choose a target',
      flag: false,
      targets: [],
    })
    expect(prompt?.required).toBe(false)
  })

  it('falls back to cardsView1 when XMage omits the target UUID set', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Choose a target',
      cardsView1: { 'card-1': { id: 'card-1', name: 'Forest' } },
    })
    expect(prompt?.options).toEqual([{ id: 'card-1', label: 'Forest', value: 'card-1' }])
  })

  it('labels player targets from the embedded GameView', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Choose a player',
      targets: ['player-2'],
      gameView: { players: [{ playerId: 'player-2', name: 'Bob' }] },
    })
    expect(prompt?.options).toEqual([{ id: 'player-2', label: 'Bob', value: 'player-2' }])
  })

  it('labels hand-card targets from the embedded GameView (London mulligan bottom)', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Select a card (1 more) to put on the bottom of your library',
      targets: ['card-1', 'card-2'],
      gameView: { myHand: { 'card-1': { id: 'card-1', name: 'Mountain' }, 'card-2': { id: 'card-2', name: 'Island' } } },
    })
    expect(prompt?.options).toEqual([
      { id: 'card-1', label: 'Mountain', value: 'card-1' },
      { id: 'card-2', label: 'Island', value: 'card-2' },
    ])
  })

  it('labels battlefield targets from the embedded GameView', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Choose a creature',
      targets: ['perm-1'],
      gameView: { players: [{ playerId: 'p-1', name: 'Alice', battlefield: { 'perm-1': { id: 'perm-1', name: 'Grizzly Bears' } } }] },
    })
    expect(prompt?.options).toEqual([{ id: 'perm-1', label: 'Grizzly Bears', value: 'perm-1' }])
  })

  it('exposes the source object name from options.secondMessage', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Choose target creature or player',
      targets: ['perm-1'],
      options: { secondMessage: 'Lightning Bolt' },
      gameView: { players: [] },
    })
    expect(prompt?.sourceName).toBe('Lightning Bolt')
    expect(parseFeedback('GAME_TARGET', 'game-2', { targets: [], gameView: {} })?.sourceName).toBeUndefined()
  })

  it('strips HTML tags from secondMessage', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      targets: ['perm-1'],
      options: { secondMessage: "<FONT COLOR='#FF6347'>Lightning Bolt</FONT> [e67]" },
      gameView: { players: [] },
    })
    expect(prompt?.sourceName).toBe('Lightning Bolt [e67]')
  })

  it('labels array-form card targets by id or parentId', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Choose a target',
      targets: ['card-1', 'child-2'],
      cardsView1: [
        { id: 'card-1', name: 'Forest' },
        { parentId: 'child-2', displayName: 'Island' },
      ],
    })
    expect(prompt?.options.map((option) => option.label)).toEqual(['Forest', 'Island'])
  })

  it('exposes already chosen targets for multi-target queries', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-2', {
      message: 'Choose up to two targets',
      targets: ['perm-2', 'perm-3'],
      options: { chosenTargets: ['perm-1'] },
      gameView: { players: [] },
    })
    expect(prompt?.chosenTargets).toEqual(['perm-1'])
    expect(parseFeedback('GAME_TARGET', 'game-2', { targets: [], gameView: {} })?.chosenTargets).toBeUndefined()
  })

  it('maps "pass anyway?" asks to a boolean (XMage: true = pass)', () => {
    const prompt = parseFeedback('GAME_ASK', 'game-1', {
      message: 'You still have mana in your mana pool. Do you want to continue playing or pass anyway?',
      options: { 'pass-anyway': 'Pass anyway?', 'continue': 'Continue playing' },
    })
    expect(prompt?.mode).toBe('boolean')
    expect(prompt?.options.map((option) => option.value)).toEqual(['true', 'false'])
  })

  it('maps mulligan boolean labels via no/yes keywords and positional fallbacks', () => {
    const prompt = parseFeedback('GAME_ASK', 'game-1', {
      message: 'Mulligan?',
      options: {
        maybe: 'Maybe',
        cancel: 'No, thank you',
        accept: 'Yes, go ahead',
        later: 'Never mind',
      },
    })
    expect(prompt?.mode).toBe('boolean')
    expect(prompt?.options.map((option) => option.value)).toEqual(['true', 'false', 'true', 'false'])
  })

  it('does not treat GAME_SELECT priority as a modal card selection', () => {
    expect(parseFeedback('GAME_SELECT', 'game-2', { message: 'Play spells and abilities' })).toBeNull()
  })

  it('maps amount bounds and multi-amount items', () => {
    const amount = parseFeedback('GAME_GET_AMOUNT', 'game-3', { message: 'How many?', min: 1, max: 4 })
    expect(amount).toMatchObject({ mode: 'integer', min: 1, max: 4 })

    const multi = parseFeedback('GAME_GET_MULTI_AMOUNT', 'game-3', {
      min: 0,
      max: 5,
      messages: [{ id: 'x', message: 'First', min: 1, max: 2, defaultValue: 2 }],
    })
    expect(multi?.mode).toBe('multiString')
    expect(multi?.items).toEqual([{ id: 'x', label: 'First', min: 1, max: 2, defaultValue: 2 }])
  })

  it('marks multi-amount cancellable only when options.canCancel is true (MultiAmountType.isCanCancel)', () => {
    const payload = {
      min: 0,
      max: 5,
      messages: [{ id: 'x', message: 'Assign damage', min: 1, max: 2, defaultValue: 2 }],
    }
    const cancellable = parseFeedback('GAME_GET_MULTI_AMOUNT', 'game-3b', {
      ...payload,
      options: { title: 'Assign damage', header: 'Assign damage among blockers', canCancel: true },
    })
    expect(cancellable?.required).toBe(false)

    const mandatory = parseFeedback('GAME_GET_MULTI_AMOUNT', 'game-3b', {
      ...payload,
      options: { title: 'Assign damage', header: 'Assign damage among blockers' },
    })
    expect(mandatory?.required).toBe(true)
  })

  it('keeps sourceName undefined when the ability/pile/X/multi-amount payload carries no source (no fabrication)', () => {
    const ability = parseFeedback('GAME_CHOOSE_ABILITY', 'game-32', {
      message: 'Choose an ability',
      choices: { a1: 'Triggered ability' },
    })
    expect(ability?.sourceName).toBeUndefined()

    const pile = parseFeedback('GAME_CHOOSE_PILE', 'game-32', {
      message: 'Separate the cards into two piles',
      cardsView1: { c1: { id: 'c1', name: 'Grizzly Bears' } },
      cardsView2: { c2: { id: 'c2', name: 'Shock' } },
    })
    expect(pile?.sourceName).toBeUndefined()

    const x = parseFeedback('GAME_PLAY_XMANA', 'game-32', { message: 'Pay X mana?' })
    expect(x?.sourceName).toBeUndefined()

    const multi = parseFeedback('GAME_GET_MULTI_AMOUNT', 'game-32', {
      min: 0,
      max: 3,
      messages: [{ id: 'x', message: 'First', min: 0, max: 3 }],
    })
    expect(multi?.sourceName).toBeUndefined()
  })

  it('extracts the " (source: X)" suffix (HumanPlayer.getAmount) on ability/pile/X and strips it from the message', () => {
    const ability = parseFeedback('GAME_CHOOSE_ABILITY', 'game-33', {
      message: 'Choose an ability (source: Teferi, Hero of Dominaria)',
      choices: { a1: 'Triggered ability' },
    })
    expect(ability?.sourceName).toBe('Teferi, Hero of Dominaria')
    expect(ability?.message).toBe('Choose an ability')

    const pile = parseFeedback('GAME_CHOOSE_PILE', 'game-33', { message: 'Separate the cards into two piles (source: Fact or Fiction)' })
    expect(pile?.sourceName).toBe('Fact or Fiction')
    expect(pile?.message).toBe('Separate the cards into two piles')

    const x = parseFeedback('GAME_PLAY_XMANA', 'game-33', { message: 'Pay X mana? (source: Walking Ballista)' })
    expect(x?.sourceName).toBe('Walking Ballista')
    expect(x?.message).toBe('Pay X mana?')
  })

  it('exposes sourceName on card selections from options.secondMessage and strips the source suffix on choose-cards', () => {
    const select = parseFeedback('GAME_SELECT_CARDS', 'game-34', {
      message: 'Select up to two cards',
      cardsView1: { 'c-a': { id: 'c-a', name: 'Mountain' } },
      min: 1,
      max: 2,
      options: { secondMessage: 'Demonic Tutor' },
    })
    expect(select?.sourceName).toBe('Demonic Tutor')

    const targets = parseFeedback('GAME_SELECT_TARGETS', 'game-34', {
      message: 'Select targets',
      options: { secondMessage: 'Arc Lightning' },
    })
    expect(targets?.sourceName).toBe('Arc Lightning')

    const choose = parseFeedback('GAME_CHOOSE_CARDS', 'game-34', {
      message: 'Search your library for a card (source: Demonic Tutor)',
      cardsView1: { 'c-a': { id: 'c-a', name: 'Mountain' } },
    })
    expect(choose?.sourceName).toBe('Demonic Tutor')
    expect(choose?.message).toBe('Search your library for a card')
  })

  it('maps pile choices to booleans and mana to a controlled player', () => {
    const pile = parseFeedback('GAME_CHOOSE_PILE', 'game-4', { cardsView1: { a: {} }, cardsView2: { b: {}, c: {} } })
    expect(pile?.options.map((option) => option.value)).toEqual(['true', 'false'])

    // GAME_PLAY_MANA: el servidor no manda colores (solo queryType); el pago es
    // clicando fuentes de maná en el tablero, por lo que no debe fabricar botones.
    const mana = parseFeedback('GAME_PLAY_MANA', 'game-4', {
      gameView: { players: [{ controlled: true, playerId: 'player-1' }] },
      options: { queryType: 'PLAY_MANA' },
    })
    expect(mana).toMatchObject({ mode: 'mana', playerId: 'player-1' })
    expect(mana?.options).toEqual([])
  })

  it('maps the server AbilityPickerView and keyed choices', () => {
    const ability = parseFeedback('GAME_CHOOSE_ABILITY', 'game-5', {
      message: 'Choose an ability',
      choices: { 'ability-1': 'Cast the first spell' },
    })
    expect(ability?.options).toEqual([{ id: 'ability-1', label: 'Cast the first spell', value: 'ability-1' }])

    const choice = parseFeedback('GAME_CHOOSE_CHOICE', 'game-5', {
      choice: { message: 'Choose a mode', keyChoices: { 'mode-a': 'First mode' } },
    })
    expect(choice?.options).toEqual([{ id: 'mode-a', label: 'First mode', value: 'mode-a' }])
  })

  it('applies sortData order and extracts hintData/special/search flags from Choice', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CHOICE', 'game-5b', {
      choice: {
        message: 'Choose a tactic',
        keyChoices: { 'a': 'Alpha', 'b': 'Beta', 'c': 'Gamma' },
        sortData: { 'c': 1, 'a': 2, 'b': 3 },
        hintData: { 'a': ['text', 'Fast and early'], 'c': ['card', 'Lightning Bolt'] },
        specialEnabled: true,
        specialText: 'Always pick this',
        searchEnabled: false,
      },
    })
    expect(prompt?.options.map((o) => o.id)).toEqual(['c', 'a', 'b'])
    expect(prompt?.choiceHints).toEqual({ 'a': 'Fast and early', 'c': 'Lightning Bolt' })
    expect(prompt?.choiceSpecial).toBe(true)
    expect(prompt?.choiceSearch).toBe(false)
  })

  it('leaves Choice metadata undefined when the server sends none', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CHOICE', 'game-5c', {
      choice: { message: 'Choose a mode', keyChoices: { 'mode-a': 'First mode' } },
    })
    expect(prompt?.choiceHints).toBeUndefined()
    expect(prompt?.choiceSpecial).toBeUndefined()
    expect(prompt?.choiceSearch).toBeUndefined()
  })

  it('extracts sourceName from Choice.subMessage (ChoiceCreatureType/ChoicePlaneswalkerType set it to the source name)', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CHOICE', 'game-5e', {
      choice: { message: 'Choose a creature type', keyChoices: { 'Elf': 'Elf' }, subMessage: 'Cavern of Souls' },
    })
    expect(prompt?.sourceName).toBe('Cavern of Souls')
  })

  it('leaves sourceName undefined for GAME_CHOOSE_CHOICE when Choice.subMessage is absent', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CHOICE', 'game-5f', {
      choice: { message: 'Choose a pile to put into hand.', keyChoices: { 'a': 'Pile 1' } },
    })
    expect(prompt?.sourceName).toBeUndefined()
  })

  it('extracts sourceName from the " (source: X)" suffix HumanPlayer.getAmount appends to the message, and strips it from the displayed text', () => {
    const prompt = parseFeedback('GAME_GET_AMOUNT', 'game-5g', {
      message: 'X value for spell (source: Walking Ballista)',
      min: 0,
      max: 20,
    })
    expect(prompt?.message).toBe('X value for spell')
    expect(prompt?.sourceName).toBe('Walking Ballista')
  })

  it('leaves GAME_GET_AMOUNT message untouched when there is no source suffix', () => {
    const prompt = parseFeedback('GAME_GET_AMOUNT', 'game-5h', { message: 'How many?', min: 1, max: 4 })
    expect(prompt?.message).toBe('How many?')
    expect(prompt?.sourceName).toBeUndefined()
  })

  it('parses pile card views into pileCards, else falls back to text options', () => {
    const card = (id: string, name: string) => ({ id, name, displayName: name })
    const withCards = parseFeedback('GAME_CHOOSE_PILE', 'game-5d', {
      message: 'Separate the piles',
      cardsView1: { 'c1': card('c1', 'Grizzly Bears') },
      cardsView2: { 'c2': card('c2', 'Lightning Bolt'), 'c3': card('c3', 'Shock') },
    })
    expect(withCards?.pileCards?.pile1.map((c) => c.name)).toEqual(['Grizzly Bears'])
    expect(withCards?.pileCards?.pile2.map((c) => c.name)).toEqual(['Lightning Bolt', 'Shock'])
    expect(withCards?.options).toHaveLength(2)

    const withoutCards = parseFeedback('GAME_CHOOSE_PILE', 'game-5e', { message: 'Separate the piles' })
    expect(withoutCards?.pileCards).toBeUndefined()
    expect(withoutCards?.options).toHaveLength(2)
  })

  it('extracts cards from cardsView1 into the cards field', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-6', {
      message: 'Search your library for a creature card',
      cardsView1: {
        'card-1': {
          id: 'card-1', name: 'Grizzly Bears', displayName: 'Grizzly Bears',
          expansionSetCode: 'IMA', cardNumber: '165',
          manaCostLeftStr: ['{1}{G}'], manaValue: 2,
          cardTypes: ['CREATURE'], power: '2', toughness: '2',
          color: { white: false, blue: false, black: false, red: false, green: true },
          rules: ['{G}: Gets +1/+0 until EOT'],
        },
        'card-2': {
          id: 'card-2', name: 'Lightning Bolt', displayName: 'Lightning Bolt',
          expansionSetCode: 'M10', cardNumber: '147',
          manaCostLeftStr: ['{R}'], manaValue: 1,
          cardTypes: ['INSTANT'],
          color: { white: false, blue: false, black: false, red: true, green: false },
        },
      },
      targets: ['card-1'],
    })
    expect(prompt?.cards).toHaveLength(2)
    expect(prompt?.cards?.[0]).toMatchObject({
      id: 'card-1',
      name: 'Grizzly Bears',
      expansionSetCode: 'IMA',
      cardNumber: '165',
      power: '2',
      toughness: '2',
    })
    expect(prompt?.cards?.[1]).toMatchObject({
      id: 'card-2',
      name: 'Lightning Bolt',
      expansionSetCode: 'M10',
    })
  })

  it('does not populate cards when cardsView1 is absent', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-6', {
      message: 'Choose a target',
      targets: ['perm-1'],
      gameView: { players: [{ playerId: 'p-1', name: 'Alice', battlefield: { 'perm-1': { id: 'perm-1', name: 'Bear' } } }] },
    })
    expect(prompt?.cards).toBeUndefined()
  })

  it('returns prompts for GAME_CHOOSE_MODE and friends', () => {
    expect(parseFeedback('GAME_CHOOSE_MODE', 'game-7', { message: 'Choose a mode' }))?.toMatchObject({ mode: 'uuid', title: 'Elige modo' })
    expect(parseFeedback('GAME_CHOOSE_ONE', 'game-7', { message: 'Choose one', options: { a: 'Option A', b: 'Option B' } }))?.toMatchObject({ mode: 'string' })
    expect(parseFeedback('GAME_CHOOSE_COLOR', 'game-7', { message: 'Choose a color' }))?.toMatchObject({ mode: 'string', title: 'Elige un color' })
    expect(parseFeedback('GAME_CHOOSE_NUMBER', 'game-7', { message: 'Pick a number', min: 0, max: 5 }))?.toMatchObject({ mode: 'integer' })
    expect(parseFeedback('GAME_CHOOSE_STRING', 'game-7', { message: 'Name a card', options: ['Bolt', 'Swords'] }))?.toMatchObject({ mode: 'string' })
    expect(parseFeedback('GAME_CHOOSE_BETWEEN', 'game-7', { message: 'Choose', options: { a: 'A', b: 'B' } }))?.toMatchObject({ mode: 'string' })
  })

  it('maps GAME_SELECT_PLAYER to uuid with player labels from the GameView', () => {
    const prompt = parseFeedback('GAME_SELECT_PLAYER', 'game-8', {
      message: 'Choose a player',
      targets: ['player-2'],
      options: { possibleTargets: ['player-2'] },
      gameView: { players: [{ playerId: 'player-2', name: 'Bob' }] },
    })
    expect(prompt?.mode).toBe('uuid')
    expect(prompt?.options).toEqual([{ id: 'player-2', label: 'Bob', value: 'player-2' }])
  })

  it('maps GAME_TARGET_PLAYER to uuid with player labels from the GameView', () => {
    const prompt = parseFeedback('GAME_TARGET_PLAYER', 'game-8', {
      message: 'Choose a player',
      targets: ['player-2'],
      options: { possibleTargets: ['player-2'] },
      gameView: { players: [{ playerId: 'player-2', name: 'Bob' }] },
    })
    expect(prompt?.mode).toBe('uuid')
    expect(prompt?.options).toEqual([{ id: 'player-2', label: 'Bob', value: 'player-2' }])
  })

  it('maps GAME_TARGET_AMOUNT to an integer prompt with bounds', () => {
    const prompt = parseFeedback('GAME_TARGET_AMOUNT', 'game-9', {
      message: 'Distribute the damage',
      min: 1,
      max: 5,
    })
    expect(prompt).toMatchObject({ mode: 'integer', min: 1, max: 5 })
  })

  it('maps GAME_PLAY_XMANA to a boolean (Confirmar/Cancelar)', () => {
    const prompt = parseFeedback('GAME_PLAY_XMANA', 'game-10', { message: 'Pay X mana?' })
    expect(prompt?.mode).toBe('boolean')
    expect(prompt?.options.map((option) => option.value)).toEqual(['true', 'false'])
  })

  it('maps GAME_SELECT_CARDS to uuid options from cardsView1 with bounds', () => {
    const prompt = parseFeedback('GAME_SELECT_CARDS', 'game-11', {
      message: 'Select up to two cards',
      cardsView1: { 'c-a': { id: 'c-a', name: 'Mountain' }, 'c-b': { id: 'c-b', name: 'Island' } },
      min: 1,
      max: 2,
    })
    expect(prompt?.mode).toBe('uuid')
    expect(prompt?.min).toBe(1)
    expect(prompt?.max).toBe(2)
    expect(prompt?.options).toEqual([
      { id: 'c-a', label: 'Mountain', value: 'c-a' },
      { id: 'c-b', label: 'Island', value: 'c-b' },
    ])
  })

  it('maps GAME_CHOOSE_CARDS to uuid options from cardsView1 with bounds', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CARDS', 'game-13', {
      message: 'Choose two cards',
      cardsView1: { 'c-a': { id: 'c-a', name: 'Mountain' }, 'c-b': { id: 'c-b', name: 'Island' } },
      min: 1,
      max: 2,
    })
    expect(prompt?.mode).toBe('uuid')
    expect(prompt?.min).toBe(1)
    expect(prompt?.max).toBe(2)
    expect(prompt?.options).toEqual([
      { id: 'c-a', label: 'Mountain', value: 'c-a' },
      { id: 'c-b', label: 'Island', value: 'c-b' },
    ])
  })

  it('maps GAME_CHOOSE_STRING without options to a string prompt (free text)', () => {
    const prompt = parseFeedback('GAME_CHOOSE_STRING', 'game-12', { message: 'Name a card' })
    expect(prompt?.mode).toBe('string')
    expect(prompt?.options).toEqual([])
  })

  it('uses a discard-specific title when the message indicates a discard (Thoughtseize)', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CARDS', 'game-15', {
      message: 'Choose a card for them to discard',
      cardsView1: { 'c-1': { id: 'c-1', name: 'Lightning Bolt' } },
      min: 1,
      max: 1,
    })
    expect(prompt?.title).toBe('Elige una carta para que descarte')
  })

  it('maps GAME_CHOOSE_CARDS_ORDER to an order prompt (library reorder / scry)', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CARDS_ORDER', 'game-14', {
      message: 'Reorder the top cards of your library',
      cardsView1: { 'c-a': { id: 'c-a', name: 'Mountain' }, 'c-b': { id: 'c-b', name: 'Island' } },
    })
    expect(prompt?.mode).toBe('order')
    expect(prompt?.options?.map((o) => o.value)).toEqual(['c-a', 'c-b'])
  })

  it('routes voting GAME_ASK to VotingDialog', () => {
    const prompt = parseFeedback('GAME_ASK', 'game-20', {
      message: 'Vote, step 1 of 2',
      options: { yes: 'Strength', no: 'Numbers' },
    })
    expect(prompt?.isVoting).toBe(true)
    expect(prompt?.title).toBe('Votación en Curso')
  })

  it('also routes voting to VotingDialog when the server sends the vote as GAME_TARGET (single-candidate vote, real frame vote.json)', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-20b', {
      message: 'Vote for a permanent',
      targets: ['perm-1'],
      cardsView1: { 'perm-1': { id: 'perm-1', name: 'Elvish Mystic' } },
    })
    expect(prompt?.method).toBe('GAME_TARGET')
    expect(prompt?.mode).toBe('uuid')
    expect(prompt?.isVoting).toBe(true)
    expect(prompt?.title).toBe('Votación en Curso')
  })

  it('does not mark a starting-player GAME_TARGET as a vote even though isStartingPlayer is also derived from message text', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-20c', {
      message: 'Select a starting player',
      targets: ['p1', 'p2'],
    })
    expect(prompt?.isStartingPlayer).toBe(true)
    expect(prompt?.isVoting).toBeFalsy()
  })

  it('routes planeswalker GAME_CHOOSE_ABILITY to dedicated dialog with loyalty deltas', () => {
    const prompt = parseFeedback('GAME_CHOOSE_ABILITY', 'game-21', {
      message: 'Activate a loyalty ability',
      choices: { a1: '+2: Scry 1', a2: '-3: Draw 2', a3: '-8: Ultimate' },
    })
    expect(prompt?.isPlaneswalkerAbility).toBe(true)
    expect(prompt?.loyaltyDeltas).toEqual([2, -3, -8])
    expect(prompt?.title).toBe('Habilidad de Planeswalker')
  })

  it('does not misroute non-planeswalker ability', () => {
    const prompt = parseFeedback('GAME_CHOOSE_ABILITY', 'game-22', {
      message: 'Choose an ability',
      choices: { a1: 'Triggered ability' },
    })
    expect(prompt?.isPlaneswalkerAbility).toBeUndefined()
  })

  it('filters out XMage server metadata from GAME_ASK (e.g. unspent mana warning)', () => {
    const prompt = parseFeedback('GAME_ASK', 'game-23', {
      message: 'You still have mana in your mana pool and it will be lost. Pass anyway?',
      options: {
        'UI.left.btn.text': 'Yes',
        'UI.right.btn.text': 'No',
        'queryType': 'ASK',
        'autoAnswerMessage': 'You still have mana in your mana pool and it will be lost. Pass anyway?',
      },
    })
    expect(prompt?.options).toHaveLength(2)
    expect(prompt?.options).toEqual([
      { id: 'left', label: 'Yes', value: 'true' },
      { id: 'right', label: 'No', value: 'false' },
    ])
  })

  it('extracts secondMessage as sourceName on shocklands without turning it into a button', () => {
    const prompt = parseFeedback('GAME_ASK', 'game-24', {
      message: 'Pay 2 life? (otherwise Steam Vents enters tapped)',
      options: {
        'UI.left.btn.text': 'Pay 2 life',
        'UI.right.btn.text': 'Enter tapped',
        'queryType': 'ASK',
        'autoAnswerMessage': 'Pay 2 life? (otherwise Steam Vents enters tapped)',
        'secondMessage': 'Steam Vents',
        'originalId': 'uuid-123',
      },
    })
    expect(prompt?.sourceName).toBe('Steam Vents')
    expect(prompt?.options).toEqual([
      { id: 'left', label: 'Pay 2 life', value: 'true' },
      { id: 'right', label: 'Enter tapped', value: 'false' },
    ])
  })

  it('extracts choices from ChoiceImpl.choices array when keyChoices is empty (ChoiceColor)', () => {
    const prompt = parseFeedback('GAME_CHOOSE_CHOICE', 'game-25', {
      choice: {
        message: 'Choose a color',
        choices: ['White', 'Blue', 'Black', 'Red', 'Green'],
        keyChoices: {},
        searchEnabled: true,
        chosenNormal: false,
      },
    })
    expect(prompt?.options).toHaveLength(5)
    expect(prompt?.options.map((o) => o.label)).toEqual(['White', 'Blue', 'Black', 'Red', 'Green'])
    expect(prompt?.options.some((o) => o.label === 'searchEnabled' || o.label === 'chosenNormal')).toBe(false)
  })

  it('resolves target labels across stack, graveyard, and exile zones', () => {
    const prompt = parseFeedback('GAME_TARGET', 'game-26', {
      targets: ['spell-1', 'grave-1', 'exile-1'],
      gameView: {
        stack: {
          'spell-1': { id: 'spell-1', name: 'Counterspell' },
        },
        players: [
          {
            playerId: 'p1',
            graveyard: {
              'grave-1': { id: 'grave-1', name: 'Snapcaster Mage' },
            },
            exile: {
              'exile-1': { id: 'exile-1', name: 'Lightning Bolt' },
            },
          },
        ],
      },
    })
    expect(prompt?.options).toEqual([
      { id: 'spell-1', label: 'Counterspell', value: 'spell-1' },
      { id: 'grave-1', label: 'Snapcaster Mage', value: 'grave-1' },
      { id: 'exile-1', label: 'Lightning Bolt', value: 'exile-1' },
    ])
  })

  describe('library order pick (Ponder-like, real GAME_TARGET sequence — GAME_CHOOSE_CARDS_ORDER does not exist server-side)', () => {
    it('flags isLibraryOrderPick and uses the ordering title for the exact Ponder message', () => {
      const prompt = parseFeedback('GAME_TARGET', 'game-27', {
        targets: ['c1', 'c2', 'c3'],
        message: 'Select a card order to put on the TOP of your library (last one chosen will be topmost)',
        cardsView1: {
          c1: { id: 'c1', name: 'Grizzly Bears' },
          c2: { id: 'c2', name: 'Forest' },
          c3: { id: 'c3', name: 'Opt' },
        },
      })
      expect(prompt?.isLibraryOrderPick).toBe(true)
      expect(prompt?.title).toBe('Ordenando cartas')
    })

    it('does not flag a generic "Select a card" GAME_TARGET (Brainstorm-style, indistinguishable from ordinary targeting)', () => {
      const prompt = parseFeedback('GAME_TARGET', 'game-28', {
        targets: ['c1', 'c2'],
        message: 'Select a card',
      })
      expect(prompt?.isLibraryOrderPick).toBeUndefined()
      expect(prompt?.title).toBe('Elige objetivo')
    })

    it('does not flag the bottom-of-library mulligan message (isMulliganLondon owns that pattern)', () => {
      const prompt = parseFeedback('GAME_TARGET', 'game-29', {
        targets: ['c1'],
        message: 'Select a card to put on the bottom of your library',
      })
      expect(prompt?.isLibraryOrderPick).toBeUndefined()
      expect(prompt?.isMulliganLondon).toBe(true)
    })
  })
})
