import CloseButton from '../ui/CloseButton'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import Icon from '../ui/Icon'
import Tabs, { tabPanelProps } from '../ui/Tabs'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getState, setState } from '../state/state'
import type { TournamentView } from '../net/types'
import { isConstructStalled } from '../state/events/draft'
import { enterTournamentChat, exitTournamentChat } from '../state/actions'
import { stateLabel } from '../lobby/lobbyUtils'
import ChatBox from '../lobby/ChatBox'
import TournamentRounds from '../lobby/TournamentRounds'
import TournamentStandings from '../lobby/TournamentStandings'
import TournamentYourMatch from '../lobby/TournamentYourMatch'
import { UpdatedAgo } from '../lobby/TournamentBracket'
import { watchTournamentMatch } from '../lobby/useTournamentBracket'
import { currentRoundIndex, findMyMatch, isParticipant, myStanding } from '../lobby/tournament/matches'
import { tournamentPhase } from '../lobby/tournament/parse'
import { ordinalLabel } from '../lobby/tournamentPresentation'
import * as cmds from '../net/commands'
import { plural, useTranslation } from '../i18n'
import { confirmDialog } from '../ui/confirmDialog'
import { useEscape } from '../ui/useEscape'
import { clampDragPos, useDraggablePos } from '../ui/useDraggablePos'
import { useTournamentChatUnread } from './tournamentChatUnread'
import './TournamentPanel.css'

const MINI_POS_KEY = 'tournament_mini_pos'
const DRAG_THRESHOLD = 6

type PanelTab = 'standings' | 'rounds' | 'chat'

function UnreadBadge({ count, className, testId }: { count: number; className: string; testId: string }) {
  const { t } = useTranslation()
  if (count <= 0) return null
  return (
    <span className={className} role="img" aria-label={t('game', 'trn_g_chat_unread', { count })} data-testid={testId}>
      {count > 9 ? '9+' : count}
    </span>
  )
}

interface DragState {
  startX: number
  startY: number
  origLeft: number
  origTop: number
  moved: boolean
}

function MiniPill({ view, viewer, unread, pillRef, pos, dragging, onPointerDown, onPointerMove, onEnd, onClick }: {
  view: TournamentView
  viewer: string | undefined
  unread: number
  pillRef: React.RefObject<HTMLButtonElement | null>
  pos: { left: number; top: number } | null
  dragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onEnd: () => void
  onClick: () => void
}) {
  const { t, lang } = useTranslation()
  const current = currentRoundIndex(view)
  const mine = viewer ? findMyMatch(view, viewer) : null
  const myMatch = mine && mine.roundIndex === current ? mine : null
  const standing = viewer ? myStanding(view, viewer) : null
  let content: React.ReactNode
  if (myMatch && viewer && standing && myMatch.match.players) {
    const side = myMatch.side
    const opponent = myMatch.match.players[side === 0 ? 1 : 0]
    content = (
      <>
        <span className="tournament-mini-round" data-testid="tournament-mini-round">{t('game', 'trn_f_pill_round', { number: current + 1 })}</span>
        <span className="tournament-mini-score" data-testid="tournament-mini-score">
          {`${viewer} ${myMatch.match.wins[side]}–${myMatch.match.wins[side === 0 ? 1 : 0]} ${opponent}`}
        </span>
        <span className="tournament-mini-standing" data-testid="tournament-mini-standing">
          {t('lobby', 'trn_b_standing', {
            rank: ordinalLabel(standing.rank, lang, t),
            points: plural('lobby', 'trn_b_points', standing.points),
          })}
        </span>
      </>
    )
  } else {
    content = (
      <span className="tournament-mini-name" data-testid="tournament-mini-name">
        {view.tournamentName} — {stateLabel(t, view.tournamentState)}
      </span>
    )
  }
  return (
    <button
      type="button"
      ref={pillRef}
      className={`tournament-panel-mini${dragging ? ' is-dragging' : ''}`}
      style={pos ? { left: pos.left, top: pos.top, transform: 'none' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onClick={onClick}
      data-testid="tournament-panel-mini"
      title={t('game', 'tournament_view_bracket_tooltip')}
    >
      <Icon name="trophy" size={13} />
      {content}
      <UnreadBadge count={unread} className="tournament-unread-badge" testId="tournament-mini-unread" />
      <span className="tournament-mini-expand">{t('game', 'tournament_view_bracket')}</span>
    </button>
  )
}

export default function TournamentPanel() {
  const { t } = useTranslation()
  const idBase = useId().replace(/:/g, '')
  const tournament = useStore((s) => s.tournament)
  const tournamentChatId = useStore((s) => s.tournamentChatId)
  const draftOverAt = useStore((s) => s.draftOverAt)
  const hasConstruct = useStore((s) => s.construct != null)
  const viewer = useStore((s) => s.conn?.username)
  const [expanded, setExpanded] = useState(true)
  const [tab, setTab] = useState<PanelTab>('rounds')
  const [quitting, setQuitting] = useState(false)
  const [watchingMatchId, setWatchingMatchId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const miniRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const focusPanelOnOpen = useRef(false)
  const focusPillOnCollapse = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const [miniPos, setMiniPos] = useDraggablePos(MINI_POS_KEY, () => miniRef.current, 320, 36)
  const [dragging, setDragging] = useState(false)
  const unread = useTournamentChatUnread(tournamentChatId, viewer, expanded && tab === 'chat')
  const view = tournament?.view ?? null
  const tid = tournament?.tournamentId ?? null
  const idPrefix = `trn-panel-${idBase}`
  const titleId = `${idPrefix}-title`

  const collapse = useCallback(() => {
    focusPillOnCollapse.current = true
    setExpanded(false)
  }, [])

  const expand = () => {
    focusPanelOnOpen.current = true
    setExpanded(true)
  }

  useEscape(collapse, expanded && tournament != null)

  useEffect(() => {
    if (expanded) {
      if (focusPanelOnOpen.current) {
        focusPanelOnOpen.current = false
        panelRef.current?.focus()
      }
    } else if (focusPillOnCollapse.current) {
      focusPillOnCollapse.current = false
      miniRef.current?.focus()
    }
  }, [expanded])

  useEffect(() => {
    if (expanded || !miniPos) return
    const el = miniRef.current
    if (!el) return
    const w = el.offsetWidth || 320
    const h = el.offsetHeight || 36
    const next = clampDragPos(miniPos.left, miniPos.top, w, h, window.innerWidth, window.innerHeight)
    if (next.left !== miniPos.left || next.top !== miniPos.top) setMiniPos(next)
  }, [expanded, miniPos, setMiniPos])

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
    if (view) setUpdatedAt(Date.now())
  }, [view])

  useEffect(() => {
    const id = tournament?.tournamentId
    if (!id) return
    void enterTournamentChat(id)
    return () => exitTournamentChat()
  }, [tournament?.tournamentId])

  useEffect(() => {
    const id = tournament?.tournamentId
    if (!id) return
    let cancelled = false
    const refresh = async () => {
      try {
        const data = await cmds.getTournament(id)
        if (!cancelled && data && typeof data === 'object' && 'tournamentName' in (data as Record<string, unknown>)) {
          if (getState().tournament?.tournamentId === id) {
            setState({ tournament: { tournamentId: id, view: data as TournamentView } })
          }
        }
      } catch {}
    }
    const interval = window.setInterval(() => {
      void refresh()
    }, 8000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [tournament?.tournamentId])

  if (!tournament || !view || !tid) return null

  const participant = !!viewer && isParticipant(view, viewer)
  const current = currentRoundIndex(view)
  const phase = tournamentPhase(view.tournamentState)
  const kicker = phase === 'dueling' && current >= 0
    ? t('game', 'trn_f_kicker', { number: current + 1 })
    : t('game', 'tournament_in_progress')

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
      <MiniPill
        view={view}
        viewer={viewer}
        unread={unread}
        pillRef={miniRef}
        pos={miniPos}
        dragging={dragging}
        onPointerDown={onMiniPointerDown}
        onPointerMove={onMiniPointerMove}
        onEnd={endMiniDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          expand()
        }}
      />
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

  const tabs = [
    { id: 'standings' as const, label: t('lobby', 'standings_title'), testId: 'tournament-panel-tab-standings' },
    { id: 'rounds' as const, label: t('lobby', 'trn_b_rounds_label'), testId: 'tournament-panel-tab-rounds' },
    {
      id: 'chat' as const,
      label: t('game', 'trn_f_tab_chat'),
      testId: 'tournament-panel-tab-chat',
      badge: <UnreadBadge count={unread} className="tournament-unread-badge" testId="tournament-panel-tab-chat-unread" />,
    },
  ]

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="tournament-panel is-docked chrome-surface"
      role="complementary"
      aria-labelledby={titleId}
      data-testid="tournament-panel"
    >
      <header className="tournament-panel-header">
        <div className="tournament-panel-heading">
          <span className="tournament-panel-kicker" data-testid="tournament-panel-kicker">
            <Icon name="trophy" size={13} />
            <span>{kicker}</span>
          </span>
          <h2 id={titleId} className="tournament-panel-name" data-testid="tournament-panel-name">{view.tournamentName}</h2>
        </div>
        <div className="tournament-panel-actions">
          <IconButton
            icon="minus"
            label={t('game', 'trn_f_collapse')}
            size="xl"
            variant="subtle"
            data-testid="tournament-panel-collapse"
            onClick={collapse}
          />
          <CloseButton
            variant="solid"
            size="lg"
            label={t('game', 'tournament_close')}
            className="tournament-panel-close"
            data-testid="tournament-panel-close"
            onClick={collapse}
          />
        </div>
      </header>
      {isConstructStalled(draftOverAt, hasConstruct, now) && (
        <div className="tournament-stalled-banner" data-testid="tournament-stalled-banner" role="alert">
          {t('game', 'tournament_construct_stalled')}
        </div>
      )}
      {participant && viewer && (
        <div className="tournament-panel-match">
          <TournamentYourMatch view={view} username={viewer} title={t('game', 'trn_f_this_match')} />
        </div>
      )}
      <Tabs<PanelTab>
        className="tournament-panel-tabs"
        variant="underline"
        items={tabs}
        value={tab}
        onChange={setTab}
        idPrefix={idPrefix}
        label={t('game', 'trn_f_tabs_label')}
      />
      <div className={`tournament-panel-body is-${tab}`} {...tabPanelProps(idPrefix, tab)}>
        {tab === 'standings' && <TournamentStandings view={view} viewer={viewer} />}
        {tab === 'rounds' && (
          <TournamentRounds
            view={view}
            tournamentId={tid}
            canWatch={view.watchingAllowed}
            onWatchMatch={(id) => void handleWatchMatch(id)}
            watchingMatchId={watchingMatchId}
          />
        )}
        {tab === 'chat' && tournamentChatId && (
          <div className="tournament-panel-chat" data-testid="tournament-panel-chat">
            <ChatBox chatIdOverride={tournamentChatId} />
          </div>
        )}
      </div>
      <footer className="tournament-panel-footer">
        {updatedAt != null && <UpdatedAgo at={updatedAt} />}
        {participant && (
          <Button
            variant="soft-danger"
            size="md"
            className="tournament-panel-leave"
            onClick={() => void handleQuit()}
            disabled={quitting}
            data-testid="tournament-panel-quit"
          >
            {quitting ? t('game', 'tournament_leaving') : t('lobby', 'trn_b_leave')}
          </Button>
        )}
      </footer>
    </aside>
  )
}
