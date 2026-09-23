import { useEffect, useRef } from 'react'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import type { CombatState } from '../state/slices/game'
import { feedbackSignature } from '../audio/promptSound'
import { loadNotificationAsked, saveNotificationAsked } from '../state/persistence'
import { useTranslation } from '../i18n'

export type AttentionReason = 'turn' | 'response'

export interface AttentionSnapshot {
  gameId: string | null
  turn: number
  myTurn: boolean
  promptSig: string | null
}

export function attentionSnapshot(
  game: GameView | null,
  gameId: string | null,
  feedback: FeedbackPrompt | null,
  combat: CombatState | null,
): AttentionSnapshot | null {
  const me = game?.players?.find((p) => p.controlled)
  if (!game || !me) return null
  const myTurn = game.activePlayerId ? game.activePlayerId === me.playerId : me.isActive === true
  const promptSig = feedback
    ? feedbackSignature(feedback)
    : combat
      ? `combat|${combat.mode}|${game.turn}|${game.step ?? ''}`
      : null
  return { gameId, turn: game.turn, myTurn, promptSig }
}

export function attentionReason(prev: AttentionSnapshot | null, next: AttentionSnapshot | null): AttentionReason | null {
  if (!next) return null
  const sameGame = !!prev && prev.gameId === next.gameId
  if (next.promptSig && (!sameGame || prev.promptSig !== next.promptSig)) return 'response'
  if (next.myTurn && (!sameGame || !prev.myTurn || prev.turn !== next.turn)) return 'turn'
  return null
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null
  saveNotificationAsked()
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

let pending = 0
let baseTitle: string | null = null
let baseIcon: string | null = null
let lastNotification: Notification | null = null

function faviconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
}

function paintFaviconBadge(): void {
  const link = faviconLink()
  if (!link) return
  if (baseIcon == null) baseIcon = link.href
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx || pending === 0) return
    ctx.drawImage(img, 0, 0, 64, 64)
    ctx.beginPath()
    ctx.arc(48, 16, 15, 0, Math.PI * 2)
    ctx.fillStyle = '#e5484d'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    try {
      link.href = canvas.toDataURL('image/png')
    } catch {}
  }
  img.src = baseIcon
}

export function clearAttention(): void {
  pending = 0
  if (baseTitle != null) document.title = baseTitle
  baseTitle = null
  const link = faviconLink()
  if (link && baseIcon != null) link.href = baseIcon
  baseIcon = null
  try {
    lastNotification?.close()
  } catch {}
  lastNotification = null
}

export function raiseAttention(opts: { label: string; title: string; body: string; tag: string; notify: boolean }): void {
  pending += 1
  if (baseTitle == null) baseTitle = document.title
  document.title = `(${pending}) ${opts.label} · ${baseTitle}`
  if (pending === 1) paintFaviconBadge()
  if (!opts.notify || !notificationsSupported() || Notification.permission !== 'granted') return
  try {
    lastNotification?.close()
    const n = new Notification(opts.title, { body: opts.body, tag: opts.tag, icon: '/logo.jpeg' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
    lastNotification = n
  } catch {}
}

export function useAttentionAlerts(
  game: GameView | null,
  gameId: string | null,
  feedback: FeedbackPrompt | null,
  combat: CombatState | null,
  enabled: boolean,
): void {
  const { t } = useTranslation()
  const prevRef = useRef<AttentionSnapshot | null>(null)
  const snapshot = attentionSnapshot(game, gameId, feedback, combat)
  const snapshotKey = snapshot ? `${snapshot.gameId}|${snapshot.turn}|${snapshot.myTurn}|${snapshot.promptSig ?? ''}` : null

  useEffect(() => {
    const reason = attentionReason(prevRef.current, snapshot)
    prevRef.current = snapshot
    if (!reason || typeof document === 'undefined' || !document.hidden) return
    const title = reason === 'turn' ? t('game', 'notify_your_turn') : t('game', 'notify_response')
    raiseAttention({
      label: title,
      title,
      body: reason === 'turn' ? t('game', 'notify_your_turn_body', { turn: snapshot?.turn ?? 0 }) : t('game', 'notify_response_body'),
      tag: `mage-${gameId ?? 'game'}`,
      notify: enabled,
    })
  }, [snapshotKey])

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) clearAttention()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearAttention()
    }
  }, [])

  useEffect(() => {
    if (!enabled || !notificationsSupported() || Notification.permission !== 'default' || loadNotificationAsked()) return
    const ask = () => {
      window.removeEventListener('pointerdown', ask, true)
      void requestNotificationPermission()
    }
    window.addEventListener('pointerdown', ask, true)
    return () => window.removeEventListener('pointerdown', ask, true)
  }, [enabled])
}
