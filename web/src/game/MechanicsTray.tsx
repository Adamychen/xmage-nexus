import Tabs from '../ui/Tabs'
import EmptyState from '../ui/EmptyState'
import { useEffect, useMemo, useState } from 'react'
import type { CardView } from '../net/types'
import { useStore } from '../state/store'
import { awaitImageUrl } from '../cards/cardImages'
import { useTranslation } from '../i18n'
import type { CategoryT } from '../i18n/types'
import Icon, { type IconName } from '../ui/Icon'
import DungeonMap from './DungeonMap'
import { dungeonStateOf, findRingBearer, ringStateOf, type DungeonState, type RingState } from './mechanicsState'
import { dayNightStateOf, type DayNightState } from '../board/dayNight'
import { speedLevelKey } from './speed'
import './MechanicsTray.css'

interface MechanicsTrayProps {
  onHoverCard?: (card: CardView | null, rect?: DOMRect) => void
}

function getRingLevels(t: CategoryT<'game'>) {
  return [
    { level: 1, title: t('game', 'ring_level_1_title'), rule: t('game', 'ring_level_1_rule') },
    { level: 2, title: t('game', 'ring_level_2_title'), rule: t('game', 'ring_level_2_rule') },
    { level: 3, title: t('game', 'ring_level_3_title'), rule: t('game', 'ring_level_3_rule') },
    { level: 4, title: t('game', 'ring_level_4_title'), rule: t('game', 'ring_level_4_rule') },
  ]
}

type DungeonRoomDef = { keys: string[]; label: string }

function getFallbackRooms(t: CategoryT<'game'>): DungeonRoomDef[] {
  return [
    { keys: [], label: t('game', 'dungeon_fallback_1') },
    { keys: [], label: t('game', 'dungeon_fallback_2') },
    { keys: [], label: t('game', 'dungeon_fallback_3') },
  ]
}

export { findRingBearer }

export default function MechanicsTray({ onHoverCard }: MechanicsTrayProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const gameId = useStore((s) => s.gameId)
  const progress = useStore((s) => s.dungeonProgress)
  const speedLevels = useStore((s) => s.speedLevels)
  const [activeTab, setActiveTab] = useState<string>('auto')
  const [tokenImages, setTokenImages] = useState<Record<string, string>>({})

  const ringStates = useMemo(
    (): RingState[] => (game?.players ?? []).map(ringStateOf).filter((r): r is RingState => r !== null),
    [game?.players],
  )

  const dungeonStates = useMemo(
    (): DungeonState[] =>
      (game?.players ?? []).map((p) => dungeonStateOf(p, gameId, progress)).filter((d): d is DungeonState => d !== null),
    [game?.players, gameId, progress],
  )

  const dayNightState = useMemo((): DayNightState | null => dayNightStateOf(game), [game])

  const monarchPlayer = game?.players?.find((p) => p.monarch)
  const initiativePlayer = game?.players?.find((p) => p.initiative)

  const cityBlessingPlayers = game?.players?.filter((p) =>
    p.designationNames?.some((d) => d.toLowerCase().includes('blessing'))
  ) ?? []

  const speedPlayers = game?.players?.filter((p) =>
    p.designationNames?.some((d) => d.toLowerCase().includes('speed'))
  ) ?? []

  useEffect(() => {
    let cancelled = false
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
        if (!cancelled && url) {
          setTokenImages((prev) => ({ ...prev, [tkn.key]: url }))
        }
      })
    })
    return () => {
      cancelled = true
    }
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
        <EmptyState
          boxed
          icon="scrollText"
          iconSize={26}
          title={t('game', 'mechanics_title')}
          action={
            <div className="mechanics-glossary-hint">
              <span>{t('game', 'mechanics_title')}:</span>
              <ul>
                <li><Icon name="circle" size={12} /> <strong>{t('game', 'mechanics_ring_title')}:</strong> {t('game', 'mechanics_ring_level', { level: 4 })}</li>
                <li><Icon name="map" size={12} /> <strong>{t('game', 'mechanics_dungeon_title')}:</strong> {t('game', 'mechanics_dungeon_active')}</li>
                <li><Icon name="sun" size={12} />/<Icon name="moon" size={12} /> <strong>{t('game', 'mechanics_day')} / {t('game', 'mechanics_night')}:</strong> {t('wiki', 'phases_priority')}</li>
                <li><Icon name="crown" size={12} /> <strong>{t('game', 'mechanics_monarch')} / {t('game', 'mechanics_initiative')}:</strong> {t('game', 'mechanics_monarch')}</li>
              </ul>
            </div>
          }
        >
          {t('game', 'mechanics_empty')}
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mechanics-tray">
      <Tabs
        size="sm"
        className="mechanics-nav-bar"
        value={effectiveTab}
        onChange={setActiveTab}
        items={availableTabs.map((tab) => ({ id: tab.id, icon: tab.icon, label: tab.label, className: 'mechanic-tab-btn' }))}
      />

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
                <span className="daynight-hint">{dayNightState.hint}</span>
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
              {speedPlayers.map((p) => {
                const level = gameId ? speedLevels[speedLevelKey(gameId, p.name)] : undefined
                return (
                  <div key={p.playerId} className="speed-player-row">
                    <span><Icon name="gauge" size={12} /> {p.name} {p.controlled ? `(${t('game', 'you')})` : ''}</span>
                    {level != null && <span className="badge-speed-level">{t('game', 'mechanics_speed_title')} {level}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
