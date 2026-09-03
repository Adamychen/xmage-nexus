import { describe, it, expect } from 'vitest'
import { localizeServerMessage, localizeOptionLabel } from './serverMessageTranslation'
import { es } from '../i18n/locales/es'

function t(ns: string, key: string, params?: Record<string, string | number>): string {
  let val = (es as any)[ns]?.[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replaceAll(`{${k}}`, String(v))
    }
  }
  return val
}

describe('serverMessageTranslation', () => {
  it('localizes pay mana costs', () => {
    expect(localizeServerMessage('Pay {1}{R}', t as any)).toBe('Pagar maná {1}{R}')
    expect(localizeServerMessage('Pay {0}', t as any)).toBe('Pagar maná {0}')
  })

  it('localizes pay life prompt', () => {
    expect(localizeServerMessage('Pay 2 life?', t as any)).toBe('¿Pagar 2 vidas?')
    expect(localizeServerMessage('Pay 3 life', t as any)).toBe('¿Pagar 3 vidas?')
  })

  it('localizes select target messages', () => {
    expect(localizeServerMessage('Select a target', t as any)).toBe('Elige objetivo')
    expect(localizeServerMessage('Choose a target', t as any)).toBe('Elige objetivo')
    expect(localizeServerMessage('Select target for Lightning Bolt', t as any)).toBe('Elige objetivo: Lightning Bolt')
    expect(localizeServerMessage('Select target creature', t as any)).toBe('Elige objetivo (creature)')
  })

  it('localizes starting player prompt', () => {
    expect(localizeServerMessage('Choose starting player', t as any)).toBe('Haz clic en tu avatar o en el oponente')
    expect(localizeServerMessage('Who will go first?', t as any)).toBe('Haz clic en tu avatar o en el oponente')
  })

  it('localizes mulligan prompts', () => {
    expect(localizeServerMessage('Take a mulligan?', t as any)).toBe('Hacer Mulligan?')
    expect(localizeServerMessage('Select a card to put on the bottom of your library', t as any)).toBe('Elige cartas para poner en el fondo de tu biblioteca')
    expect(localizeServerMessage('Select 2 cards to put on the bottom of your library', t as any)).toBe('Elige cartas para poner en el fondo de tu biblioteca (2)')
  })

  it('localizes discard messages', () => {
    expect(localizeServerMessage('Choose a card for them to discard', t as any)).toBe('Elige una carta para que descarte')
    expect(localizeServerMessage('Choose a card to discard', t as any)).toBe('Elige una carta para que descarte')
    expect(localizeServerMessage('Discard down to 7 cards', t as any)).toBe('Elige una carta para que descarte (7)')
  })

  it('localizes mode, color, and player choices', () => {
    expect(localizeServerMessage('Choose a mode', t as any)).toBe('Elige modo')
    expect(localizeServerMessage('Choose one', t as any)).toBe('Elige modo (1)')
    expect(localizeServerMessage('Choose two', t as any)).toBe('Elige modo (2)')
    expect(localizeServerMessage('Choose a color', t as any)).toBe('Elige un color')
    expect(localizeServerMessage('Choose a player', t as any)).toBe('Elige jugador')
  })

  it('localizes combat declarations', () => {
    expect(localizeServerMessage('Declare attackers', t as any)).toBe('Declara atacantes')
    expect(localizeServerMessage('Declare blockers', t as any)).toBe('Declara bloqueadores')
  })

  it('localizes option labels', () => {
    expect(localizeOptionLabel('Yes', t as any)).toBe('Sí')
    expect(localizeOptionLabel('No', t as any)).toBe('No')
    expect(localizeOptionLabel('Keep hand', t as any)).toBe('Mantener Mano')
    expect(localizeOptionLabel('Mulligan', t as any)).toBe('Hacer Mulligan')
    expect(localizeOptionLabel('White', t as any)).toBe('Blanco')
    expect(localizeOptionLabel('Blue', t as any)).toBe('Azul')
    expect(localizeOptionLabel('Black', t as any)).toBe('Negro')
    expect(localizeOptionLabel('Red', t as any)).toBe('Rojo')
    expect(localizeOptionLabel('Green', t as any)).toBe('Verde')
    expect(localizeOptionLabel('Cancel', t as any)).toBe('Cancelar')
    expect(localizeOptionLabel('Custom Card', t as any)).toBe('Custom Card')
  })
})
