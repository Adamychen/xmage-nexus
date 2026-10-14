import { setState } from '../state/state'
import { downloadBlob } from '../utils/download'
import { buildReplayFile, clearRewind, openReplay, parseReplayFile, type ReplayFile } from './rewind'

const GZIP_MAGIC = [0x1f, 0x8b]

async function gzip(text: string): Promise<Blob | null> {
  if (typeof CompressionStream === 'undefined') return null
  const body = new Response(text).body
  if (!body) return null
  return new Response(body.pipeThrough(new CompressionStream('gzip'))).blob()
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const body = new Response(bytes as BodyInit).body
  if (!body) throw new Error('no body')
  return new Response(body.pipeThrough(new DecompressionStream('gzip'))).text()
}

export async function saveReplay(): Promise<boolean> {
  const file = buildReplayFile()
  if (!file) return false
  const json = JSON.stringify(file)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const packed = await gzip(json)
  if (packed) return downloadBlob(packed, `nexus-replay_${stamp}.json.gz`)
  return downloadBlob(new Blob([json], { type: 'application/json' }), `nexus-replay_${stamp}.json`)
}

export async function readReplayFile(source: Blob): Promise<ReplayFile | null> {
  try {
    const bytes = new Uint8Array(await source.arrayBuffer())
    const packed = bytes.length > 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]
    const text = packed ? await gunzip(bytes) : new TextDecoder().decode(bytes)
    return parseReplayFile(JSON.parse(text))
  } catch {
    return null
  }
}

export function startReplay(file: ReplayFile): void {
  openReplay(file)
  const last = file.snapshots[file.snapshots.length - 1]
  setState({
    phase: 'game',
    gameId: null,
    game: last.game,
    feedback: null,
    gameEnd: null,
    playableIds: [],
    combat: null,
  })
}

export function leaveReplay(): void {
  clearRewind()
  setState({
    phase: 'lobby',
    game: null,
    gameId: null,
    feedback: null,
    gameEnd: null,
    playableIds: [],
    combat: null,
    turnRecap: null,
    enteredThisTurn: {},
  })
}
