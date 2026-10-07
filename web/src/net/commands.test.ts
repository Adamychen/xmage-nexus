import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Gateway } from './Gateway'
import * as commands from './commands'

describe('commands', () => {
  const send = vi.fn().mockResolvedValue({ ok: true, data: [] })

  beforeEach(() => {
    send.mockClear()
    commands.setGateway({ send } as unknown as Gateway)
  })

  it('maps lobby and table commands to the protocol', async () => {
    await commands.connect('localhost', 17171, 'alice', 'secret')
    await commands.getGameTypes()
    await commands.getPlayerTypes()
    await commands.getDeckTypes()
    await commands.getRoomChatId()
    await commands.sendChatMessage('chat-1', 'hello')
    await commands.createTable({ name: 'table', gameType: 'duel', deckType: 'modern', winsNeeded: 1, playerTypes: ['HUMAN'] })
    await commands.joinTable({ tableId: 'table-1', playerName: 'alice', playerType: 'HUMAN', deck: { name: 'deck', cards: [], sideboard: [] } })
    await commands.startMatch('table-1')
    await commands.watchTable('table-1')
    await commands.watchGame('game-1')
    await commands.joinGame('game-1')
    await commands.stopWatching('game-1')
    await commands.leaveTable('table-1')
    await commands.removeTable('table-1')

    expect(send).toHaveBeenCalledWith('connect', { host: 'localhost', port: 17171, username: 'alice', password: 'secret' })
    expect(send).toHaveBeenCalledWith('sendChatMessage', { chatId: 'chat-1', text: 'hello' })
    expect(send).toHaveBeenCalledWith('watchGame', { gameId: 'game-1' })
    expect(send).toHaveBeenCalledWith('joinGame', { gameId: 'game-1' })
    expect(send).toHaveBeenCalledWith('joinTable', expect.objectContaining({ tableId: 'table-1', playerType: 'HUMAN' }))
  })

  it('createTable reenvía los mazos de los asientos SIM', async () => {
    const simDeck = { name: 'Sim deck', cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }], sideboard: [] }
    await commands.createTable({
      name: 'table',
      gameType: 'duel',
      deckType: 'modern',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'SIM'],
      simDecks: [simDeck],
    })
    expect(send).toHaveBeenCalledWith('createTable', expect.objectContaining({ playerTypes: ['HUMAN', 'SIM'], simDecks: [simDeck] }))
  })

  it('maps every player input with the gameId', async () => {
    await commands.sendPlayerAction('PASS_PRIORITY_UNTIL_STACK_RESOLVED', 'game-1')
    await commands.sendPlayerBoolean(true, 'game-1')
    await commands.sendPlayerInteger(2, 'game-1')
    await commands.sendPlayerString('choice', 'game-1')
    await commands.sendPlayerUUID('card-1', 'game-1')
    await commands.sendPlayerManaType('game-1', 'player-1', 'RED')
    await commands.quitMatch('game-1')
    await commands.disconnect()

    expect(send).toHaveBeenCalledWith('sendPlayerAction', { action: 'PASS_PRIORITY_UNTIL_STACK_RESOLVED', gameId: 'game-1', data: undefined })
    expect(send).toHaveBeenCalledWith('sendPlayerBoolean', { value: true, gameId: 'game-1' })
    expect(send).toHaveBeenCalledWith('sendPlayerManaType', { gameId: 'game-1', playerId: 'player-1', manaType: 'RED' })
    expect(send).toHaveBeenCalledWith('quitMatch', { gameId: 'game-1' })
    expect(send).toHaveBeenCalledWith('disconnect')
  })

  it('maps hand-permission and viewer actions (G12-1/G12-2)', async () => {
    await commands.requestHandPermission('game-1', 'player-2')
    await commands.setHandRequestsAllowed('game-1', true)
    await commands.setHandRequestsAllowed('game-1', false)
    await commands.revokeHandPermissions('game-1')
    await commands.viewSideboard('game-1', 'player-1')
    await commands.viewLimitedDeck('game-1', 'player-1')

    expect(send).toHaveBeenCalledWith('sendPlayerAction', { action: 'REQUEST_PERMISSION_TO_SEE_HAND_CARDS', gameId: 'game-1', data: 'player-2' })
    expect(send).toHaveBeenCalledWith('sendPlayerAction', { action: 'PERMISSION_REQUESTS_ALLOWED_ON', gameId: 'game-1', data: null })
    expect(send).toHaveBeenCalledWith('sendPlayerAction', { action: 'PERMISSION_REQUESTS_ALLOWED_OFF', gameId: 'game-1', data: null })
    expect(send).toHaveBeenCalledWith('sendPlayerAction', { action: 'REVOKE_PERMISSIONS_TO_SEE_HAND_CARDS', gameId: 'game-1', data: null })
    expect(send).toHaveBeenCalledWith('sendPlayerAction', { action: 'VIEW_SIDEBOARD', gameId: 'game-1', data: 'player-1' })
    expect(send).toHaveBeenCalledWith('sendPlayerAction', { action: 'VIEW_LIMITED_DECK', gameId: 'game-1', data: 'player-1' })
  })

  describe('advisory proxy queries (XMage card DB)', () => {
    const deck = { name: 'deck', cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }], sideboard: [] }

    it('send the payload the proxy expects and return data', async () => {
      const report = { ready: true }
      send.mockResolvedValue({ ok: true, data: report })

      expect(await commands.validateDeck(deck)).toBe(report)
      expect(await commands.commanderEligibility(['Grist, the Hunger Tide'])).toBe(report)
      expect(await commands.validateDeckFormat(deck, 'Variant Magic - Commander')).toBe(report)
      expect(await commands.resolvePrintings(['Lightning Bolt'])).toBe(report)
      expect(await commands.cardPrintings(['Lightning Bolt'])).toBe(report)

      expect(send).toHaveBeenCalledWith('validateDeck', { deck })
      expect(send).toHaveBeenCalledWith('commanderEligibility', { names: ['Grist, the Hunger Tide'] })
      expect(send).toHaveBeenCalledWith('validateDeckFormat', { deck, deckType: 'Variant Magic - Commander', gameType: undefined })
      expect(send).toHaveBeenCalledWith('resolvePrintings', { names: ['Lightning Bolt'], strategy: 'default', setCode: undefined })
      expect(send).toHaveBeenCalledWith('cardPrintings', { names: ['Lightning Bolt'], limit: 0 })
    })

    it('return null when the proxy rejects the command or there is no data', async () => {
      send.mockResolvedValue({ ok: false, error: 'unknown action' })
      expect(await commands.validateDeck(deck)).toBeNull()
      expect(await commands.commanderEligibility(['X'])).toBeNull()
      expect(await commands.validateDeckFormat(deck)).toBeNull()
      expect(await commands.resolvePrintings(['X'], 'oldest')).toBeNull()
      expect(await commands.cardPrintings(['X'], 1)).toBeNull()
      expect(await commands.fetchOnlineDeckJson('moxfield', 'abc')).toBeNull()

      send.mockResolvedValue({ ok: true })
      expect(await commands.validateDeck(deck)).toBeNull()
      expect(await commands.cardPrintings(['X'])).toBeNull()
    })
  })

  it('server lists fall back to [] when the command fails', async () => {
    send.mockResolvedValue({ ok: false })
    expect(await commands.getGameTypes()).toEqual([])
    expect(await commands.getPlayerTypes()).toEqual([])
    expect(await commands.getDeckTypes()).toEqual([])
    expect(await commands.getTournamentTypes()).toEqual([])
    expect(await commands.getDraftCubes()).toEqual([])
    expect(await commands.getExpansionsWithBoosters()).toEqual([])
    expect(await commands.getFinishedMatches()).toEqual([])
    expect(await commands.getRoomChatId()).toBeUndefined()
    expect(await commands.getTournament('t-1')).toBeNull()
  })

  it('getTournamentTypes accepts plain names or objects and drops empty ones', async () => {
    send.mockResolvedValue({ ok: true, data: ['Booster Draft Elimination', { name: 'Sealed Elimination' }, { name: '' }, {}, null] })
    expect(await commands.getTournamentTypes()).toEqual(['Booster Draft Elimination', 'Sealed Elimination'])
  })

  it('without a gateway it fails with an explicit error', async () => {
    commands.setGateway(null)
    expect(() => commands.getGateway()).toThrow('gateway no inicializado')
    await expect(commands.validateDeck({ name: 'd', cards: [], sideboard: [] })).rejects.toThrow('gateway no inicializado')
  })
})
