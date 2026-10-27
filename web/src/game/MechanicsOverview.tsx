import { Fragment, useMemo, type ReactNode } from 'react'
import type { PlayerView } from '../net/types'
import { useStore } from '../state/store'
import { useTranslation } from '../i18n'
import Icon, { type IconName } from '../ui/Icon'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import { dayNightStateOf } from '../board/dayNight'
import { roomLabel } from './dungeons'
import MechanicsGlossary from './MechanicsGlossary'
import {
  RING_MAX_LEVEL,
  SPEED_MAX,
  dungeonStateOf,
  hasCityBlessing,
  ringStateOf,
  speedOf,
  type DungeonState,
  type RingState,
} from './mechanicsState'
import './MechanicsOverview.css'

const RING_KEYS = [
  { title: 'ring_level_1_title', rule: 'ring_level_1_rule' },
  { title: 'ring_level_2_title', rule: 'ring_level_2_rule' },
  { title: 'ring_level_3_title', rule: 'ring_level_3_rule' },
  { title: 'ring_level_4_title', rule: 'ring_level_4_rule' },
] as const

interface Owner {
  player: PlayerView
  players: PlayerView[]
}

function ownerColor({ player, players }: Owner): string {
  return seatColorVar(seatIndexOf(players, player.playerId))
}

function OwnerChip(owner: Owner) {
  const color = ownerColor(owner)
  return (
    <span className="mech-owner" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      <span className="mech-owner-name">{owner.player.name}</span>
    </span>
  )
}

function MechHead({ icon, title, owner }: { icon: IconName; title: string; owner?: Owner }) {
  return (
    <header className="mech-head">
      <Icon name={icon} size={16} />
      <b className="mech-title">{title}</b>
      {owner && <OwnerChip {...owner} />}
    </header>
  )
}

function StepBar({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) {
  return (
    <span className="mech-steps" role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <i
          key={i}
          className={i < value ? 'mech-step on' : 'mech-step'}
          style={i < value && color ? { background: color } : undefined}
        />
      ))}
    </span>
  )
}

function RingSection({ ring, players }: { ring: RingState; players: PlayerView[] }) {
  const { t } = useTranslation()
  const levelText = t('game', 'mech_ring_status', { level: ring.level, max: RING_MAX_LEVEL })
  const owner = { player: ring.player, players }
  return (
    <section className="mech-card" data-testid="mech-ring">
      <MechHead icon="circle" title={t('game', 'mechanics_ring_title')} owner={owner} />
      <div className="mech-ring-meter">
        <StepBar value={ring.level} max={RING_MAX_LEVEL} label={levelText} />
        <span className="mech-ring-level-text">{levelText}</span>
      </div>
      <div className="mech-bearer">
        {ring.bearerName ? (
          <>
            <span>{t('game', 'mech_ring_bearer')}</span>
            <b>{ring.bearerName}</b>
          </>
        ) : (
          <em>{t('game', 'mech_ring_no_bearer')}</em>
        )}
      </div>
      <ol className="mech-abilities">
        {RING_KEYS.map((key, i) => {
          const level = i + 1
          const done = level <= ring.level
          const current = level === ring.level
          return (
            <li
              key={key.title}
              className={`mech-lvl${done ? ' done' : ' locked'}${current ? ' cur' : ''}`}
              data-testid="mech-ring-level"
            >
              <span className="mech-lvl-n">
                <Icon name={done ? 'check' : 'lock'} size={11} />
              </span>
              <span className="mech-lvl-body">
                <span className="mech-lvl-title">{t('game', key.title)}</span>
                <span className="mech-lvl-rule">{t('game', key.rule)}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function DungeonSection({ dungeon, players }: { dungeon: DungeonState; players: PlayerView[] }) {
  const { t } = useTranslation()
  const tt = t as unknown as (ns: string, key: string) => string
  const visited = new Set(dungeon.visited)
  const graph = dungeon.graph
  const currentRoom = graph?.depths.flat().find((r) => r.name === dungeon.current)
  return (
    <section className="mech-card" data-testid="mech-dungeon">
      <MechHead icon="map" title={dungeon.name} owner={{ player: dungeon.player, players }} />
      {graph && (
        <div className="mech-map">
          {graph.depths.map((rooms, i) => (
            <div key={i} className="mech-depth">
              <span className="mech-depth-n">{i + 1}</span>
              <div className="mech-depth-rooms">
                {rooms.map((room) => {
                  const state = room.name === dungeon.current ? 'cur' : visited.has(room.name) ? 'seen' : ''
                  return (
                    <span
                      key={room.name}
                      className={`mech-room ${state}`}
                      data-testid="mech-room"
                      data-state={state || 'ahead'}
                    >
                      {room.name}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {currentRoom && dungeon.depth != null && dungeon.depthCount != null && (
        <div className="mech-hint">
          <b className="mech-hint-room">{currentRoom.name}</b>
          {' · '}
          {t('game', 'mech_room_status', { room: dungeon.depth, total: dungeon.depthCount })}
          {' · '}
          {roomLabel(tt('game', currentRoom.labelKey), currentRoom)}
        </div>
      )}
    </section>
  )
}

function PlayerValue({ player, players }: Owner) {
  return (
    <span className="mech-tile-value" style={{ color: ownerColor({ player, players }) }}>
      {player.name}
    </span>
  )
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mech-tile">
      <span className="mech-tile-label">{label}</span>
      {children}
    </div>
  )
}

export default function MechanicsOverview() {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const gameId = useStore((s) => s.gameId)
  const progress = useStore((s) => s.dungeonProgress)
  const players = useMemo(() => game?.players ?? [], [game?.players])

  const rings = useMemo(() => players.map(ringStateOf).filter((r): r is RingState => r !== null), [players])
  const dungeons = useMemo(
    () => players.map((p) => dungeonStateOf(p, gameId, progress)).filter((d): d is DungeonState => d !== null),
    [players, gameId, progress],
  )
  const dayNight = useMemo(() => dayNightStateOf(game), [game])
  const monarch = players.find((p) => p.monarch)
  const initiative = players.find((p) => p.initiative)
  const blessed = players.filter(hasCityBlessing)
  const speeds = players
    .map((p) => ({ player: p, speed: speedOf(p) }))
    .filter((s): s is { player: PlayerView; speed: number } => s.speed != null)

  const hasTableState = !!dayNight || !!monarch || !!initiative || blessed.length > 0 || speeds.length > 0
  if (rings.length === 0 && dungeons.length === 0 && !hasTableState) {
    return (
      <div className="mech-overview">
        <MechanicsGlossary />
      </div>
    )
  }

  return (
    <div className="mech-overview" data-testid="mechanics-overview">
      {rings.map((ring) => (
        <RingSection key={ring.player.playerId} ring={ring} players={players} />
      ))}
      {dungeons.map((dungeon) => (
        <DungeonSection key={`${dungeon.player.playerId}-${dungeon.name}`} dungeon={dungeon} players={players} />
      ))}
      {hasTableState && (
        <section className="mech-card" data-testid="mech-table-state">
          <MechHead icon="layers" title={t('game', 'mech_table_state')} />
          <div className="mech-tiles">
            {dayNight && (
              <Tile label={t('game', 'mech_day_night')}>
                <span className="mech-tile-value">{dayNight.isNight ? t('game', 'mech_night') : t('game', 'mech_day')}</span>
              </Tile>
            )}
            {monarch && (
              <Tile label={t('game', 'chip_monarch')}>
                <PlayerValue player={monarch} players={players} />
              </Tile>
            )}
            {initiative && (
              <Tile label={t('game', 'chip_initiative')}>
                <PlayerValue player={initiative} players={players} />
              </Tile>
            )}
            {blessed.length > 0 && (
              <Tile label={t('game', 'mechanics_blessing')}>
                <span className="mech-tile-values">
                  {blessed.map((p, i) => (
                    <Fragment key={p.playerId}>
                      {i > 0 && ', '}
                      <PlayerValue player={p} players={players} />
                    </Fragment>
                  ))}
                </span>
              </Tile>
            )}
            {speeds.map(({ player, speed }) => (
              <Tile key={player.playerId} label={t('game', 'mech_speed_status', { speed, max: SPEED_MAX })}>
                <PlayerValue player={player} players={players} />
                <StepBar
                  value={speed}
                  max={SPEED_MAX}
                  label={t('game', 'mech_speed_status', { speed, max: SPEED_MAX })}
                  color={ownerColor({ player, players })}
                />
              </Tile>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
