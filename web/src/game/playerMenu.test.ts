import { describe, it, expect } from 'vitest'
import { clampMenuPos, playerMenuItems, playerMenuSide } from './playerMenu'
import type { PlayerMenuKey } from './playerMenu'

const t = (key: PlayerMenuKey) => key

describe('playerMenuSide', () => {
  it('es self cuando controla y no es espectador', () => {
    expect(playerMenuSide({ controlled: true }, false)).toBe('self')
  })
  it('es other para rivales en partida', () => {
    expect(playerMenuSide({ controlled: false }, false)).toBe('other')
    expect(playerMenuSide({}, false)).toBe('other')
  })
  it('es watched para espectadores aunque controle (fallback)', () => {
    expect(playerMenuSide({ controlled: true }, true)).toBe('watched')
    expect(playerMenuSide({ controlled: false }, true)).toBe('watched')
  })
})

describe('playerMenuItems', () => {
  it('self: allow + revoke + deck + sideboard', () => {
    const items = playerMenuItems({ side: 'self', isComputer: false, allowRequests: true }, t)
    expect(items.map((i) => i.id)).toEqual(['allow-hand', 'revoke-hand', 'view-deck', 'view-sideboard'])
  })
  it('self: la etiqueta del toggle refleja el estado', () => {
    const on = playerMenuItems({ side: 'self', isComputer: false, allowRequests: true }, t)
    const off = playerMenuItems({ side: 'self', isComputer: false, allowRequests: false }, t)
    expect(on[0].label).toBe('player_menu_allow_hand_on')
    expect(off[0].label).toBe('player_menu_allow_hand_off')
  })
  it('other humano: solo request', () => {
    const items = playerMenuItems({ side: 'other', isComputer: false, allowRequests: true }, t)
    expect(items.map((i) => i.id)).toEqual(['request-hand'])
  })
  it('other IA: request + deck + sideboard', () => {
    const items = playerMenuItems({ side: 'other', isComputer: true, allowRequests: true }, t)
    expect(items.map((i) => i.id)).toEqual(['request-hand', 'view-deck', 'view-sideboard'])
  })
  it('watched (espectador): solo request', () => {
    const items = playerMenuItems({ side: 'watched', isComputer: false, allowRequests: true }, t)
    expect(items.map((i) => i.id)).toEqual(['request-hand'])
  })
})

describe('clampMenuPos', () => {
  it('deja intacta una posición con sitio', () => {
    expect(clampMenuPos(100, 100, 180, 140, 1280, 720)).toEqual({ x: 100, y: 100 })
  })
  it('recorta por abajo y por la derecha (clic en la barra propia)', () => {
    expect(clampMenuPos(100, 650, 180, 140, 1280, 720)).toEqual({ x: 100, y: 572 })
    expect(clampMenuPos(1200, 100, 180, 140, 1280, 720)).toEqual({ x: 1092, y: 100 })
  })
  it('respeta el margen mínimo arriba/izquierda', () => {
    expect(clampMenuPos(-50, -20, 180, 140, 1280, 720)).toEqual({ x: 8, y: 8 })
  })
})
