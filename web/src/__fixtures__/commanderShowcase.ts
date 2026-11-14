import type { CardView, GameView, PermanentView, PlayableObjectStats } from '../net/types'
import { commanderInfoRule, makeCard, makeGameView, makePermanent, makePlayer } from './gameViews'

export const SHOWCASE_GAME_ID = 'game-commander-showcase'
export const SHOWCASE_PLAYERS = {
  atraxa: 'showcase-atraxa',
  saheeli: 'showcase-saheeli',
  edgar: 'showcase-edgar',
  meren: 'showcase-meren',
} as const

type Meta = [name: string, set: string, number: string, types: string[], cost: string, pt: string, loyalty: string, supertypes: string[], subtypes: string[]]

const META: Meta[] = [
  ['Atraxa, Praetors\' Voice', 'C16', '28', ['CREATURE'], '{G}{W}{U}{B}', '4/4', '', ['LEGENDARY'], ['PHYREXIAN','ANGEL','HORROR']],
  ['Command Tower', 'C16', '286', ['LAND'], '', '', '', [], []],
  ['Arcane Sanctum', 'C16', '281', ['LAND'], '', '', '', [], []],
  ['Opulent Palace', 'C16', '313', ['LAND'], '', '', '', [], []],
  ['Sandsteppe Citadel', 'C16', '320', ['LAND'], '', '', '', [], []],
  ['Seaside Citadel', 'C16', '322', ['LAND'], '', '', '', [], []],
  ['Opal Palace', 'C16', '312', ['LAND'], '', '', '', [], []],
  ['Exotic Orchard', 'C16', '295', ['LAND'], '', '', '', [], []],
  ['Underground River', 'C16', '335', ['LAND'], '', '', '', [], []],
  ['Plains', 'C16', '337', ['LAND'], '', '', '', ['BASIC'], ['PLAINS']],
  ['Island', 'C16', '340', ['LAND'], '', '', '', ['BASIC'], ['ISLAND']],
  ['Swamp', 'C16', '343', ['LAND'], '', '', '', ['BASIC'], ['SWAMP']],
  ['Forest', 'C16', '349', ['LAND'], '', '', '', ['BASIC'], ['FOREST']],
  ['Invasion of Zendikar', 'MOM', '194', ['BATTLE'], '{3}{G}', '', '', [], ['SIEGE']],
  ['History of Benalia', 'DOM', '21', ['ENCHANTMENT'], '{1}{W}{W}', '', '', ['LEGENDARY'], ['SAGA']],
  ['Sol Ring', 'C16', '272', ['ARTIFACT'], '{1}', '', '', [], []],
  ['Fellwar Stone', 'C16', '254', ['ARTIFACT'], '{2}', '', '', [], []],
  ['Simic Signet', 'C16', '270', ['ARTIFACT'], '{2}', '', '', [], []],
  ['Commander\'s Sphere', 'C16', '248', ['ARTIFACT'], '{3}', '', '', [], []],
  ['Darksteel Ingot', 'C16', '250', ['ARTIFACT'], '{3}', '', '', [], []],
  ['Hardened Scales', 'C16', '152', ['ENCHANTMENT'], '{G}', '', '', [], []],
  ['Cathars\' Crusade', 'C16', '61', ['ENCHANTMENT'], '{3}{W}{W}', '', '', [], []],
  ['Bred for the Hunt', 'C16', '186', ['ENCHANTMENT'], '{1}{G}{U}', '', '', [], []],
  ['Master Biomancer', 'C16', '210', ['CREATURE'], '{2}{G}{U}', '2/4', '', [], ['ELF','WIZARD']],
  ['Corpsejack Menace', 'C16', '190', ['CREATURE'], '{2}{B}{G}', '4/4', '', [], ['FUNGUS']],
  ['Kalonian Hydra', 'C16', '154', ['CREATURE'], '{3}{G}{G}', '0/0', '', [], ['HYDRA']],
  ['Champion of Lambholt', 'C16', '144', ['CREATURE'], '{1}{G}{G}', '1/1', '', [], ['HUMAN','WARRIOR']],
  ['Deepglow Skate', 'C16', '7', ['CREATURE'], '{4}{U}', '3/3', '', [], ['FISH']],
  ['Juniper Order Ranger', 'C16', '207', ['CREATURE'], '{3}{G}{W}', '2/4', '', [], ['HUMAN','KNIGHT','RANGER']],
  ['Putrefy', 'C16', '217', ['INSTANT'], '{1}{B}{G}', '', '', [], []],
  ['Mirrorweave', 'C16', '234', ['INSTANT'], '{2}{W/U}{W/U}', '', '', [], []],
  ['Migratory Route', 'C16', '38', ['SORCERY'], '{3}{W}{U}', '', '', [], []],
  ['Languish', 'C16', '114', ['SORCERY'], '{2}{B}{B}', '', '', [], []],
  ['Evolving Wilds', 'C16', '294', ['LAND'], '', '', '', [], []],
  ['Treasure Cruise', 'C16', '101', ['SORCERY'], '{7}{U}', '', '', [], []],
  ['Manifold Insights', 'C16', '10', ['SORCERY'], '{2}{U}', '', '', [], []],
  ['Solidarity of Heroes', 'C16', '168', ['INSTANT'], '{1}{G}', '', '', [], []],
  ['Grip of Phyresis', 'C16', '9', ['INSTANT'], '{2}{U}', '', '', [], []],
  ['Thrummingbird', 'C16', '100', ['CREATURE'], '{1}{U}', '1/1', '', [], ['PHYREXIAN','BIRD','HORROR']],
  ['Festercreep', 'C16', '110', ['CREATURE'], '{1}{B}', '0/0', '', [], ['ELEMENTAL']],
  ['Necroplasm', 'C16', '115', ['CREATURE'], '{1}{B}{B}', '1/1', '', [], ['OOZE']],
  ['Elite Scaleguard', 'C16', '65', ['CREATURE'], '{4}{W}', '2/3', '', [], ['HUMAN','SOLDIER']],
  ['Saheeli, the Gifted', 'C18', '44', ['PLANESWALKER'], '{2}{U}{R}', '', '4', ['LEGENDARY'], ['SAHEELI']],
  ['Island', 'C18', '296', ['LAND'], '', '', '', ['BASIC'], ['ISLAND']],
  ['Mountain', 'C18', '302', ['LAND'], '', '', '', ['BASIC'], ['MOUNTAIN']],
  ['Seat of the Synod', 'C18', '278', ['ARTIFACT','LAND'], '', '', '', [], []],
  ['Great Furnace', 'C18', '250', ['ARTIFACT','LAND'], '', '', '', [], []],
  ['Darksteel Citadel', 'C18', '241', ['ARTIFACT','LAND'], '', '', '', [], []],
  ['Izzet Boilerworks', 'C18', '256', ['LAND'], '', '', '', [], []],
  ['Command Tower', 'C18', '240', ['LAND'], '', '', '', [], []],
  ['Sol Ring', 'C18', '222', ['ARTIFACT'], '{1}', '', '', [], []],
  ['Mind Stone', 'C18', '210', ['ARTIFACT'], '{2}', '', '', [], []],
  ['Izzet Signet', 'C18', '207', ['ARTIFACT'], '{2}', '', '', [], []],
  ['Hedron Archive', 'C18', '206', ['ARTIFACT'], '{4}', '', '', [], []],
  ['Swiftfoot Boots', 'C18', '225', ['ARTIFACT'], '{2}', '', '', [], ['EQUIPMENT']],
  ['Thopter Spy Network', 'C18', '107', ['ENCHANTMENT'], '{2}{U}{U}', '', '', [], []],
  ['Retrofitter Foundry', 'C18', '57', ['ARTIFACT'], '{1}', '', '', [], []],
  ['Unwinding Clock', 'C18', '228', ['ARTIFACT'], '{4}', '', '', [], []],
  ['Whirler Rogue', 'C18', '111', ['CREATURE'], '{2}{U}{U}', '2/2', '', [], ['HUMAN','ROGUE','ARTIFICER']],
  ['Maverick Thopterist', 'C18', '185', ['CREATURE'], '{3}{U}{R}', '2/2', '', [], ['HUMAN','ARTIFICER']],
  ['Myr Battlesphere', 'C18', '212', ['ARTIFACT','CREATURE'], '{7}', '4/7', '', [], ['MYR','CONSTRUCT']],
  ['Chaos Warp', 'C18', '122', ['INSTANT'], '{2}{R}', '', '', [], []],
  ['Into the Roil', 'C18', '92', ['INSTANT'], '{1}{U}', '', '', [], []],
  ['Thirst for Knowledge', 'C18', '106', ['INSTANT'], '{2}{U}', '', '', [], []],
  ['Pilgrim\'s Eye', 'C18', '214', ['ARTIFACT','CREATURE'], '{3}', '1/1', '', [], ['THOPTER']],
  ['Etherium Sculptor', 'C18', '90', ['ARTIFACT','CREATURE'], '{1}{U}', '1/2', '', [], ['VEDALKEN','ARTIFICER']],
  ['Reverse Engineer', 'C18', '99', ['SORCERY'], '{3}{U}{U}', '', '', [], []],
  ['Edgar Markov', 'C17', '36', ['CREATURE'], '{3}{R}{W}{B}', '4/4', '', ['LEGENDARY'], ['VAMPIRE','KNIGHT']],
  ['Swamp', 'C17', '301', ['LAND'], '', '', '', ['BASIC'], ['SWAMP']],
  ['Mountain', 'C17', '304', ['LAND'], '', '', '', ['BASIC'], ['MOUNTAIN']],
  ['Plains', 'C17', '295', ['LAND'], '', '', '', ['BASIC'], ['PLAINS']],
  ['Nomad Outpost', 'C17', '265', ['LAND'], '', '', '', [], []],
  ['Orzhov Basilica', 'C17', '268', ['LAND'], '', '', '', [], []],
  ['Rakdos Carnarium', 'C17', '270', ['LAND'], '', '', '', [], []],
  ['Command Tower', 'C17', '242', ['LAND'], '', '', '', [], []],
  ['Path of Ancestry', 'C17', '56', ['LAND'], '', '', '', [], []],
  ['Boros Signet', 'C17', '205', ['ARTIFACT'], '{2}', '', '', [], []],
  ['Orzhov Signet', 'C17', '219', ['ARTIFACT'], '{2}', '', '', [], []],
  ['Door of Destinies', 'C17', '208', ['ARTIFACT'], '{4}', '', '', [], []],
  ['Heirloom Blade', 'C17', '52', ['ARTIFACT'], '{3}', '', '', [], ['EQUIPMENT']],
  ['Sanguine Bond', 'C17', '124', ['ENCHANTMENT'], '{3}{B}{B}', '', '', [], []],
  ['Black Market', 'C17', '98', ['ENCHANTMENT'], '{3}{B}{B}', '', '', [], []],
  ['Captivating Vampire', 'C17', '104', ['CREATURE'], '{1}{B}{B}', '2/2', '', [], ['VAMPIRE']],
  ['Drana, Kalastria Bloodchief', 'C17', '112', ['CREATURE'], '{3}{B}{B}', '4/4', '', ['LEGENDARY'], ['VAMPIRE','SHAMAN']],
  ['Vampire Nighthawk', 'C17', '129', ['CREATURE'], '{1}{B}{B}', '2/3', '', [], ['VAMPIRE','SHAMAN']],
  ['Blood Artist', 'C17', '99', ['CREATURE'], '{1}{B}', '0/1', '', [], ['VAMPIRE']],
  ['Stromkirk Captain', 'C17', '197', ['CREATURE'], '{1}{B}{R}', '2/2', '', [], ['VAMPIRE','SOLDIER']],
  ['Go for the Throat', 'C17', '114', ['INSTANT'], '{1}{B}', '', '', [], []],
  ['Read the Bones', 'C17', '122', ['SORCERY'], '{2}{B}', '', '', [], []],
  ['Falkenrath Noble', 'C17', '113', ['CREATURE'], '{3}{B}', '2/2', '', [], ['VAMPIRE','NOBLE']],
  ['Bloodhusk Ritualist', 'C17', '101', ['CREATURE'], '{2}{B}', '2/2', '', [], ['VAMPIRE','SHAMAN']],
  ['Swords to Plowshares', 'C17', '76', ['INSTANT'], '{W}', '', '', [], []],
  ['Meren of Clan Nel Toth', 'C15', '49', ['CREATURE'], '{2}{B}{G}', '3/4', '', ['LEGENDARY'], ['HUMAN','SHAMAN']],
  ['Forest', 'C15', '339', ['LAND'], '', '', '', ['BASIC'], ['FOREST']],
  ['Swamp', 'C15', '331', ['LAND'], '', '', '', ['BASIC'], ['SWAMP']],
  ['Golgari Rot Farm', 'C15', '287', ['LAND'], '', '', '', [], []],
  ['Jungle Hollow', 'C15', '292', ['LAND'], '', '', '', [], []],
  ['Tainted Wood', 'C15', '312', ['LAND'], '', '', '', [], []],
  ['Command Tower', 'C15', '281', ['LAND'], '', '', '', [], []],
  ['Grim Backwoods', 'C15', '288', ['LAND'], '', '', '', [], []],
  ['Golgari Signet', 'C15', '255', ['ARTIFACT'], '{2}', '', '', [], []],
  ['Skullclamp', 'C15', '267', ['ARTIFACT'], '{1}', '', '', [], ['EQUIPMENT']],
  ['Lightning Greaves', 'C15', '257', ['ARTIFACT'], '{2}', '', '', [], ['EQUIPMENT']],
  ['Sakura-Tribe Elder', 'C15', '200', ['CREATURE'], '{1}{G}', '1/1', '', [], ['SNAKE','SHAMAN']],
  ['Eternal Witness', 'C15', '183', ['CREATURE'], '{1}{G}{G}', '2/1', '', [], ['HUMAN','SHAMAN']],
  ['Wall of Blossoms', 'C15', '211', ['CREATURE'], '{1}{G}', '0/4', '', [], ['PLANT','WALL']],
  ['Mulch', 'C15', '191', ['SORCERY'], '{1}{G}', '', '', [], []],
  ['Victimize', 'C15', '139', ['SORCERY'], '{2}{B}', '', '', [], []],
  ['Barter in Blood', 'C15', '115', ['SORCERY'], '{2}{B}{B}', '', '', [], []],
  ['Spider Spawning', 'C15', '202', ['SORCERY'], '{4}{G}', '', '', [], []],
  ['Shriekmaw', 'C15', '137', ['CREATURE'], '{4}{B}', '3/2', '', [], ['ELEMENTAL']],
  ['Acidic Slime', 'C15', '173', ['CREATURE'], '{3}{G}{G}', '2/2', '', [], ['OOZE']],
  ['Mycoloth', 'C15', '192', ['CREATURE'], '{3}{G}{G}', '4/4', '', [], ['FUNGUS']],
  ['Terastodon', 'C15', '204', ['CREATURE'], '{6}{G}{G}', '9/9', '', [], ['ELEPHANT']],
  ['Cloudthresher', 'C15', '179', ['CREATURE'], '{2}{G}{G}{G}{G}', '7/7', '', [], ['ELEMENTAL']],
  ['Butcher of Malakir', 'C15', '118', ['CREATURE'], '{5}{B}{B}', '5/4', '', [], ['VAMPIRE','WARRIOR']],
  ['Eater of Hope', 'C15', '123', ['CREATURE'], '{5}{B}{B}', '6/4', '', [], ['DEMON']],
  ['Lotleth Troll', 'C15', '226', ['CREATURE'], '{B}{G}', '2/1', '', [], ['ZOMBIE','TROLL']],
  ['Corpse Augur', 'C15', '17', ['CREATURE'], '{3}{B}', '4/2', '', [], ['ZOMBIE','WIZARD']],
  ['Golgari Charm', 'C15', '221', ['INSTANT'], '{B}{G}', '', '', [], []],
  ['Phyrexian Rager', 'C15', '132', ['CREATURE'], '{2}{B}', '2/2', '', [], ['PHYREXIAN','HORROR']],
  ['Satyr Wayfinder', 'C15', '201', ['CREATURE'], '{1}{G}', '1/1', '', [], ['SATYR']],
  ['Scourge of Nel Toth', 'C15', '21', ['CREATURE'], '{5}{B}{B}', '6/6', '', [], ['ZOMBIE','DRAGON']],
  ['Kessig Cagebreakers', 'C15', '187', ['CREATURE'], '{4}{G}', '3/4', '', [], ['HUMAN','ROGUE']],
]

/**
 * TST-8: the printed text of the cards whose keywords the board draws as chips
 * (flying, deathtouch, trample…). Only the ones on the table need it; a card
 * without an entry keeps the commander line or none.
 */
const RULES = new Map<string, string[]>([
  ["Atraxa, Praetors' Voice", ["Flying, vigilance, deathtouch, lifelink","At the beginning of your end step, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)"]],
  ["Kalonian Hydra", ["Trample","This creature enters with four +1/+1 counters on it.","Whenever this creature attacks, double the number of +1/+1 counters on each creature you control."]],
  ["Juniper Order Ranger", ["Whenever another creature you control enters, put a +1/+1 counter on that creature and a +1/+1 counter on this creature."]],
  ["Vampire Nighthawk", ["Flying","Deathtouch (Any amount of damage this deals to a creature is enough to destroy it.)","Lifelink (Damage dealt by this creature also causes you to gain that much life.)"]],
  ["Stromkirk Captain", ["First strike","Other Vampire creatures you control get +1/+1 and have first strike."]],
  ["Drana, Kalastria Bloodchief", ["Flying","{X}{B}{B}: Target creature gets -0/-X until end of turn and Drana gets +X/+0 until end of turn."]],
  ["Myr Battlesphere", ["When this creature enters, create four 1/1 colorless Myr artifact creature tokens.","Whenever this creature attacks, you may tap X untapped Myr you control. If you do, this creature gets +X/+0 until end of turn and deals X damage to the player or planeswalker it's attacking."]],
  ["Whirler Rogue", ["When this creature enters, create two 1/1 colorless Thopter artifact creature tokens with flying.","Tap two untapped artifacts you control: Target creature can't be blocked this turn."]],
  ["Sakura-Tribe Elder", ["Sacrifice this creature: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle."]],
  ["Eternal Witness", ["When this creature enters, you may return target card from your graveyard to your hand."]],
  ["Champion of Lambholt", ["Creatures with power less than this creature's power can't block creatures you control.","Whenever another creature you control enters, put a +1/+1 counter on this creature."]],
  ["Master Biomancer", ["Each other creature you control enters with a number of additional +1/+1 counters on it equal to this creature's power and as a Mutant in addition to its other types."]],
  ["Corpsejack Menace", ["If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on it instead."]],
  ["Deepglow Skate", ["When this creature enters, double the number of each kind of counter on any number of target permanents."]],
])

const BY_KEY = new Map(META.map((m) => [`${m[1]}|${m[0]}`, m]))

function meta(set: string, name: string): Meta {
  const m = BY_KEY.get(`${set}|${name}`)
  if (!m) throw new Error(`commander showcase: ${name} (${set}) is not in the table`)
  return m
}

function colorOf(cost: string) {
  return { white: cost.includes('W'), blue: cost.includes('U'), black: cost.includes('B'), red: cost.includes('R'), green: cost.includes('G') }
}

function manaValue(cost: string): number {
  return (cost.match(/\{[^}]+\}/g) ?? []).reduce((n, s) => n + (/^\{\d+\}$/.test(s) ? Number(s.slice(1, -1)) : s === '{X}' ? 0 : 1), 0)
}

function cardFields(m: Meta): Partial<CardView> & { name: string } {
  const [name, set, number, types, cost, pt, loyalty, supertypes, subtypes] = m
  const [power, toughness] = pt ? pt.split('/') : ['0', '0']
  return {
    name,
    displayName: name,
    displayFullName: name,
    expansionSetCode: set,
    cardNumber: number,
    cardTypes: types,
    superTypes: supertypes,
    subTypes: subtypes,
    manaCostLeftStr: cost.match(/\{[^}]+\}/g) ?? [],
    manaCostRightStr: [],
    manaValue: manaValue(cost),
    color: colorOf(cost),
    frameColor: colorOf(cost),
    power,
    toughness,
    loyalty,
    rarity: 'RARE',
  }
}

interface Seat {
  id: string
  name: string
  set: string
  me: boolean
  next: number
}

interface PermOpts {
  tapped?: boolean
  sick?: boolean
  counters?: { name: string; count: number }[]
  pt?: string
  loyalty?: number
  commander?: number
  /** Defense, for a battle (TST-8: a type the precons have none of). */
  defense?: number
  /** Rules text, for the cards whose shape the board reads (a saga's chapters). */
  rules?: string[]
  /** The set to take the printing from, when it is not the seat's own precon. */
  set?: string
}

function perm(seat: Seat, name: string, opts: PermOpts = {}): PermanentView {
  const id = `${seat.id}-p${++seat.next}`
  const fields = cardFields(meta(opts.set ?? seat.set, name))
  const [power, toughness] = opts.pt ? opts.pt.split('/') : [fields.power, fields.toughness]
  return makePermanent({
    ...fields,
    id,
    parentId: id,
    power,
    toughness,
    // What the card prints, the way the server sends it, so the board can tell a
    // creature that grew from one that did not (BRD-49).
    ...(fields.power != null ? { originalPower: fields.power } : null),
    ...(fields.toughness != null ? { originalToughness: fields.toughness } : null),
    loyalty: opts.loyalty != null ? String(opts.loyalty) : fields.loyalty,
    defense: opts.defense != null ? String(opts.defense) : undefined,
    counters: opts.counters ?? (opts.loyalty != null ? [{ name: 'loyalty', count: opts.loyalty }] : []),
    rules: opts.rules ?? [
      ...(RULES.get(name) ?? []),
      ...(opts.commander != null ? [commanderInfoRule(opts.commander)] : []),
    ],
    tapped: !!opts.tapped,
    summoningSickness: !!opts.sick,
    controlled: seat.me,
    controllerId: seat.id,
    controllerName: seat.name,
    mageObjectType: 'PERMANENT',
    attachments: [],
  })
}

function token(seat: Seat, name: string, pt: string, types: string[], color: Partial<NonNullable<CardView['color']>>): PermanentView {
  const id = `${seat.id}-t${++seat.next}`
  const [power, toughness] = pt.split('/')
  const full = { white: false, blue: false, black: false, red: false, green: false, ...color }
  return makePermanent({
    id,
    parentId: id,
    name,
    displayName: name,
    cardTypes: types,
    subTypes: [name.toUpperCase()],
    expansionSetCode: seat.set,
    cardNumber: '0',
    power,
    toughness,
    color: full,
    frameColor: full,
    isToken: true,
    mageObjectType: 'TOKEN',
    controlled: seat.me,
    controllerId: seat.id,
    controllerName: seat.name,
    attachments: [],
  })
}

function card(seat: Seat, name: string): CardView {
  const id = `${seat.id}-c${++seat.next}`
  return makeCard({ ...cardFields(meta(seat.set, name)), id, parentId: id })
}

function attach(equipment: PermanentView, to: PermanentView) {
  equipment.attachedTo = to.id
  equipment.attachedToPermanent = true
  to.attachments = [...(to.attachments ?? []), equipment.id!]
}

const byId = <T extends { id?: string }>(list: T[]): Record<string, T> => Object.fromEntries(list.map((c) => [c.id!, c]))
const times = <T,>(n: number, make: () => T): T[] => Array.from({ length: n }, make)
const P1P1 = (count: number) => [{ name: 'P1P1', count }]

/**
 * Turn 11 of a four-player Commander game built only from the dev Commander precons
 * (`src/lobby/commanderDecks.ts`): Atraxa (you, main phase with priority), Saheeli with an
 * artifact and token board, Edgar Markov with vampires, and Meren after a board wipe with
 * the commander back in the command zone and a full graveyard.
 */
export function commanderShowcaseGameView(myName = 'You'): GameView {
  const me: Seat = { id: SHOWCASE_PLAYERS.atraxa, name: myName, set: 'C16', me: true, next: 0 }
  const sa: Seat = { id: SHOWCASE_PLAYERS.saheeli, name: 'Kiko', set: 'C18', me: false, next: 0 }
  const ed: Seat = { id: SHOWCASE_PLAYERS.edgar, name: 'Marta', set: 'C17', me: false, next: 0 }
  const mr: Seat = { id: SHOWCASE_PLAYERS.meren, name: 'Pablo', set: 'C15', me: false, next: 0 }

  const myLands = [
    perm(me, 'Command Tower'), perm(me, 'Arcane Sanctum', { tapped: true }), perm(me, 'Opulent Palace'),
    perm(me, 'Sandsteppe Citadel', { tapped: true }), perm(me, 'Seaside Citadel'), perm(me, 'Opal Palace', { tapped: true }),
    perm(me, 'Exotic Orchard'), perm(me, 'Underground River'), perm(me, 'Plains'), perm(me, 'Island'),
    perm(me, 'Swamp'), perm(me, 'Forest'), perm(me, 'Forest'),
  ]
  const myOther = [
    perm(me, 'Sol Ring', { tapped: true }), perm(me, 'Fellwar Stone'), perm(me, 'Simic Signet'),
    perm(me, "Commander's Sphere"), perm(me, 'Darksteel Ingot'),
    perm(me, 'Hardened Scales'), perm(me, "Cathars' Crusade"), perm(me, 'Bred for the Hunt'),
    perm(me, 'Invasion of Zendikar', { set: 'MOM', defense: 3 }),
    perm(me, 'History of Benalia', {
      set: 'DOM',
      counters: [{ name: 'lore', count: 2 }],
      rules: [
        '<i>(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)</i>',
        'I, II — Create a 2/2 white Knight creature token with vigilance.',
        'III — Knights you control get +2/+1 until end of turn.',
      ],
    }),
    perm(me, "Atraxa, Praetors' Voice", { counters: P1P1(2), pt: '6/6', commander: 1 }),
    perm(me, 'Master Biomancer', { counters: P1P1(1), pt: '3/5' }),
    perm(me, 'Corpsejack Menace', { counters: P1P1(2), pt: '6/6' }),
    perm(me, 'Kalonian Hydra', { counters: P1P1(8), pt: '8/8' }),
    perm(me, 'Champion of Lambholt', { counters: P1P1(4), pt: '5/5' }),
    perm(me, 'Deepglow Skate', { sick: true }),
    perm(me, 'Juniper Order Ranger', { counters: P1P1(2), pt: '4/6' }),
  ]
  const myHand = ['Putrefy', 'Mirrorweave', 'Migratory Route', 'Languish', 'Evolving Wilds', 'Treasure Cruise'].map((n) => card(me, n))
  const myGraveyard = ['Manifold Insights', 'Solidarity of Heroes', 'Grip of Phyresis', 'Thrummingbird', 'Festercreep', 'Necroplasm', 'Elite Scaleguard'].map((n) => card(me, n))

  const thopter = () => token(sa, 'Thopter', '1/1', ['ARTIFACT', 'CREATURE'], {})
  const servo = () => token(sa, 'Servo', '1/1', ['ARTIFACT', 'CREATURE'], {})
  const myr = () => token(sa, 'Myr', '1/1', ['ARTIFACT', 'CREATURE'], {})
  const whirler = perm(sa, 'Whirler Rogue')
  const boots = perm(sa, 'Swiftfoot Boots')
  attach(boots, whirler)
  const saBoard = [
    ...times(4, () => perm(sa, 'Island')), perm(sa, 'Island', { tapped: true }), perm(sa, 'Mountain'), perm(sa, 'Mountain', { tapped: true }),
    perm(sa, 'Mountain'), perm(sa, 'Seat of the Synod'), perm(sa, 'Great Furnace', { tapped: true }), perm(sa, 'Darksteel Citadel'),
    perm(sa, 'Izzet Boilerworks'), perm(sa, 'Command Tower'),
    perm(sa, 'Sol Ring'), perm(sa, 'Mind Stone', { tapped: true }), perm(sa, 'Izzet Signet'), perm(sa, 'Hedron Archive'), boots,
    perm(sa, 'Thopter Spy Network'), perm(sa, 'Retrofitter Foundry'), perm(sa, 'Unwinding Clock'),
    perm(sa, 'Saheeli, the Gifted', { loyalty: 6, commander: 1 }),
    whirler, perm(sa, 'Maverick Thopterist'), perm(sa, 'Myr Battlesphere'),
    ...times(5, thopter), ...times(2, servo), ...times(4, myr),
  ]
  const saGraveyard = ['Chaos Warp', 'Into the Roil', 'Thirst for Knowledge', "Pilgrim's Eye", 'Etherium Sculptor', 'Reverse Engineer'].map((n) => card(sa, n))

  const vampire = () => token(ed, 'Vampire', '1/1', ['CREATURE'], { black: true })
  const edBoard = [
    ...times(2, () => perm(ed, 'Swamp')), perm(ed, 'Swamp', { tapped: true }), perm(ed, 'Mountain'), perm(ed, 'Mountain', { tapped: true }),
    perm(ed, 'Plains'), perm(ed, 'Nomad Outpost'), perm(ed, 'Orzhov Basilica', { tapped: true }), perm(ed, 'Rakdos Carnarium'),
    perm(ed, 'Command Tower'), perm(ed, 'Path of Ancestry'),
    perm(ed, 'Boros Signet'), perm(ed, 'Orzhov Signet'), perm(ed, 'Door of Destinies', { counters: [{ name: 'charge', count: 4 }] }),
    perm(ed, 'Heirloom Blade'), perm(ed, 'Sanguine Bond'), perm(ed, 'Black Market', { counters: [{ name: 'charge', count: 3 }] }),
    perm(ed, 'Edgar Markov', { counters: P1P1(2), pt: '10/10', commander: 1 }),
    perm(ed, 'Captivating Vampire', { pt: '6/6' }), perm(ed, 'Drana, Kalastria Bloodchief', { pt: '8/8' }),
    perm(ed, 'Vampire Nighthawk', { pt: '6/7' }), perm(ed, 'Blood Artist', { pt: '4/5' }), perm(ed, 'Stromkirk Captain', { pt: '6/6' }),
    ...times(6, vampire),
  ]
  const edGraveyard = ['Go for the Throat', 'Read the Bones', 'Falkenrath Noble', 'Bloodhusk Ritualist', 'Swords to Plowshares'].map((n) => card(ed, n))

  const merBoard = [
    ...times(2, () => perm(mr, 'Forest')), perm(mr, 'Forest', { tapped: true }), ...times(3, () => perm(mr, 'Swamp')), perm(mr, 'Swamp', { tapped: true }),
    perm(mr, 'Golgari Rot Farm'), perm(mr, 'Jungle Hollow'), perm(mr, 'Tainted Wood'), perm(mr, 'Command Tower'), perm(mr, 'Grim Backwoods'),
    perm(mr, 'Golgari Signet'), perm(mr, 'Skullclamp'), perm(mr, 'Lightning Greaves'),
    perm(mr, 'Sakura-Tribe Elder'), perm(mr, 'Eternal Witness', { sick: true }), perm(mr, 'Wall of Blossoms'),
  ]
  const merGraveyard = [
    'Mulch', 'Victimize', 'Barter in Blood', 'Spider Spawning', 'Shriekmaw', 'Acidic Slime', 'Mycoloth', 'Terastodon',
    'Cloudthresher', 'Butcher of Malakir', 'Eater of Hope', 'Lotleth Troll', 'Corpse Augur', 'Golgari Charm', 'Phyrexian Rager', 'Satyr Wayfinder',
  ].map((n) => card(mr, n))
  const merExile = ['Scourge of Nel Toth', 'Kessig Cagebreakers'].map((n) => card(mr, n))
  const meren: CardView = { ...card(mr, 'Meren of Clan Nel Toth'), mageObjectType: 'COMMANDER', rules: [commanderInfoRule(2)] }

  const myPermanents = [...myLands, ...myOther]
  const players = [
    makePlayer({
      playerId: me.id, name: me.name, controlled: true, life: 31, isActive: true, hasPriority: true, timerActive: true,
      libraryCount: 100 - myPermanents.length - myHand.length - myGraveyard.length,
      handCount: myHand.length, battlefield: byId(myPermanents), graveyard: byId(myGraveyard),
    }),
    makePlayer({ playerId: sa.id, name: sa.name, life: 18, libraryCount: 62, handCount: 3, battlefield: byId(saBoard), graveyard: byId(saGraveyard) }),
    makePlayer({ playerId: ed.id, name: ed.name, life: 26, libraryCount: 66, handCount: 4, battlefield: byId(edBoard), graveyard: byId(edGraveyard) }),
    makePlayer({
      playerId: mr.id, name: mr.name, life: 9, libraryCount: 58, handCount: 2, counters: [{ name: 'experience', count: 4 }],
      battlefield: byId(merBoard), graveyard: byId(merGraveyard), exile: byId(merExile), commandList: [meren],
    }),
  ]

  const castable = myHand.filter((c) => ['Putrefy', 'Mirrorweave', 'Migratory Route', 'Languish', 'Evolving Wilds'].includes(c.name))
  const manaSources = myPermanents.filter((p) => !p.tapped && (p.cardTypes?.includes('LAND') || ['Fellwar Stone', 'Simic Signet', "Commander's Sphere"].includes(p.name)))
  const objects: Record<string, PlayableObjectStats> = {}
  for (const c of castable) objects[c.id!] = { basicCastAbilities: [{ id: c.id!, value: c.cardTypes?.includes('LAND') ? 'Play land' : 'Cast' }] }
  for (const p of manaSources) objects[p.id!] = { basicManaAbilities: [{ id: p.id!, value: 'Add mana' }] }

  return makeGameView({
    players,
    myPlayerId: me.id,
    myHand: byId(myHand),
    turn: 11,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: me.id,
    activePlayerName: me.name,
    priorityPlayerName: me.name,
    canPlayObjects: { objects },
  })
}

/** Ids the board highlights as playable in the showcase: cards to cast and untapped mana sources. */
export function commanderShowcasePlayableIds(game: GameView): string[] {
  return Object.keys(game.canPlayObjects?.objects ?? {})
}
