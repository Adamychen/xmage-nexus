import { useEffect, useMemo, useState } from 'react'
import type { CardView, PermanentView, PlayerView } from '../net/types'
import { useStore } from '../state/store'
import { awaitImageUrl } from '../cards/cardImages'
import { useTranslation } from '../i18n'
import Icon, { type IconName } from '../ui/Icon'
import DungeonMap from './DungeonMap'
import {
  dungeonProgressKey,
  dungeonRoot,
  findDungeonGraph,
  pathToRoom,
  type DungeonGraph,
} from './dungeons'
import './MechanicsTray.css'

interface MechanicsTrayProps {
  onHoverCard?: (card: CardView | null, rect?: DOMRect) => void
}

interface RingState {
  level: number
  bearerName?: string
  player: PlayerView
}

interface DungeonState {
  name: string
  player: PlayerView
  graph: DungeonGraph | null
  visited: string[]
}

interface DayNightState {
  isNight: boolean
}

function getRingLevels(t: (c: any, k: any) => string) {
  return [
    { level: 1, title: t('game', 'ring_level_1_title'), rule: t('game', 'ring_level_1_rule') },
    { level: 2, title: t('game', 'ring_level_2_title'), rule: t('game', 'ring_level_2_rule') },
    { level: 3, title: t('game', 'ring_level_3_title'), rule: t('game', 'ring_level_3_rule') },
    { level: 4, title: t('game', 'ring_level_4_title'), rule: t('game', 'ring_level_4_rule') },
  ]
}

type DungeonRoomDef = { keys: string[]; label: string }

function getFallbackRooms(t: (c: any, k: any) => string): DungeonRoomDef[] {
  return [
    { keys: [], label: t('game', 'dungeon_fallback_1') },
    { keys: [], label: t('game', 'dungeon_fallback_2') },
    { keys: [], label: t('game', 'dungeon_fallback_3') },
  ]
}

function findRingBearer(player: PlayerView): string | undefined {
  const battlefield = player.battlefield ?? {}
  for (const perm of Object.values(battlefield)) {
    const p = perm as PermanentView & { isRingBearer?: boolean; ringBearer?: boolean }
    if (p.isRingBearer || p.ringBearer) {
      return p.displayName || p.name || 'Creature'
    }
  }
  return undefined
}

export default function MechanicsTray({ onHoverCard }: MechanicsTrayProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const gameId = useStore((s) => s.gameId)
  const progress = useStore((s) => s.dungeonProgress)
  const [activeTab, setActiveTab] = useState<string>('auto')
  const [tokenImages, setTokenImages] = useState<Record<string, string>>({})

  const ringStates = useMemo((): RingState[] => {
    if (!game?.players) return []
    const list: RingState[] = []
    for (const p of game.players) {
      const items = Array.isArray(p.commandList)
        ? p.commandList
        : typeof p.commandList === 'object'
          ? Object.values(p.commandList ?? {})
          : []
      const ringItem = items.find((c: any) => {
        const n = String(c?.name ?? '').toLowerCase()
        return n === 'the ring' || n.startsWith('the ring')
      }) as { rules?: string[] } | undefined

      if (ringItem) {
        const rules = ringItem.rules ?? []
        const level = Math.min(4, Math.max(1, rules.length))
        list.push({
          level,
          bearerName: findRingBearer(p),
          player: p,
        })
      }
    }
    return list
  }, [game?.players])

  const dungeonStates = useMemo((): DungeonState[] => {
    if (!game?.players) return []
    const list: DungeonState[] = []
    for (const p of game.players) {
      const items = Array.isArray(p.commandList)
        ? p.commandList
        : typeof p.commandList === 'object'
          ? Object.values(p.commandList ?? {})
          : []
      const dungeonItem = items.find((c: any) => {
        const n = String(c?.name ?? '').toLowerCase()
        const types = Array.isArray(c?.cardTypes) ? c.cardTypes.map((t: string) => String(t).toLowerCase()) : []
        return types.includes('dungeon') || ['undercity', 'dungeon of the mad mage', 'lost mine of phandelver', 'tomb of annihilation'].some((k) => n.includes(k))
      }) as { name?: string; currentRoom?: string } | undefined

      if (dungeonItem?.name) {
        const graph = findDungeonGraph(dungeonItem.name)
        let visited: string[] = []
        if (graph) {
          const tracked = gameId ? progress[dungeonProgressKey(gameId, p.name, graph.id)] : undefined
          if (tracked && tracked.length > 0) {
            visited = tracked
          } else if (dungeonItem.currentRoom) {
            visited = pathToRoom(graph, dungeonItem.currentRoom) ?? [dungeonRoot(graph)]
          } else {
            visited = [dungeonRoot(graph)]
          }
        }
        list.push({ name: dungeonItem.name, player: p, graph, visited })
      }
    }
    return list
  }, [game?.players, gameId, progress])

  const dayNightState = useMemo((): DayNightState | null => {
    if (!game?.players) return null
    for (const p of game.players) {
      for (const d of p.designationNames ?? []) {
        const dl = d.toLowerCase()
        if (dl.includes('day') || dl.includes('night')) {
          return { isNight: dl.includes('night') && !dl.includes('neither') }
        }
      }
    }
    return null
  }, [game?.players])

  const monarchPlayer = game?.players?.find((p) => p.monarch)
  const initiativePlayer = game?.players?.find((p) => p.initiative)

  const cityBlessingPlayers = game?.players?.filter((p) =>
    p.designationNames?.some((d) => d.toLowerCase().includes('blessing'))
  ) ?? []

  const speedPlayers = game?.players?.filter((p) =>
    p.designationNames?.some((d) => d.toLowerCase().includes('speed'))
  ) ?? []

  useEffect(() => {
    const tokens = [
      { key: 'ring', name: 'The Ring' },
      { key: 'monarch', name: 'The Monarch' },
      { key: 'initiative', name: 'The Initiative' },
      { key: 'daynight', name: 'Day // Night' },
      { key: 'blessing', name: "City's Blessing" },
      { key: 'speed', name: 'Speed' },
    ]
    tokens.forEach((tkn) => {
      awaitImageUrl({ name: tkn.name, displayName: tkn.name, manaValue: 0 } as CardView).then((url) => {
        if (url) {
          setTokenImages((prev) => ({ ...prev, [tkn.key]: url }))
        }
      })
    })
  }, [])

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string; icon: IconName }> = []
    if (ringStates.length > 0) tabs.push({ id: 'ring', label: t('game', 'mechanics_ring_title'), icon: 'circle' })
    if (dungeonStates.length > 0) tabs.push({ id: 'dungeon', label: t('game', 'mechanics_dungeon_title'), icon: 'map' })
    if (dayNightState) tabs.push({ id: 'daynight', label: dayNightState.isNight ? t('game', 'mechanics_night') : t('game', 'mechanics_day'), icon: dayNightState.isNight ? 'moon' : 'sun' })
    if (monarchPlayer) tabs.push({ id: 'monarch', label: t('game', 'mechanics_monarch'), icon: 'crown' })
    if (initiativePlayer) tabs.push({ id: 'initiative', label: t('game', 'mechanics_initiative'), icon: 'zap' })
    if (cityBlessingPlayers.length > 0) tabs.push({ id: 'blessing', label: t('game', 'mechanics_blessing'), icon: 'landmark' })
    if (speedPlayers.length > 0) tabs.push({ id: 'speed', label: t('game', 'mechanics_speed_title'), icon: 'gauge' })
    return tabs
  }, [ringStates, dungeonStates, dayNightState, monarchPlayer, initiativePlayer, cityBlessingPlayers, speedPlayers, t])

  const effectiveTab =
    activeTab === 'auto' || !availableTabs.some((tab) => tab.id === activeTab)
      ? availableTabs[0]?.id ?? 'none'
      : activeTab

  const myRing = ringStates.find((r) => r.player.controlled) || ringStates[0]
  const orderedDungeons = [...dungeonStates].sort((a, b) =>
    (a.player.controlled ? 0 : 1) - (b.player.controlled ? 0 : 1),
  )

  if (availableTabs.length === 0) {
    return (
      <div className="mechanics-tray empty">
        <div className="mechanics-empty-box">
          <span className="empty-icon"><Icon name="scrollText" size={26} /></span>
          <h4>{t('game', 'mechanics_title')}</h4>
          <p>{t('game', 'mechanics_empty')}</p>
          <div className="mechanics-glossary-hint">
            <span>{t('game', 'mechanics_title')}:</span>
            <ul>
              <li><Icon name="circle" size={12} /> <strong>{t('game', 'mechanics_ring_title')}:</strong> {t('game', 'mechanics_ring_level', { level: 4 })}</li>
              <li><Icon name="map" size={12} /> <strong>{t('game', 'mechanics_dungeon_title')}:</strong> {t('game', 'mechanics_dungeon_active')}</li>
              <li><Icon name="sun" size={12} />/<Icon name="moon" size={12} /> <strong>{t('game', 'mechanics_day')} / {t('game', 'mechanics_night')}:</strong> {t('wiki', 'phases_priority')}</li>
              <li><Icon name="crown" size={12} /> <strong>{t('game', 'mechanics_monarch')} / {t('game', 'mechanics_initiative')}:</strong> {t('game', 'mechanics_monarch')}</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mechanics-tray">
      <div className="mechanics-nav-bar">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mechanic-tab-btn ${effectiveTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon"><Icon name={tab.icon} size={13} /></span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mechanics-content-scroll">
        {effectiveTab === 'ring' && myRing && (
          <div className="mechanic-panel panel-ring">
            <div className="mechanic-header-card">
              <div className="mechanic-title-row">
                <h3><Icon name="circle" size={15} /> {t('game', 'mechanics_ring_title')}</h3>
                <span className="ring-level-badge">{t('game', 'mechanics_ring_level', { level: myRing.level })}</span>
              </div>
              <div className="ring-bearer-row">
                <span className="bearer-label">{t('game', 'mechanics_ring_bearer')}</span>
                <span className="bearer-value">
                  {myRing.bearerName ? (<><Icon name="swords" size={12} /> {myRing.bearerName}</>) : t('game', 'no_target')}
                </span>
                <span className="player-tag">({myRing.player.name})</span>
              </div>
            </div>

            <div className="ring-levels-list">
              {getRingLevels(t).map((item) => {
                const isActive = item.level <= myRing.level
                const isCurrent = item.level === myRing.level
                return (
                  <div
                    key={item.level}
                    className={`ring-level-card ${isActive ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`}
                  >
                    <div className="level-header-row">
                      <div className="level-num-title">
                        <span className="level-num">{item.level}.</span>
                        <h4 className="level-title">{item.title}</h4>
                      </div>
                      <span className="level-status">{isActive ? (<><Icon name="check" size={11} /> {t('common', 'online')}</>) : (<><Icon name="lock" size={11} /> {t('common', 'offline')}</>)}</span>
                    </div>
                    <p className="level-rule">{item.rule}</p>
                  </div>
                )
              })}
            </div>

            {tokenImages.ring && (
              <div className="mechanic-token-preview">
                <img
                  src={tokenImages.ring}
                  alt="The Ring"
                  className="token-art-img"
                  onMouseEnter={(e) =>
                    onHoverCard?.(
                      { name: 'The Ring', displayName: 'The Ring // The Ring Tempts You', manaValue: 0 } as CardView,
                      e.currentTarget.getBoundingClientRect()
                    )
                  }
                  onMouseLeave={() => onHoverCard?.(null)}
                />
              </div>
            )}
          </div>
        )}

        {effectiveTab === 'dungeon' &&
          orderedDungeons.map((dungeon) =>
            dungeon.graph ? (
              <DungeonMap
                key={`${dungeon.player.playerId}-${dungeon.name}`}
                graph={dungeon.graph}
                dungeonName={dungeon.name}
                playerName={dungeon.player.name}
                visited={dungeon.visited}
              />
            ) : (
              <div key={`${dungeon.player.playerId}-${dungeon.name}`} className="mechanic-panel panel-dungeon">
                <div className="mechanic-header-card">
                  <div className="mechanic-title-row">
                    <h3><Icon name="map" size={15} /> {dungeon.name}</h3>
                    <span className="player-tag">({dungeon.player.name})</span>
                  </div>
                  <p className="dungeon-sub">{t('game', 'mechanics_dungeon_active')} {dungeon.name}</p>
                </div>

                <div className="dungeon-rooms-flow">
                  {getFallbackRooms(t).map((room, idx) => (
                    <div key={idx} className={`dungeon-room-node ${idx === 0 ? 'active-room' : ''}`}>
                      <span className="room-step">#{idx + 1}</span>
                      <span className="room-name">{room.label}</span>
                      {idx === 0 && <span className="current-marker"><Icon name="pin" size={11} /> {t('game', 'mechanics_dungeon_active')}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}

        {effectiveTab === 'daynight' && dayNightState && (
          <div className="mechanic-panel panel-daynight">
            <div className={`daynight-banner ${dayNightState.isNight ? 'night-active' : 'day-active'}`}>
              <span className="daynight-giant-icon"><Icon name={dayNightState.isNight ? 'moon' : 'sun'} size={30} /></span>
              <div className="daynight-giant-text">
                <h3>{dayNightState.isNight ? t('game', 'mechanics_night') : t('game', 'mechanics_day')}</h3>
                <span className="daynight-hint">
                  {dayNightState.isNight
                    ? t('wiki', 'phases_stack')
                    : t('wiki', 'phases_priority')}
                </span>
              </div>
            </div>

            <div className="daynight-rules-box">
              <h4><Icon name="refresh" size={13} /> {t('game', 'mechanics_title')}:</h4>
              <div className="rule-card">
                <span className="rule-badge"><Icon name="sun" size={11} /> → <Icon name="moon" size={11} /> {t('game', 'mechanics_night')}</span>
                <p>{t('wiki', 'phases_priority')}</p>
              </div>
              <div className="rule-card">
                <span className="rule-badge"><Icon name="moon" size={11} /> → <Icon name="sun" size={11} /> {t('game', 'mechanics_day')}</span>
                <p>{t('wiki', 'phases_stack')}</p>
              </div>
            </div>
          </div>
        )}

        {effectiveTab === 'monarch' && monarchPlayer && (
          <div className="mechanic-panel panel-monarch">
            <div className="mechanic-header-card monarch-header">
              <span className="crown-large"><Icon name="crown" size={26} /></span>
              <h3>{t('game', 'mechanics_monarch')}</h3>
              <p className="holder-row">
                {t('common', 'player')}: <strong>{monarchPlayer.name}</strong> {monarchPlayer.controlled ? `(${t('game', 'you')})` : ''}
              </p>
            </div>

            <div className="mechanic-rules-box">
              <div className="rule-item">
                <span className="rule-icon"><Icon name="layers" size={13} /></span>
                <div>
                  <strong>{t('game', 'monarch_hint')}</strong>
                  <p>{t('game', 'monarch_hint')}</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon"><Icon name="swords" size={13} /></span>
                <div>
                  <strong>{t('game', 'mechanics_monarch')}</strong>
                  <p>{t('game', 'monarch_hint')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {effectiveTab === 'initiative' && initiativePlayer && (
          <div className="mechanic-panel panel-initiative">
            <div className="mechanic-header-card initiative-header">
              <span className="crown-large"><Icon name="zap" size={26} /></span>
              <h3>{t('game', 'mechanics_initiative')}</h3>
              <p className="holder-row">
                {t('common', 'player')}: <strong>{initiativePlayer.name}</strong> {initiativePlayer.controlled ? `(${t('game', 'you')})` : ''}
              </p>
            </div>

            <div className="mechanic-rules-box">
              <div className="rule-item">
                <span className="rule-icon"><Icon name="castle" size={13} /></span>
                <div>
                  <strong>{t('game', 'dungeon_active')}</strong>
                  <p>{t('game', 'initiative_hint')}</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon"><Icon name="swords" size={13} /></span>
                <div>
                  <strong>{t('game', 'mechanics_initiative')}</strong>
                  <p>{t('game', 'initiative_hint')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {effectiveTab === 'blessing' && (
          <div className="mechanic-panel panel-blessing">
            <div className="mechanic-header-card">
              <h3><Icon name="landmark" size={15} /> {t('game', 'mechanics_blessing')}</h3>
              <p>{t('game', 'mechanics_blessing')}</p>
            </div>
            <div className="blessing-players-list">
              {cityBlessingPlayers.map((p) => (
                <div key={p.playerId} className="blessing-player-row">
                  <span><Icon name="star" size={12} /> {p.name} {p.controlled ? `(${t('game', 'you')})` : ''}</span>
                  <span className="badge-ascended">{t('game', 'blessing_ascend_ok')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {effectiveTab === 'speed' && (
          <div className="mechanic-panel panel-speed">
            <div className="mechanic-header-card">
              <h3><Icon name="gauge" size={15} /> {t('game', 'mechanics_speed_title')}</h3>
              <p>{t('game', 'mechanics_speed_title')}</p>
            </div>
            <div className="speed-players-list">
              {speedPlayers.map((p) => (
                <div key={p.playerId} className="speed-player-row">
                  <span><Icon name="gauge" size={12} /> {p.name} {p.controlled ? `(${t('game', 'you')})` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
