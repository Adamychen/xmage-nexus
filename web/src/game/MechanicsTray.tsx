import { useEffect, useMemo, useState } from 'react'
import type { CardView, PermanentView, PlayerView } from '../net/types'
import { useStore } from '../state/store'
import { awaitImageUrl } from '../cards/cardImages'
import { useTranslation } from '../i18n'
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
  currentRoom?: string
  player: PlayerView
}

interface DayNightState {
  isNight: boolean
}

const RING_LEVELS = [
  {
    level: 1,
    title: 'Legendary Bearer & Evasion',
    rule: 'Your Ring-bearer is legendary and can\'t be blocked by creatures with greater power.',
  },
  {
    level: 2,
    title: 'Loot on Attack',
    rule: 'Whenever your Ring-bearer attacks, draw a card, then discard a card.',
  },
  {
    level: 3,
    title: 'Deathtouch to Blockers',
    rule: 'Whenever your Ring-bearer becomes blocked by a creature, that creature\'s controller sacrifices it at end of combat.',
  },
  {
    level: 4,
    title: 'Drain 3 Life',
    rule: 'Whenever your Ring-bearer deals combat damage to a player, each opponent loses 3 life.',
  },
]

const DUNGEON_ROOMS: Record<string, string[]> = {
  undercity: [
    'Secret Entrance (Search basic land to hand)',
    'Forge (+2 +1/+1 counters) / Lost Well (Scry 2)',
    'Trap! (Opponent loses 5 life) / Arena (Goad creature)',
    'Stash (Draw 1 card) / Archives (Exile 2 playable cards)',
    'Throne of the Dead Three (Free creature + 3 counters + hexproof)',
  ],
  'dungeon of the mad mage': [
    'Yawning Portal (Gain 1 life)',
    'Dungeon Level (Scry 1)',
    'Goblin Bazaar (Create Treasure token)',
    'Twisted Caverns (Creature can\'t attack)',
    'Lost Level (Scry 2)',
    'Runestone Caverns (Exile 2 cards to play)',
    'Mad Wizard’s Lair (Draw 3 cards and cast 1 for free)',
  ],
  'lost mine of phandelver': [
    'Cave Entrance (Scry 1)',
    'Goblin Lair (1/1 Goblin token) / Mine Tunnels (Treasure)',
    'Storeroom (+1/+1) / Dark Pool (Drain 1 life)',
    'Temple of Dumathoin (Draw 1 card)',
  ],
  'tomb of annihilation': [
    'Trapped Entry (Each player loses 1 life)',
    'Veils of Fear (Lose 2 life or discard)',
    'Sandfall Cell (Lose 2 life or sacrifice permanent)',
    'Cradle of the Death God (Create The Atropal 4/4 deathtouch)',
  ],
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
        return types.includes('dungeon') || Object.keys(DUNGEON_ROOMS).some((k) => n.includes(k))
      }) as { name?: string; currentRoom?: string } | undefined

      if (dungeonItem?.name) {
        list.push({
          name: dungeonItem.name,
          currentRoom: dungeonItem.currentRoom,
          player: p,
        })
      }
    }
    return list
  }, [game?.players])

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
    const tabs: Array<{ id: string; label: string; icon: string }> = []
    if (ringStates.length > 0) tabs.push({ id: 'ring', label: t('game', 'mechanics_ring_title'), icon: '💍' })
    if (dungeonStates.length > 0) tabs.push({ id: 'dungeon', label: t('game', 'mechanics_dungeon_title'), icon: '🗺️' })
    if (dayNightState) tabs.push({ id: 'daynight', label: dayNightState.isNight ? t('game', 'mechanics_night') : t('game', 'mechanics_day'), icon: dayNightState.isNight ? '🌙' : '☀️' })
    if (monarchPlayer) tabs.push({ id: 'monarch', label: t('game', 'mechanics_monarch'), icon: '👑' })
    if (initiativePlayer) tabs.push({ id: 'initiative', label: t('game', 'mechanics_initiative'), icon: '⚔️' })
    if (cityBlessingPlayers.length > 0) tabs.push({ id: 'blessing', label: t('game', 'mechanics_blessing'), icon: '🏛️' })
    if (speedPlayers.length > 0) tabs.push({ id: 'speed', label: t('game', 'mechanics_speed_title'), icon: '🏎️' })
    return tabs
  }, [ringStates, dungeonStates, dayNightState, monarchPlayer, initiativePlayer, cityBlessingPlayers, speedPlayers, t])

  const effectiveTab =
    activeTab === 'auto' || !availableTabs.some((tab) => tab.id === activeTab)
      ? availableTabs[0]?.id ?? 'none'
      : activeTab

  const myRing = ringStates.find((r) => r.player.controlled) || ringStates[0]
  const myDungeon = dungeonStates.find((d) => d.player.controlled) || dungeonStates[0]

  if (availableTabs.length === 0) {
    return (
      <div className="mechanics-tray empty">
        <div className="mechanics-empty-box">
          <span className="empty-icon">📜</span>
          <h4>{t('game', 'mechanics_title')}</h4>
          <p>{t('game', 'mechanics_empty')}</p>
          <div className="mechanics-glossary-hint">
            <span>{t('game', 'mechanics_title')}:</span>
            <ul>
              <li>💍 <strong>{t('game', 'mechanics_ring_title')}:</strong> {t('game', 'mechanics_ring_level', { level: 4 })}</li>
              <li>🗺️ <strong>{t('game', 'mechanics_dungeon_title')}:</strong> {t('game', 'mechanics_dungeon_active')}</li>
              <li>☀️/🌙 <strong>{t('game', 'mechanics_day')} / {t('game', 'mechanics_night')}:</strong> {t('wiki', 'phases_priority')}</li>
              <li>👑 <strong>{t('game', 'mechanics_monarch')} / {t('game', 'mechanics_initiative')}:</strong> {t('game', 'mechanics_monarch')}</li>
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
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mechanics-content-scroll">
        {effectiveTab === 'ring' && myRing && (
          <div className="mechanic-panel panel-ring">
            <div className="mechanic-header-card">
              <div className="mechanic-title-row">
                <h3>💍 {t('game', 'mechanics_ring_title')}</h3>
                <span className="ring-level-badge">{t('game', 'mechanics_ring_level', { level: myRing.level })}</span>
              </div>
              <div className="ring-bearer-row">
                <span className="bearer-label">{t('game', 'mechanics_ring_bearer')}</span>
                <span className="bearer-value">
                  {myRing.bearerName ? `⚔️ ${myRing.bearerName}` : t('game', 'no_target')}
                </span>
                <span className="player-tag">({myRing.player.name})</span>
              </div>
            </div>

            <div className="ring-levels-list">
              {RING_LEVELS.map((item) => {
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
                      <span className="level-status">{isActive ? `✓ ${t('common', 'online')}` : `🔒 ${t('common', 'offline')}`}</span>
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

        {effectiveTab === 'dungeon' && myDungeon && (
          <div className="mechanic-panel panel-dungeon">
            <div className="mechanic-header-card">
              <div className="mechanic-title-row">
                <h3>🗺️ {myDungeon.name}</h3>
                <span className="player-tag">({myDungeon.player.name})</span>
              </div>
              <p className="dungeon-sub">{t('game', 'mechanics_dungeon_active')} {myDungeon.name}</p>
            </div>

            <div className="dungeon-rooms-flow">
              {(DUNGEON_ROOMS[myDungeon.name.toLowerCase()] ?? [
                'Entrance Hall',
                'Intermediate Gallery',
                'Final Treasure Chamber',
              ]).map((room, idx) => {
                const isCurrentRoom = myDungeon.currentRoom
                  ? room.toLowerCase().includes(myDungeon.currentRoom.toLowerCase())
                  : idx === 0
                return (
                  <div
                    key={idx}
                    className={`dungeon-room-node ${isCurrentRoom ? 'active-room' : ''}`}
                  >
                    <span className="room-step">#{idx + 1}</span>
                    <span className="room-name">{room}</span>
                    {isCurrentRoom && <span className="current-marker">📍 {t('game', 'mechanics_dungeon_active')}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {effectiveTab === 'daynight' && dayNightState && (
          <div className="mechanic-panel panel-daynight">
            <div className={`daynight-banner ${dayNightState.isNight ? 'night-active' : 'day-active'}`}>
              <span className="daynight-giant-icon">{dayNightState.isNight ? '🌙' : '☀️'}</span>
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
              <h4>🔄 {t('game', 'mechanics_title')}:</h4>
              <div className="rule-card">
                <span className="rule-badge">☀️ → 🌙 {t('game', 'mechanics_night')}</span>
                <p>{t('wiki', 'phases_priority')}</p>
              </div>
              <div className="rule-card">
                <span className="rule-badge">🌙 → ☀️ {t('game', 'mechanics_day')}</span>
                <p>{t('wiki', 'phases_stack')}</p>
              </div>
            </div>
          </div>
        )}

        {effectiveTab === 'monarch' && monarchPlayer && (
          <div className="mechanic-panel panel-monarch">
            <div className="mechanic-header-card monarch-header">
              <span className="crown-large">👑</span>
              <h3>{t('game', 'mechanics_monarch')}</h3>
              <p className="holder-row">
                {t('common', 'player')}: <strong>{monarchPlayer.name}</strong> {monarchPlayer.controlled ? `(${t('game', 'you')})` : ''}
              </p>
            </div>

            <div className="mechanic-rules-box">
              <div className="rule-item">
                <span className="rule-icon">🃏</span>
                <div>
                  <strong>{t('game', 'monarch_hint')}</strong>
                  <p>{t('game', 'monarch_hint')}</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon">⚔️</span>
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
              <span className="crown-large">⚔️</span>
              <h3>{t('game', 'mechanics_initiative')}</h3>
              <p className="holder-row">
                {t('common', 'player')}: <strong>{initiativePlayer.name}</strong> {initiativePlayer.controlled ? `(${t('game', 'you')})` : ''}
              </p>
            </div>

            <div className="mechanic-rules-box">
              <div className="rule-item">
                <span className="rule-icon">🏰</span>
                <div>
                  <strong>{t('game', 'dungeon_active')}</strong>
                  <p>{t('game', 'initiative_hint')}</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon">⚔️</span>
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
              <h3>🏛️ {t('game', 'mechanics_blessing')}</h3>
              <p>{t('game', 'mechanics_blessing')}</p>
            </div>
            <div className="blessing-players-list">
              {cityBlessingPlayers.map((p) => (
                <div key={p.playerId} className="blessing-player-row">
                  <span>★ {p.name} {p.controlled ? `(${t('game', 'you')})` : ''}</span>
                  <span className="badge-ascended">Ascend OK</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {effectiveTab === 'speed' && (
          <div className="mechanic-panel panel-speed">
            <div className="mechanic-header-card">
              <h3>🏎️ {t('game', 'mechanics_speed_title')}</h3>
              <p>{t('game', 'mechanics_speed_title')}</p>
            </div>
            <div className="speed-players-list">
              {speedPlayers.map((p) => (
                <div key={p.playerId} className="speed-player-row">
                  <span>🏎️ {p.name} {p.controlled ? `(${t('game', 'you')})` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
