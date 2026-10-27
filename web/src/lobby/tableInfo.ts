/**
 * The server packs a table's match options into `additionalInfoShort`
 * (`mage.view.TableView`): "Wins: 2, Time: 20m(+10s), Custom options (1), RB, SP, Rng: ONE",
 * or "Wins: 2 Score: 1-0 Draws: 1, SP" once a game has started. Tournaments add
 * "Constr.: 15m", "Pick time: x1.5" and "1 GAME". Tokens this parser does not know
 * are kept in `other`, so a server change shows up as raw text instead of vanishing.
 */
export interface TableInfo {
  winsNeeded: number | null
  score: number[] | null
  draws: number
  timeLimit: string | null
  /** The server said "Time: None"; a missing Time token (a running match) says nothing. */
  noTimeLimit: boolean
  bufferTime: string | null
  customOptions: number
  rollbacks: boolean
  spectators: boolean
  range: string | null
  constructionTime: string | null
  pickTime: string | null
  singleGame: boolean
  other: string[]
}

export function parseTableInfo(short?: string): TableInfo {
  const info: TableInfo = {
    winsNeeded: null,
    score: null,
    draws: 0,
    timeLimit: null,
    noTimeLimit: false,
    bufferTime: null,
    customOptions: 0,
    rollbacks: false,
    spectators: false,
    range: null,
    constructionTime: null,
    pickTime: null,
    singleGame: false,
    other: [],
  }
  for (const raw of (short ?? '').split(',')) {
    const token = raw.trim()
    if (!token) continue
    const wins = token.match(/^Wins:\s*(\d+)(?:\s+Score:\s*([\d-]+))?(?:\s+Draws:\s*(\d+))?$/)
    if (wins) {
      info.winsNeeded = Number(wins[1])
      if (wins[2]) info.score = wins[2].split('-').map(Number)
      if (wins[3]) info.draws = Number(wins[3])
      continue
    }
    const time = token.match(/^Time:\s*(\S+?)(?:\(\+(\S+)\))?$/)
    if (time) {
      info.timeLimit = time[1] === 'None' ? null : time[1]
      info.noTimeLimit = time[1] === 'None'
      info.bufferTime = time[2] && time[2] !== 'None' ? time[2] : null
      continue
    }
    const custom = token.match(/^Custom options \((\d+)\)$/)
    if (custom) {
      info.customOptions = Number(custom[1])
      continue
    }
    const range = token.match(/^Rng:\s*(\S+)$/)
    if (range) {
      info.range = range[1]
      continue
    }
    const constr = token.match(/^Constr\.:\s*(\S+)$/)
    if (constr) {
      info.constructionTime = constr[1]
      continue
    }
    const pick = token.match(/^Pick time:\s*(\S+)$/)
    if (pick) {
      info.pickTime = pick[1]
      continue
    }
    if (token === 'RB') info.rollbacks = true
    else if (token === 'SP') info.spectators = true
    else if (token === '1 GAME') info.singleGame = true
    else info.other.push(token)
  }
  return info
}

/** `additionalInfoFull` uses `<br>` and `<b>` for the desktop tooltip; a title attribute wants plain lines. */
export function tableInfoTooltip(full?: string): string {
  return (full ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
}
