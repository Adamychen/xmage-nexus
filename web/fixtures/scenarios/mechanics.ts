import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import { makeGameView, makePermanent, makePlayer, makeCard } from '../../src/__fixtures__/gameViews'
import { GAME_ID, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_NAME, SIM_PLAYER_ID, TABLE_ID } from '../humanGameConstants'

export function mechanicsScenario(): Scenario {
  const gameView = makeGameView({
    gameId: GAME_ID,
    turn: 3,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID,
    priorityPlayerId: HUMAN_PLAYER_ID,
    players: [
      makePlayer({
        playerId: HUMAN_PLAYER_ID,
        name: HUMAN_NAME,
        controlled: true,
        isHuman: true,
        life: 18,
        monarch: true,
        counters: [
          { name: 'Poison', count: 3 },
          { name: 'Energy', count: 5 },
        ],
        designationNames: ['Night', "City's Blessing"],
        commandList: [
          {
            id: 'ring-1',
            name: 'The Ring',
            rules: [
              'Your Ring-bearer is legendary and cannot be blocked by creatures with greater power.',
              'Whenever your Ring-bearer attacks, draw a card, then discard a card.',
            ],
          },
          {
            id: 'dung-1',
            name: 'Undercity',
            cardTypes: ['Dungeon'],
            currentRoom: 'Forge',
          },
        ],
        battlefield: {
          sam1: makePermanent({
            id: 'sam1',
            name: 'Samwise Gamgee',
            parentId: 'sam1',
            controlled: true,
            isRingBearer: true,
          } as any),
          land1: makePermanent({
            id: 'land1',
            name: 'Mountain',
            parentId: 'land1',
            controlled: true,
            cardTypes: ['Land'],
          }),
          pw1: makePermanent({
            id: 'pw1',
            name: 'Jace, the Mind Sculptor',
            parentId: 'pw1',
            controlled: true,
            cardTypes: ['Planeswalker'],
            loyalty: '3',
          }),
          keywordBeast: makePermanent({
            id: 'keywordBeast',
            name: 'Keyword Beast',
            parentId: 'keywordBeast',
            controlled: true,
            cardTypes: ['Creature'],
            power: '4',
            toughness: '4',
            rules: ['Flying, deathtouch, trample, haste', '<br/><hintstart/>', 'ICON_GOOD{this} is monstrous', "<font color = 'blue'>Suspected (has menace and can't block)</font>", "Paired with <font color='#B0C4DE'>Consul's Lieutenant [d4e]</font>"],
            cardIcons: [{ cardIconType: 'OTHER_HAS_RESTRICTIONS', hint: 'Goaded by Bob (must attack)', text: '⚠' } as unknown as Record<string, unknown>],
          } as any),
          reno1: makePermanent({
            id: 'reno1',
            name: "Consul's Lieutenant",
            parentId: 'reno1',
            controlled: true,
            cardTypes: ['Creature'],
            power: '3',
            toughness: '3',
            rules: ['First strike', 'Renown 1', '<br/><hintstart/>', 'ICON_GOOD{this} is renowned', "Paired with <font color='#B0C4DE'>Keyword Beast [b7a]</font>"],
          } as any),
          class1: makePermanent({
            id: 'class1',
            name: 'Bard Class',
            parentId: 'class1',
            controlled: true,
            cardTypes: ['Enchantment'],
            rules: ['Level 2 — Whenever you cast a legendary spell, ...', 'Class level: 2'],
          } as any),
          treasure1: makePermanent({
            id: 'treasure1',
            name: 'Treasure Token',
            parentId: 'treasure1',
            controlled: true,
            cardTypes: ['Treasure'],
            isToken: true,
          }),
          battle1: makePermanent({
            id: 'battle1',
            name: 'Invasion of Zendikar',
            parentId: 'battle1',
            controlled: true,
            cardTypes: ['Battle'],
            defense: '4',
          }),
        },
        topCard: makeCard({ name: 'Island', cardTypes: ['Land'] }),
      }),
      makePlayer({
        playerId: SIM_PLAYER_ID,
        name: SIM_NAME,
        controlled: false,
        isHuman: false,
        life: 20,
        initiative: true,
        handCount: 1,
        commandList: [
          {
            id: 'emblem-1',
            name: 'Emblem - Ember of Xenagos',
          },
          {
            id: 'cmd-1',
            name: 'Atraxa, Praetors’ Voice',
            isCommander: true,
          },
        ],
        battlefield: {
          oppLand1: makePermanent({
            id: 'oppLand1',
            name: 'Island',
            parentId: 'oppLand1',
            cardTypes: ['Land'],
          }),
          simcreature: makePermanent({
            id: 'simcreature',
            name: 'Grizzly Bears',
            parentId: 'simcreature',
            cardTypes: ['Creature'],
            attachments: ['aura1'],
          }),
          aura1: makePermanent({
            id: 'aura1',
            name: 'Rancor',
            parentId: 'aura1',
            cardTypes: ['Enchantment', 'Aura'],
            attachedTo: 'simcreature',
          }),
        },
      }),
    ],
    revealed: [
      {
        cards: {
          'rev-1': makeCard({ name: 'Shock', cardTypes: ['Instant'], manaValue: 1, expansionSetCode: 'TST', cardNumber: '1' }),
        },
      },
    ],
  })

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE.mechanics,
    gameId: GAME_ID,
    gameView,
  })
}
