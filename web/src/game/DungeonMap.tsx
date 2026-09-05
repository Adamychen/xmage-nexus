import type { DungeonGraph } from './dungeons'
import { nextRooms, roomLabel } from './dungeons'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'

interface DungeonMapProps {
  graph: DungeonGraph
  dungeonName: string
  playerName: string
  /** Canonical room names in visit order; last entry is the current room. */
  visited: string[]
}

export default function DungeonMap({ graph, dungeonName, playerName, visited }: DungeonMapProps) {
  const { t } = useTranslation()
  const tt = t as unknown as (ns: string, key: string) => string
  const visitedSet = new Set(visited)
  const current = visited[visited.length - 1]

  return (
    <div className="mechanic-panel panel-dungeon">
      <div className="mechanic-header-card">
        <div className="mechanic-title-row">
          <h3><Icon name="map" size={15} /> {dungeonName}</h3>
          <span className="player-tag">({playerName})</span>
        </div>
        <p className="dungeon-sub">{t('game', 'mechanics_dungeon_active')} {dungeonName}</p>
      </div>

      <div className="dungeon-rooms-flow">
        {graph.depths.map((depth, depthIdx) => (
          <div key={depthIdx} className="dungeon-depth-group">
            {depthIdx > 0 && (
              <div className="dungeon-depth-link" aria-hidden="true">
                <span className="dungeon-fork-glyph">{depth.length > 1 ? '⑂' : '▼'}</span>
              </div>
            )}
            <div className={`dungeon-depth-row ${depth.length > 1 ? 'is-fork' : ''}`}>
              {depth.map((room) => {
                const isCurrent = room.name === current
                const isVisited = visitedSet.has(room.name)
                const leads = nextRooms(graph, room.name)
                return (
                  <div
                    key={room.name}
                    className={`dungeon-room-node ${isCurrent ? 'active-room' : ''} ${isVisited && !isCurrent ? 'visited-room' : ''}`}
                  >
                    <span className="room-name">{roomLabel(tt('game', room.labelKey), room)}</span>
                    {leads.length > 0 && (
                      <span className="dungeon-leads">
                        → {leads.join(' / ')}
                      </span>
                    )}
                    {isCurrent && <span className="current-marker"><Icon name="pin" size={11} /> {tt('game', 'mechanics_dungeon_active')}</span>}
                    {isVisited && !isCurrent && <span className="visited-marker">✓</span>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
