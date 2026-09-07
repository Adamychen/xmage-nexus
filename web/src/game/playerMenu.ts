import type { ContextMenuItem } from './ContextMenu'

export type PlayerMenuSide = 'self' | 'other' | 'watched'

export interface PlayerMenuContext {
  side: PlayerMenuSide
  isComputer: boolean
  allowRequests: boolean
}

export function playerMenuSide(player: { controlled?: boolean }, isSpectator: boolean): PlayerMenuSide {
  if (!isSpectator && player.controlled === true) return 'self'
  return isSpectator ? 'watched' : 'other'
}

export type PlayerMenuKey =
  | 'player_menu_request_hand'
  | 'player_menu_allow_hand_on'
  | 'player_menu_allow_hand_off'
  | 'player_menu_revoke_hand'
  | 'player_menu_view_deck'
  | 'player_menu_view_sideboard'

export function playerMenuItems(ctx: PlayerMenuContext, t: (key: PlayerMenuKey) => string): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  if (ctx.side === 'self') {
    items.push({
      id: 'allow-hand',
      label: t(ctx.allowRequests ? 'player_menu_allow_hand_on' : 'player_menu_allow_hand_off'),
      icon: 'shield',
    })
    items.push({ id: 'revoke-hand', label: t('player_menu_revoke_hand'), icon: 'door' })
    items.push({ id: 'view-deck', label: t('player_menu_view_deck'), icon: 'layers' })
    items.push({ id: 'view-sideboard', label: t('player_menu_view_sideboard'), icon: 'book' })
  } else {
    items.push({ id: 'request-hand', label: t('player_menu_request_hand'), icon: 'eye' })
    if (ctx.side === 'other' && ctx.isComputer) {
      items.push({ id: 'view-deck', label: t('player_menu_view_deck'), icon: 'layers' })
      items.push({ id: 'view-sideboard', label: t('player_menu_view_sideboard'), icon: 'book' })
    }
  }
  return items
}

/** Ancla un menú flotante al viewport para que nunca se salga por los bordes. */
export function clampMenuPos(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin = 8,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, margin), Math.max(margin, vw - w - margin)),
    y: Math.min(Math.max(y, margin), Math.max(margin, vh - h - margin)),
  }
}
