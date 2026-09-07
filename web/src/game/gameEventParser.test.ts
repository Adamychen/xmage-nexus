import { describe, expect, it } from 'vitest'
import { cleanMageText, formatFeedText, parseGameEvent, type FeedT, type ParsedGameEvent } from './gameEventParser'
import { es } from '../i18n/locales/es'
import { en } from '../i18n/locales/en'

function dictT(dict: typeof es): FeedT {
  return (_cat, key, params) => {
    let s: string = dict.game[key]
    for (const [k, v] of Object.entries(params ?? {})) s = s.split(`{${k}}`).join(String(v))
    return s
  }
}

const esT = dictT(es)
const enT = dictT(en)

function parsed(raw: string, me = 'Alice'): ParsedGameEvent {
  const p = parseGameEvent(raw, me)
  if (!p) throw new Error(`expected parse, got null: ${raw}`)
  return p
}

const esText = (raw: string, me = 'Alice') => formatFeedText(parsed(raw, me), esT)

describe('gameEventParser', () => {
  it('cleans HTML tags and XMage 3-hex object IDs', () => {
    const raw = "<font color='#ffaa00'>Player</font> casts <font color='cyan'>Lightning Bolt</font> [a1b] from Hand"
    expect(cleanMageText(raw)).toBe('Player casts Lightning Bolt from Hand')
  })

  it('parses real XMage turn events with life totals', () => {
    const res = parseGameEvent('Turn 1 Player1 (0 - 20)', 'Player1')
    expect(res).not.toBeNull()
    expect(res?.type).toBe('turn')
    expect(res?.amount).toBe(1)
    expect(res?.playerName).toBe('Player1')
    expect(res?.isMe).toBe(true)
    expect(esText('Turn 1 Player1 (0 - 20)', 'Player1')).toBe('Turno 1 · Player1')
  })

  it('parses real XMage spell casts with [abc] IDs, targets and zone suffix', () => {
    const raw1 = "<font color='#ffaa00'>Alice</font> casts <font color='cyan'>Lightning Bolt</font> [3f9] [target: <font color='#ffaa00'>Bob</font>] from Hand"
    const withTarget = parseGameEvent(raw1, 'Alice')
    expect(withTarget?.type).toBe('cast')
    expect(withTarget?.cardName).toBe('Lightning Bolt')
    expect(withTarget?.targetName).toBe('Bob')
    expect(withTarget?.isMe).toBe(true)
    expect(esText(raw1, 'Alice')).toBe('Alice lanza Lightning Bolt ➔ Bob')

    const raw2 = 'Bob casts Wrath of God [12a] from Hand'
    const noTarget = parseGameEvent(raw2, 'Alice')
    expect(noTarget?.type).toBe('cast')
    expect(noTarget?.cardName).toBe('Wrath of God')
    expect(noTarget?.targetName).toBeUndefined()
    expect(noTarget?.isMe).toBe(false)
    expect(esText(raw2, 'Alice')).toBe('Bob lanza Wrath of God')
  })

  it('parses real XMage land drops with [abc] IDs and from Hand', () => {
    const raw = "<font color='#ffaa00'>Alice</font> plays <font color='cyan'>Mountain</font> [e01] from Hand"
    const res = parseGameEvent(raw, 'Alice')
    expect(res?.type).toBe('land')
    expect(res?.cardName).toBe('Mountain')
    expect(res?.isMe).toBe(true)
    expect(esText(raw, 'Alice')).toBe('Alice juega Mountain')
  })

  it('parses real XMage attacks and blocks', () => {
    const attack = parseGameEvent('Alice attacks with Grizzly Bears [4b2]', 'Alice')
    expect(attack?.type).toBe('attack')
    expect(attack?.cardName).toBe('Grizzly Bears')
    expect(esText('Alice attacks with Grizzly Bears [4b2]', 'Alice')).toBe('Alice ataca con Grizzly Bears')

    const block = parseGameEvent('Bob blocks Grizzly Bears [4b2] with Llanowar Elves [99c]', 'Alice')
    expect(block?.type).toBe('block')
    expect(block?.cardName).toBe('Llanowar Elves')
    expect(block?.targetName).toBe('Grizzly Bears')
    expect(esText('Bob blocks Grizzly Bears [4b2] with Llanowar Elves [99c]', 'Alice')).toBe(
      'Bob bloquea a Grizzly Bears con Llanowar Elves'
    )
  })

  it('parses real XMage damage and life changes', () => {
    const dmg = parseGameEvent('Lightning Bolt [3f9] deals 3 damage to Bob', 'Bob')
    expect(dmg?.type).toBe('damage')
    expect(dmg?.cardName).toBe('Lightning Bolt')
    expect(dmg?.targetName).toBe('Bob')
    expect(dmg?.amount).toBe(3)
    expect(dmg?.isMe).toBe(true)
    expect(esText('Lightning Bolt [3f9] deals 3 damage to Bob', 'Bob')).toBe('Lightning Bolt inflige 3 de daño a Bob')

    const lifeLoss = parseGameEvent('Bob loses 2 life', 'Bob')
    expect(lifeLoss?.type).toBe('life')
    expect(lifeLoss?.amount).toBe(-2)
    expect(esText('Bob loses 2 life', 'Bob')).toBe('Bob pierde 2 vidas (-2)')

    const lifeGain = parseGameEvent('Alice gains 4 life', 'Alice')
    expect(lifeGain?.type).toBe('life')
    expect(lifeGain?.amount).toBe(4)
    expect(esText('Alice gains 4 life', 'Alice')).toBe('Alice gana 4 vidas (+4)')
  })

  it('parses attacks with defender and creature counts', () => {
    expect(esText('Father attacks Necrosis with 1 creature', 'Father')).toBe('Father ataca a Necrosis con 1 criatura')
    expect(esText('Father attacks Necrosis with 3 creatures', 'Father')).toBe('Father ataca a Necrosis con 3 criaturas')
    expect(esText('Alice attacks with 2 creatures', 'Alice')).toBe('Alice ataca con 2 criaturas')
    expect(esText('Alice attacks Bob with Grizzly Bears', 'Alice')).toBe('Alice ataca a Bob con Grizzly Bears')
    expect(esText('Alice attacks', 'Alice')).toBe('Alice ataca con criaturas')
  })

  it('parses player-prefixed ability triggers with rules text and targeting', () => {
    expect(
      esText(
        'Necrosis - Ability triggers: Borborygmos Enraged - Whenever Borborygmos Enraged deals combat damage to a player, reveal the top three cards of your library.',
        'Necrosis'
      )
    ).toBe(
      'Habilidad disparada: Borborygmos Enraged (Whenever Borborygmos Enraged deals combat damage to a player, reveal the top three cards of your library.)'
    )
    expect(
      esText(
        "John - Ability triggers: Duelist's Heritage - Whenever one or more creatures attack, you may have target attacking creature gain double strike until end of turn. - targeting Old-Growth Dryads",
        'John'
      )
    ).toBe("Habilidad disparada: Duelist's Heritage ➔ Old-Growth Dryads")
    expect(esText('Ability triggers: Soul Warden', 'Alice')).toBe('Habilidad disparada: Soul Warden')
  })

  it('parses phase waiting lines', () => {
    expect(esText('Combat Damage - Waiting for Necrosis', 'Alice')).toBe('Fin de combate — esperando a Necrosis')
    expect(esText('Upkeep - Waiting for Father', 'Father')).toBe('Mantenimiento — esperando a Father')
    expect(esText('Precombat Main - Waiting for 4Mana', 'Alice')).toBe('Principal 1 — esperando a 4Mana')
    expect(esText('End Turn - Waiting for rrrr', 'Alice')).toBe('Paso final — esperando a rrrr')
  })

  it('parses combat status lines', () => {
    expect(esText('Attacker: Old-Growth Dryads (3/3) unblocked', 'Alice')).toBe(
      'Atacante: Old-Growth Dryads (3/3), sin bloquear'
    )
    expect(esText('Attacker: Grizzly Bears (2/2) blocked by Llanowar Elves (1/1)', 'Alice')).toBe(
      'Atacante: Grizzly Bears (2/2), bloqueado por Llanowar Elves (1/1)'
    )
    expect(esText('Attacked player: Necrosis', 'Necrosis')).toBe('Jugador atacado: Necrosis')
  })

  it('parses reveals and zone moves with source', () => {
    expect(esText('Necrosis reveals Thornspire Verge, Explosive Vegetation, Mountain', 'Alice')).toBe(
      'Necrosis muestra Thornspire Verge, Explosive Vegetation, Mountain'
    )
    expect(esText('Necrosis puts a card from library into their hand', 'Alice')).toBe(
      'Necrosis pone una carta en su mano'
    )
    expect(
      esText(
        'Necrosis puts Explosive Vegetation from library into their graveyard (source: Borborygmos Enraged)',
        'Alice'
      )
    ).toBe('Necrosis pone Explosive Vegetation en su cementerio (Borborygmos Enraged)')
    expect(
      esText('4Mana puts a card from hand to the top of their library (source: Brainstorm)', 'Alice')
    ).toBe('4Mana pone una carta en lo alto de su biblioteca (Brainstorm)')
    expect(esText('4Mana puts Brainstorm from stack into their graveyard', 'Alice')).toBe(
      '4Mana pone Brainstorm en su cementerio'
    )
    expect(esText('4Mana puts Snow-Covered Island from hand onto the Battlefield', 'Alice')).toBe(
      'Snow-Covered Island entra al campo de batalla'
    )
  })

  it('parses wins and concessions', () => {
    expect(esText('Alice won the game', 'Alice')).toBe('Alice gana la partida')
    expect(esText('Bob won the match', 'Alice')).toBe('Bob gana el match')
    expect(esText('Bob has conceded', 'Alice')).toBe('Bob concede la partida')
  })

  it('keeps already-Spanish announcements verbatim', () => {
    const res = parsed('Fin de partida: Alice gana 2-0', 'Alice')
    expect(res.type).toBe('system')
    expect(res.text.kind).toBe('verbatim')
    expect(formatFeedText(res, esT)).toBe('Fin de partida: Alice gana 2-0')
  })

  it('ignores spectator and join noise', () => {
    expect(parseGameEvent('Espectador: mirando la partida a8a976c9…', 'Alice')).toBeNull()
    expect(parseGameEvent('Alice has joined the game', 'Alice')).toBeNull()
  })

  it('localizes the same event in another language', () => {
    const p = parsed('Bob loses 2 life', 'Bob')
    expect(formatFeedText(p, enT)).toBe('Bob loses 2 life (-2)')
    expect(formatFeedText(p, esT)).toBe('Bob pierde 2 vidas (-2)')
    const w = parsed('Combat Damage - Waiting for Necrosis', 'Alice')
    expect(formatFeedText(w, enT)).toBe('End Combat — waiting for Necrosis')
  })
})
