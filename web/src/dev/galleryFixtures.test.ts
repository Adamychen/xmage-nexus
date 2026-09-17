import { describe, expect, it } from 'vitest'
import { buildGalleryEntries, recordedFrames, type GalleryEntry } from './galleryFixtures'
import { STORAGE_KEY as CREATE_TABLE_STORAGE_KEY } from '../lobby/CreateTable/constants'

function entry(entries: GalleryEntry[], id: string): GalleryEntry {
  const found = entries.find((e) => e.id === id)
  expect(found, `falta la entrada ${id}`).toBeTruthy()
  return found!
}

function allCardIds(game: GalleryEntry['game']): string[] {
  const ids: string[] = []
  for (const player of game?.players ?? []) {
    ids.push(...Object.keys(player.battlefield ?? {}), ...Object.keys(player.graveyard ?? {}), ...Object.keys(player.exile ?? {}))
  }
  return ids
}

describe('galería de estados (P3)', () => {
  const entries = buildGalleryEntries()

  it('incluye todos los frames de juego del registro', () => {
    expect(recordedFrames.length).toBeGreaterThan(30)
    for (const frame of recordedFrames) {
      expect(entries.some((entry) => entry.id === `frame:${frame.mechanic}`), frame.file).toBe(true)
    }
  })

  it('ids únicos y grupos conocidos', () => {
    const ids = entries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...new Set(entries.map((entry) => entry.group))]).toEqual([
      'Frames reales',
      'Prompts',
      'Pantallas',
      'Tablero',
      'Global',
    ])
  })

  it('los prompts apuntan a ids reales del frame base', () => {
    const prompts = entries.filter((entry) => entry.group === 'Prompts')
    expect(prompts.length).toBeGreaterThanOrEqual(10)
    for (const entry of prompts) {
      expect(entry.game, entry.id).toBeTruthy()
      expect(entry.gameId, entry.id).toBeTruthy()
      expect(entry.feedback?.gameId, entry.id).toBe(entry.gameId)
    }

    const target = prompts.find((entry) => entry.id === 'prompt:target')
    const targetId = target?.feedback?.options[0]?.id
    const inBattlefield = (target?.game?.players ?? []).some((p) => targetId != null && p.battlefield?.[targetId])
    expect(inBattlefield, `objetivo ${targetId} debe existir en el campo`).toBe(true)

    const mana = prompts.find((entry) => entry.id === 'prompt:mana')
    expect(mana?.feedback?.playerId).toBeTruthy()
    expect(mana?.playableIds?.length).toBeGreaterThan(0)
  })

  it('la entrada de login no arrastra partida', () => {
    const login = entry(entries, 'screen:login')
    expect(login.phase).toBe('idle')
    expect(login.game).toBeUndefined()
    expect(entry(entries, 'screen:login-connecting').phase).toBe('connecting')
    expect(entry(entries, 'screen:login-error').error).toBeTruthy()
  })

  it('los tableros multi-jugador clonan rivales con ids únicos y un solo controlado', () => {
    for (const id of ['board:pod-4', 'board:arena-4']) {
      const game = entry(entries, id).game
      expect(game?.players?.length, id).toBe(4)
      const playerIds = (game?.players ?? []).map((p) => p.playerId)
      expect(new Set(playerIds).size, `${id}: playerIds únicos`).toBe(4)
      expect((game?.players ?? []).filter((p) => p.controlled).length, `${id}: un controlado`).toBe(1)
      const cardIds = allCardIds(game)
      expect(new Set(cardIds).size, `${id}: ids de carta únicos entre jugadores`).toBe(cardIds.length)
    }

    const commander = entry(entries, 'board:pod-commander')
    expect(commander.boardLayout).toBe('pod')
    expect(commander.game?.players?.length).toBe(3)
    expect((commander.game?.players ?? []).every((p) => (p.commandList ?? []).length > 0)).toBe(true)
  })

  it('cada variante de tablero declara su layout y el frame base conserva su campo', () => {
    expect(entry(entries, 'board:pod-4').boardLayout).toBe('pod')
    expect(entry(entries, 'board:arena-4').boardLayout).toBe('arena')
    const base = recordedFrames.find((f) => f.file === 'gang-block.json')?.gameView
    const pod = entry(entries, 'board:pod-4').game
    expect(pod?.myHand).toEqual(base?.myHand)
  })

  it('mano de 15 cartas y nombres largos', () => {
    const hand = entry(entries, 'game:hand-15').game
    expect(Object.keys(hand?.myHand ?? {})).toHaveLength(15)
    const me = (hand?.players ?? []).find((p) => p.controlled)
    expect(me?.handCount).toBe(15)

    const long = entry(entries, 'game:long-names').game
    const names = (long?.players ?? []).map((p) => p.name)
    expect(names.some((name) => (name ?? '').length > 30)).toBe(true)
  })

  it('pantallas nuevas montan con los props/slices que leen', () => {
    const staging = entry(entries, 'screen:staging-player')
    expect(staging.screen).toBe('staging')
    expect(staging.stagingTable?.seats.length).toBe(2)
    expect(staging.chatMessages?.length).toBeGreaterThan(0)

    const wizard = entry(entries, 'screen:wizard')
    expect(wizard.screen).toBe('wizard')
    const seed = JSON.parse(wizard.storageSeed?.[CREATE_TABLE_STORAGE_KEY] ?? '{}')
    expect(seed.deckType).toBe('Limited')
    expect(seed.useDraftTournament).toBe(true)
    expect(seed.name).toBeTruthy()
  })

  it('torneo: carga, error, vacío y espera son estados distintos del modal', () => {
    expect(entry(entries, 'screen:tournament-loading').tournamentModal?.loading).toBe(true)
    expect(entry(entries, 'screen:tournament-error').tournamentModal?.error).toBeTruthy()
    const empty = entry(entries, 'screen:tournament-empty').tournamentModal
    expect(empty?.view).toBeNull()
    expect(empty?.loading ?? false).toBe(false)
    expect(empty?.error ?? null).toBeNull()
    const waiting = entry(entries, 'screen:tournament-waiting').tournamentModal?.view
    expect(waiting?.rounds).toHaveLength(0)
    expect(waiting?.tournamentState.toLowerCase()).toContain('construct')
  })

  it('draft cuñado usa el watchdog real (lastDraftEventAt)', () => {
    const stalled = entry(entries, 'screen:draft-stalled')
    expect(stalled.draft).toBeTruthy()
    expect(stalled.lastDraftEventAt).toBe(0)
  })

  it('fin de partida y fin de match se distinguen por matchView.endTime', () => {
    const game = entry(entries, 'screen:gameend-game').gameEnd
    expect(game?.matchView?.endTime ?? null).toBeNull()
    const match = entry(entries, 'screen:gameend-match').gameEnd
    expect(match?.matchView?.endTime).toBeTruthy()
    expect(match?.won).toBe(true)
  })

  it('estados globales: idioma, zoom y desconexión', () => {
    expect(entry(entries, 'global:lang-lobby-ru').lang).toBe('ru')
    const ja = entry(entries, 'global:lang-game-ja')
    expect(ja.lang).toBe('ja')
    expect(ja.cjkBoost).toBe(true)
    expect(entry(entries, 'global:zoom-lobby-125').uiScale).toBe(1.25)
    expect(entry(entries, 'global:reconnecting').connecting).toBe(true)
  })
})
