export interface DraftLogEntry {
  setCode: string
  packNo: number
  pickNo: number
  booster: string[]
  pick: string
}

export interface DraftLogData {
  draftId: string
  startedAt: Date
  players: string[]
  entries: DraftLogEntry[]
}

/**
 * Serializa el log del draft en el formato de `DraftPickLogger` del desktop
 * (`------ SET ------`, `Pack X pick Y:`, pick marcado con `--> `), el mismo
 * que `parseDraftLog` (U7-1) sabe reimportar.
 */
export function buildDraftLog(data: DraftLogData): string {
  const lines: string[] = []
  lines.push(`Event #: ${data.draftId}`)
  lines.push(`Time: ${data.startedAt.toLocaleString()}`)
  lines.push(`Players: ${data.players.join(', ')}`)
  lines.push('')
  let currentSet = ''
  for (const e of data.entries) {
    if (e.setCode !== currentSet) {
      currentSet = e.setCode
      lines.push(`------ ${currentSet} ------`)
    }
    lines.push(`Pack ${e.packNo} pick ${e.pickNo}:`)
    for (const name of e.booster) {
      lines.push(name === e.pick ? `--> ${name}` : name)
    }
  }
  return lines.join('\n') + '\n'
}
