import { Fragment, useMemo } from 'react'
import type { PlayerView } from '../net/types'
import { useStore } from '../state/store'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import { dayNightStateOf } from '../board/dayNight'
import { roomLabel } from './dungeons'
import MechanicsTray from './MechanicsTray'
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

const RING_RULES = ['ring_level_1_rule', 'ring_level_2_rule', 'ring_level_3_rule', 'ring_level_4_rule'] as const

function SeatName({ player, players }: { player: PlayerView; players: PlayerView[] }) {
  return <b style={{ color: seatColorVar(seatIndexOf(players, player.playerId)) }}>{player.name}</b>
}

function RingSection({ ring }: { ring: RingState }) {
  const { t } = useTranslation()
  return (
    <section className="mech-sec" data-testid="mech-ring">
      <header className="mech-head">
        <Icon name="circle" size={16} />
        <b>{t('game', 'mechanics_ring_title')}</b>
        <span>{t('game', 'mech_ring_status', { player: ring.player.name, level: ring.level, max: RING_MAX_LEVEL })}</span>
      </header>
      <div className="mech-bearer">
        {ring.bearerName ? (
          <>
            {t('game', 'mech_ring_bearer')} <b>{ring.bearerName}</b>
          </>
        ) : (
          t('game', 'mech_ring_no_bearer')
        )}
      </div>
      {RING_RULES.map((key, i) => {
        const level = i + 1
        const done = level <= ring.level
        return (
          <div
            key={key}
            className={`mech-lvl${done ? ' done' : ''}${level === ring.level ? ' cur' : ''}`}
            data-testid="mech-ring-level"
          >
            <span className="mech-lvl-n">{done ? <Icon name="check" size={11} /> : level}</span>
            <span>{t('game', key)}</span>
          </div>
        )
      })}
    </section>
  )
}

function DungeonSection({ dungeon }: { dungeon: DungeonState }) {
  const { t } = useTranslation()
  const tt = t as unknown as (ns: string, key: string) => string
  const visited = new Set(dungeon.visited)
  const graph = dungeon.graph
  const currentRoom = graph?.depths.flat().find((r) => r.name === dungeon.current)
  return (
    <section className="mech-sec" data-testid="mech-dungeon">
      <header className="mech-head">
        <Icon name="map" size={16} />
        <b>{dungeon.name}</b>
        {dungeon.depth != null && dungeon.depthCount != null && (
          <span>{t('game', 'mech_room_status', { player: dungeon.player.name, room: dungeon.depth, total: dungeon.depthCount })}</span>
        )}
      </header>
      {graph && (
        <div className="mech-dungeon">
          {graph.depths.map((rooms, i) => (
            <div key={i} className="mech-dungeon-row">
              {rooms.map((room) => {
                const state = room.name === dungeon.current ? 'cur' : visited.has(room.name) ? 'seen' : ''
                return (
                  <span key={room.name} className={`mech-room ${state}`} data-testid="mech-room" data-state={state || 'ahead'}>
                    {room.name}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      )}
      {currentRoom && <div className="mech-hint">{roomLabel(tt('game', currentRoom.labelKey), currentRoom)}</div>}
    </section>
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
  const speeds = players.map((p) => ({ player: p, speed: speedOf(p) })).filter((s): s is { player: PlayerView; speed: number } => s.speed != null)

  const hasTableState = !!dayNight || !!monarch || !!initiative || blessed.length > 0 || speeds.length > 0
  if (rings.length === 0 && dungeons.length === 0 && !hasTableState) return <MechanicsTray />

  return (
    <div className="mech-overview" data-testid="mechanics-overview">
      {rings.map((ring) => (
        <RingSection key={ring.player.playerId} ring={ring} />
      ))}
      {dungeons.map((dungeon) => (
        <DungeonSection key={`${dungeon.player.playerId}-${dungeon.name}`} dungeon={dungeon} />
      ))}
      {hasTableState && (
        <section className="mech-sec" data-testid="mech-table-state">
          <header className="mech-head">
            <Icon name="sun" size={16} />
            <b>{t('game', 'mech_table_state')}</b>
          </header>
          <dl className="mech-kv">
            {dayNight && (
              <>
                <dt>{t('game', 'mech_day_night')}</dt>
                <dd>{dayNight.isNight ? t('game', 'mech_night') : t('game', 'mech_day')}</dd>
              </>
            )}
            {monarch && (
              <>
                <dt>{t('game', 'chip_monarch')}</dt>
                <dd><SeatName player={monarch} players={players} /></dd>
              </>
            )}
            {initiative && (
              <>
                <dt>{t('game', 'chip_initiative')}</dt>
                <dd><SeatName player={initiative} players={players} /></dd>
              </>
            )}
            {blessed.length > 0 && (
              <>
                <dt>{t('game', 'mechanics_blessing')}</dt>
                <dd>
                  {blessed.map((p, i) => (
                    <span key={p.playerId}>
                      {i > 0 && ', '}
                      <SeatName player={p} players={players} />
                    </span>
                  ))}
                </dd>
              </>
            )}
            {speeds.map(({ player, speed }) => (
              <Fragment key={player.playerId}>
                <dt>{t('game', 'mechanics_speed_title')}</dt>
                <dd style={{ color: seatColorVar(seatIndexOf(players, player.playerId)) }}>
                  {player.name} · {speed} / {SPEED_MAX}
                </dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}
