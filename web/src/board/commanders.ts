import type { CardView, GameView, PlayerView } from '../net/types'
import { parseCommandList } from './CommandZone'

export interface CommanderInfo {
  id: string
  name: string
  /** Última vista conocida del objeto. En un comandante recordado por la memoria de partida
   *  (ver `syncCommanderMemory`) es la de su última aparición visible: sus `rules` siguen
   *  conteniendo los totales de daño, que solo se acumulan con el comandante en campo. */
  card?: CardView
  isCompanion: boolean
  /** false solo en un companion que NO es el comandante. Un comandante companion (Lurrus,
   *  Yorion…) llega con isCompanion=true del parse del command zone: el marcador del watcher
   *  (`<b>Commander</b>`) manda y lo marca como comandante. */
  isCommander: boolean
  castCount: number
}

/** Comandante de la matriz de daño: añade la atribución de dueño. */
export type MatrixCommander = CommanderInfo & { ownerId: string; ownerName: string }

/** The engine's own marker that an object IS a commander. `CommanderInfoWatcher` writes it
 *  into the cardState of the commander's object (`addInfoToObject`), and
 *  `CardUtil.getCardRulesWithAdditionalInfo` dumps those values into `rules`. Only a
 *  commander ever gets it, and it is re-written on every zone change, so it is the one
 *  channel that identifies a commander wherever the object currently is. */
const COMMANDER_MARKER = /^<b>Commander<\/b>(\s|$)/

function isCommanderObject(card: { rules?: string[] | null } | null | undefined): boolean {
  return (card?.rules ?? []).some((r) => COMMANDER_MARKER.test(String(r)))
}

/** Commanders (and companion) of a player according to the canonical CommandZone parse
 *  (parseCommandList). The command zone alone is NOT enough: `PlayerView.commandList` is
 *  built from `game.getState().getCommand()`, which holds a `Commander` object only while
 *  the card is in the command zone — casting it runs `CardImpl.removeFromZone(COMMAND)` and
 *  drops it. So for the whole time a commander is on the battlefield (the normal state) it
 *  is missing there, and a roster read only from commandList loses the player. We therefore
 *  add the objects the engine marked as commanders wherever they are. */
export function commandersOf(player: PlayerView | undefined): CommanderInfo[] {
  if (!player) return []
  const items = parseCommandList(player.commandList, player.helperCards ?? {})
  const seen = new Set<string>()
  const out: CommanderInfo[] = []
  for (const i of items) {
    if (!i.isCommander && !i.isCompanion) continue
    // El parse del command zone marca isCompanion por el texto de las rules ("Companion —…"),
    // y ahí fuerza isCommander=false: un Lurrus usado como comandante saldría expulsado.
    // El marcador que el watcher escribe en el objeto del comandante es la verdad.
    const isCommander = i.isCommander || isCommanderObject(i.card)
    seen.add(i.id)
    out.push({
      id: i.id,
      name: i.card.displayName || i.card.name || '',
      card: i.card,
      isCompanion: i.isCompanion,
      isCommander,
      castCount: i.castCount,
    })
  }

  const push = (card: CardView, isCompanion: boolean) => {
    const id = card.id
    if (!id || seen.has(id)) return
    if (!isCommanderObject(card)) return
    seen.add(id)
    out.push({
      id,
      name: card.displayName || card.name || '',
      card,
      isCompanion,
      isCommander: true,
      castCount: commanderPlaysCount(card),
    })
  }

  for (const perm of Object.values(player.battlefield ?? {})) {
    if (!perm) continue
    if (isCommanderObject(perm)) push(perm, false)
    // A commander under a mutate host keeps its own object in the host's mutateView.
    for (const hidden of Object.values(perm.mutateView?.cards ?? {})) {
      if (hidden) push(hidden, false)
    }
  }
  for (const zone of [player.graveyard, player.exile]) {
    for (const card of Object.values(zone ?? {})) {
      if (card) push(card, false)
    }
  }
  return out
}

// ── Memoria de partida (roster de comandantes) ─────────────────────────────────────────
// El daño de comandante NO tiene campo en el view (`PlayerView`/`GameView` no lo exponen):
// viaja solo en las `rules` del objeto del comandante (CommanderInfoWatcher → cardState
// info, clave "Commander"+playerUUID, con el TOTAL acumulado por pareja comandante/jugador).
// Cuando ese objeto cae en una zona invisible — mano rival, biblioteca — el roster vivo lo
// pierde y la matriz borraba la columna con todo su daño. Como el daño de comandante solo
// puede acumularse con el comandante EN EL CAMPO DE BATALLA (visible), los totales de la
// última vista son los vigentes: basta recordar los comandantes ya vistos (con su última
// card) mientras dure la partida. La clave de partida es la firma de playerIds — el motor
// genera UUIDs nuevos por partida, así que una revancha reinicia la memoria sola.

let memoryGameKey: string | null = null
let rosterMemory: MatrixCommander[] = []

function gameKeyOf(game: GameView | null | undefined): string | null {
  const ids = (game?.players ?? []).map((p) => String(p.playerId ?? '')).filter(Boolean)
  return ids.length > 0 ? [...new Set(ids)].sort().join('|') : null
}

/** Roster de comandantes de la partida: los visibles ahora + los ya vistos que el view ya
 *  no muestra por ninguna zona (objeto en mano/biblioteca). Idempotente; la llaman la
 *  matriz de daño y `hasCommanders` en cada render. */
export function syncCommanderMemory(game: GameView | null | undefined): MatrixCommander[] {
  const key = gameKeyOf(game)
  if (key !== memoryGameKey) {
    memoryGameKey = key
    rosterMemory = []
  }
  if (!key) return []
  const live: MatrixCommander[] = (game?.players ?? []).flatMap((p) =>
    commandersOf(p).map((c) => ({ ...c, ownerId: p.playerId, ownerName: p.name })),
  )
  for (const c of live) {
    const idx = rosterMemory.findIndex((r) => r.id === c.id)
    if (idx >= 0) rosterMemory[idx] = c
    else rosterMemory.push(c)
  }
  const merged = [...live]
  for (const r of rosterMemory) {
    if (!merged.some((c) => c.id === r.id)) merged.push(r)
  }
  return merged
}

/** Solo tests: vacía la memoria (se re-llena en el próximo sync). */
export function resetCommanderMemory(): void {
  memoryGameKey = null
  rosterMemory = []
}

/** ¿Hay algún comandante en la partida? (gating de la pestaña CDM). Con memoria: un
 *  comandante en zona invisible (mano/biblioteca) no apaga la pestaña ni borra columnas. */
export function hasCommanders(game: GameView | null): boolean {
  return syncCommanderMemory(game).length > 0
}

/** One commander's damage line, e.g. `"<b>Commander</b> did 3 combat damage to player
 *  <font color='#20B2AA'>sim-137363</font>."`. The engine writes one info entry (and hence
 *  one `rules` string) per damaged player, keyed `Commander<playerUUID>`; defensively the
 *  matcher also survives several of them concatenated in one string (older forks). */
const DAMAGE_TO_PLAYER = /did\s+(\d+)\s+combat damage to(?:\s+player)?\s+(.+?)\s*\.?\s*$/gi

const TAGS = /<[^>]*>/g

/** Cada frase del watcher empieza con `<b>`: partir por ahí deja el casado anclado a fin de
 *  frase correcto frase a frase aunque lleguen varias concatenadas en una sola cadena. */
const SENTENCE_BOUNDARY = /(?=<b>)/

/** Nombre de jugador a clave de comparación: el motor puede escapar entidades en
 *  getLogName y el nombre puede traer puntos finales propios. */
function targetKey(name: string | null | undefined): string {
  return String(name ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()
    .replace(/\.+$/, '')
    .toLowerCase()
}

/** The objects that ARE one commander, i.e. that share its cardState and therefore its
 *  `rules`. The engine keeps commander damage in `CommanderInfoWatcher.damageToPlayer`
 *  (game state, no view field) and projects it with `Card.addInfo`, which writes into the
 *  cardState of the commander's own object only — so only these objects can ever report it.
 *  A cast keeps the object id (playing from the command zone reuses the deck's card object,
 *  which is why the watcher's `sourceId` still matches), so the battlefield permanent of the
 *  same id is the same commander; a *different* card that merely shares the name is not, and
 *  reading it would mix two commanders' damage. */
export function commanderStateCarriers(game: GameView | null | undefined, commander: CommanderInfo): CardView[] {
  const carriers: CardView[] = commander.card ? [commander.card] : []
  const id = commander.id
  if (!game?.players || !id) return carriers
  for (const player of game.players) {
    for (const perm of Object.values(player.battlefield ?? {})) {
      // Cast commander: the permanent keeps the commander's object id.
      if (perm?.id === id) carriers.push(perm)
      // Mutate host: the commander hides under it and is listed in its mutateView.
      const hidden = perm?.mutateView?.cards?.[id]
      if (hidden) carriers.push(perm, hidden)
    }
    for (const zone of [player.graveyard, player.exile]) {
      for (const card of Object.values(zone ?? {})) {
        if (card?.id === id) carriers.push(card)
      }
    }
  }
  return carriers
}

/** Commander damage one player has been dealt by one commander (state-based, lethal at 21,
 *  CR 903.14a). Only the last total per (commander, player) pair travels on the wire, so
 *  equal values coming from several carriers are the same number, not a sum. */
export function commanderDamageDealt(
  game: GameView | null | undefined,
  commander: CommanderInfo,
  target: PlayerView,
): number {
  const targetName = targetKey(target.name)
  if (!targetName) return 0
  let dealt = 0
  for (const card of commanderStateCarriers(game, commander)) {
    for (const rule of card.rules ?? []) {
      for (const sentence of String(rule).split(SENTENCE_BOUNDARY)) {
        const line = sentence.replace(TAGS, ' ')
        for (const match of line.matchAll(DAMAGE_TO_PLAYER)) {
          if (targetKey(match[2]) !== targetName) continue
          dealt = Math.max(dealt, Number(match[1]))
        }
      }
    }
  }
  return dealt
}

const PLAYS_FROM_COMMAND_ZONE = /(\d+)\s+times?\s+played from the command zone/i

/** Times a commander was cast from the command zone. The server sends no count
 *  field: the engine's CommanderInfoWatcher writes it into the card's rules
 *  ("<b>Commander</b> 2 times played from the command zone."), and omits the
 *  sentence while the count is zero. */
export function commanderPlaysCount(card: Pick<CardView, 'rules'>): number {
  for (const rule of card.rules ?? []) {
    const m = PLAYS_FROM_COMMAND_ZONE.exec(String(rule))
    if (m) return Number(m[1])
  }
  return 0
}

/** Impuesto de lanzamiento de comandante: +{2 por cada vez lanzado}. */
export function commanderTax(castCount: number): number {
  return castCount > 0 ? castCount * 2 : 0
}
