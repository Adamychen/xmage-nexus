import { useRef, useState, useEffect } from 'react'
import { useStore } from '../state/store'
import { isConstructStalled } from '../state/events/draft'
import { enterTournamentChat, exitTournamentChat } from '../state/actions'
import TournamentBracket from '../lobby/TournamentBracket'
import ChatBox from '../lobby/ChatBox'
import { watchTournamentMatch } from '../lobby/useTournamentBracket'
import * as cmds from '../net/commands'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { confirmDialog } from '../ui/confirmDialog'
import { clampDragPos, useDraggablePos } from '../ui/useDraggablePos'
import './TournamentPanel.css'

const MINI_POS_KEY = 'tournament_mini_pos'
const DRAG_THRESHOLD = 6

export default function TournamentPanel() {
  const { t } = useTranslation()
  const tournament = useStore((s) => s.tournament)
  const tournamentChatId = useStore((s) => s.tournamentChatId)
  const draftOverAt = useStore((s) => s.draftOverAt)
  const hasConstruct = useStore((s) => s.construct != null)
  const [expanded, setExpanded] = useState(true)
  const [quitting, setQuitting] = useState(false)
  const [watchingMatchId, setWatchingMatchId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const miniRef = useRef<HTMLButtonElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const [miniPos, setMiniPos] = useDraggablePos(MINI_POS_KEY, () => miniRef.current, 320, 36)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (expanded || !miniPos) return
    const el = miniRef.current
    if (!el) return
    const w = el.offsetWidth || 320
    const h = el.offsetHeight || 36
    const next = clampDragPos(miniPos.left, miniPos.top, w, h, window.innerWidth, window.innerHeight)
    if (next.left !== miniPos.left || next.top !== miniPos.top) setMiniPos(next)
  }, [expanded])
  const watchStall = draftOverAt != null && !hasConstruct
  useEffect(() => {
    if (!watchStall) return
    const id = window.setInterval(() => setNow(Date.now()), 10000)
    return () => window.clearInterval(id)
  }, [watchStall])

  useEffect(() => {
    if (tournament) setExpanded(true)
  }, [tournament?.tournamentId])

  useEffect(() => {
    const tid = tournament?.tournamentId
    if (!tid) return
    void enterTournamentChat(tid)
    return () => exitTournamentChat()
  }, [tournament?.tournamentId])

  if (!tournament) return null

  const view = tournament.view
  const tid = tournament.tournamentId

  if (!expanded) {
    const onMiniPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if (window.innerWidth <= 600) return
      suppressClickRef.current = false
      const el = miniRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: miniPos ? miniPos.left : rect.left,
        origTop: miniPos ? miniPos.top : rect.top,
        moved: false,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    }
    const onMiniPointerMove = (e: React.PointerEvent) => {
      const drag = dragRef.current
      const el = miniRef.current
      if (!drag || !el) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.moved = true
      suppressClickRef.current = true
      setDragging(true)
      const w = el.offsetWidth || 320
      const h = el.offsetHeight || 36
      setMiniPos(clampDragPos(drag.origLeft + dx, drag.origTop + dy, w, h, window.innerWidth, window.innerHeight))
    }
    const endMiniDrag = () => {
      dragRef.current = null
      setDragging(false)
    }
    return (
      <button
        type="button"
        ref={miniRef}
        className={`tournament-panel-mini${dragging ? ' is-dragging' : ''}`}
        style={miniPos ? { left: miniPos.left, top: miniPos.top, transform: 'none' } : undefined}
        onPointerDown={onMiniPointerDown}
        onPointerMove={onMiniPointerMove}
        onPointerUp={endMiniDrag}
        onPointerCancel={endMiniDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          setExpanded(true)
        }}
        data-testid="tournament-panel-mini"
        title={t('game', 'tournament_view_bracket_tooltip')}
      >
        <Icon name="trophy" size={13} /> {view.tournamentName} — {view.tournamentState} · {view.players.length} {t('lobby', view.players.length === 1 ? 'tournament_player_single' : 'tournament_player_plural')}
        <span className="tournament-mini-expand">{t('game', 'tournament_view_bracket')}</span>
      </button>
    )
  }

  const handleQuit = async () => {
    if (quitting) return
    if (!(await confirmDialog(t('game', 'tournament_quit_confirm'), { danger: true }))) return
    setQuitting(true)
    try {
      await cmds.quitTournament(tid)
    } finally {
      setQuitting(false)
    }
  }

  const handleWatchMatch = async (tableId: string) => {
    if (watchingMatchId) return
    setWatchingMatchId(tableId)
    try {
      await watchTournamentMatch(tableId)
    } finally {
      setWatchingMatchId(null)
    }
  }

  return (
    <div className="tournament-panel-backdrop" role="presentation" data-testid="tournament-panel">
      <section className="tournament-panel" role="dialog" aria-modal="true" aria-label={t('game', 'tournament_in_progress')}>
        <header className="tournament-panel-header">
          <div className="tournament-panel-title">
            <span className="tournament-panel-icon"><Icon name="trophy" size={15} /></span>
            <span>{t('game', 'tournament_in_progress')}</span>
            <span className="tournament-panel-name" data-testid="tournament-panel-name">{view.tournamentName}</span>
          </div>
          <div className="tournament-panel-actions">
            <button
              type="button"
              className="tournament-panel-collapse"
              onClick={() => setExpanded(false)}
              title={t('game', 'tournament_minimize')}
            >
              {t('game', 'tournament_minimize')}
            </button>
            <button
              type="button"
              className="tournament-panel-quit"
              onClick={() => void handleQuit()}
              disabled={quitting}
              data-testid="tournament-panel-quit"
            >
              {quitting ? t('game', 'tournament_leaving') : t('game', 'tournament_quit_short')}
            </button>
            <button
              type="button"
              className="tournament-panel-close"
              onClick={() => setExpanded(false)}
              aria-label={t('game', 'tournament_close')}
            >
              ✕
            </button>
          </div>
        </header>
        {isConstructStalled(draftOverAt, hasConstruct, now) && (
          <div className="tournament-stalled-banner" data-testid="tournament-stalled-banner" role="alert">
            {t('game', 'tournament_construct_stalled')}
          </div>
        )}
        <div className="tournament-panel-scroll">
          <TournamentBracket
            view={view}
            tournamentId={tid}
            compact
            onWatchMatch={(id) => void handleWatchMatch(id)}
            watchingMatchId={watchingMatchId}
          />
          {tournamentChatId && (
            <div className="tournament-panel-chat" data-testid="tournament-panel-chat">
              <ChatBox chatIdOverride={tournamentChatId} />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
