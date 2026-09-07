import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef, useState } from 'react'
import { useStore, setState, getState } from '../state/store'
import ContextMenu from './ContextMenu'
import { clampMenuPos, playerMenuItems, playerMenuSide } from './playerMenu'
import type { PlayerMenuKey } from './playerMenu'
import * as cmds from '../net/commands'
import { saveHandRequestsAllowed } from '../state/persistence'
import { useTranslation } from '../i18n'

export default function PlayerContextMenu() {
  const menu = useStore((s) => s.playerMenu)
  const { t } = useTranslation()
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ x: menu?.x ?? 0, y: menu?.y ?? 0 })
  useLayoutEffect(() => {
    if (!menu) return
    let raf = 0
    // Siempre desde el cursor original: la primera medida puede ser previa al
    // CSS (ancho completo transitorio) y no debe fijar una posición basura.
    const fix = () => {
      const el = nodeRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const fixed = clampMenuPos(menu.x, menu.y, r.width, r.height, window.innerWidth, window.innerHeight)
      setPos((prev) => (fixed.x !== prev.x || fixed.y !== prev.y ? fixed : prev))
    }
    fix()
    raf = requestAnimationFrame(fix)
    return () => cancelAnimationFrame(raf)
  }, [menu?.x, menu?.y, menu?.playerId])
  if (!menu) return null
  const s = getState()
  const gameId = s.gameId ?? undefined
  const players = s.game?.players ?? []
  const player = players.find((p) => p.playerId === menu.playerId)
  if (!player || !gameId) return null
  const isSpectator = !players.some((p) => p.controlled)
  const side = playerMenuSide(player, isSpectator)
  const allowRequests = s.settings.allowHandRequests
  const items = playerMenuItems(
    { side, isComputer: player.isHuman === false, allowRequests },
    (key: PlayerMenuKey) => t('game', key),
  )
  const close = () => setState({ playerMenu: null })
  const onSelect = (id: string) => {
    switch (id) {
      case 'request-hand':
        void cmds.requestHandPermission(gameId, player.playerId)
        break
      case 'allow-hand': {
        const next = !getState().settings.allowHandRequests
        setState({ settings: { ...getState().settings, allowHandRequests: next } })
        saveHandRequestsAllowed(next)
        void cmds.setHandRequestsAllowed(gameId, next)
        break
      }
      case 'revoke-hand':
        void cmds.revokeHandPermissions(gameId)
        break
      case 'view-deck':
        void cmds.viewLimitedDeck(gameId, player.playerId)
        break
      case 'view-sideboard':
        void cmds.viewSideboard(gameId, player.playerId)
        break
    }
  }
  return createPortal(
    <ContextMenu x={pos.x} y={pos.y} items={items} onSelect={onSelect} onClose={close} menuRef={nodeRef} />,
    document.body,
  )
}
