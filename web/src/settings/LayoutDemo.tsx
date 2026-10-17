import { showcaseArtUrl } from '../cards/showcaseArt'
import '../appearance/playmats.css'
import './LayoutDemo.css'

export type LayoutDemoId = 'standard' | 'pod' | 'arena' | 'table'

interface Zone {
  mine?: boolean
  tiles: string[]
}

const RIVAL_A = ['Swamp', 'Sentinel Spider', 'Tarmogoyf']
const RIVAL_B = ['Island', 'Counterspell', 'Birds of Paradise']
const RIVAL_C = ['Plains', 'Sol Ring']
const MINE = ['Mountain', 'Forest', 'Shivan Dragon', 'Lightning Bolt', 'Giant Growth']

const ZONES: Record<LayoutDemoId, Zone[]> = {
  standard: [{ tiles: RIVAL_A }, { mine: true, tiles: MINE }],
  pod: [{ tiles: RIVAL_A }, { tiles: RIVAL_B }, { tiles: RIVAL_C }, { mine: true, tiles: MINE.slice(0, 4) }],
  arena: [{ tiles: RIVAL_A }, { tiles: RIVAL_B }, { tiles: RIVAL_C }, { mine: true, tiles: MINE }],
  table: [{ tiles: RIVAL_A }, { tiles: RIVAL_B }, { tiles: RIVAL_C }, { mine: true, tiles: MINE.slice(0, 3) }],
}

/**
 * Decorative miniature of a board layout (Settings → Board): where the rivals
 * sit and how much room your own field gets. Purely visual: aria-hidden, no
 * state, no clicks (the parent card owns the interaction). Tiles use the local
 * showcase art, so it paints offline like the other picker demos.
 */
export default function LayoutDemo({ layout }: { layout: LayoutDemoId }) {
  return (
    <span className="layout-demo" data-layout={layout} data-testid={`layout-demo-${layout}`} aria-hidden="true">
      <span className="playmat-layer layout-demo-mat" data-playmat="abyss" />
      <span className="layout-demo-zones">
        {ZONES[layout].map((zone, i) => (
          <span key={i} className={`layout-demo-zone${zone.mine ? ' is-mine' : ''}`} data-testid="layout-demo-zone">
            {zone.tiles.map((name) => {
              const art = showcaseArtUrl(name)
              return art ? (
                <img key={name} className="layout-demo-tile" src={art} alt="" draggable={false} />
              ) : (
                <span key={name} className="layout-demo-tile is-blank" />
              )
            })}
          </span>
        ))}
      </span>
      {layout === 'standard' && (
        <span className="layout-demo-pills">
          <span className="layout-demo-pill is-on" />
          <span className="layout-demo-pill" />
          <span className="layout-demo-pill" />
        </span>
      )}
    </span>
  )
}
