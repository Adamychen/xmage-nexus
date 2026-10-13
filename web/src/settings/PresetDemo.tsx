import { showcaseArtUrl } from '../cards/showcaseArt'
import type { GameplayPresetId } from './gameplayPresets'
import { PRESET_DEMO_SCENES } from './presetScenes'
import { PHASES } from '../game/phaseStops'
import '../appearance/playmats.css'
import './PresetDemo.css'

interface Props {
  preset: GameplayPresetId
}

/**
 * Decorative live-demo of a gameplay preset: a miniature table (playmat
 * backdrop + real card art from `public/showcase` + mana orbs + phase stops)
 * that shows — without words — how the preset plays. Purely visual:
 * aria-hidden, no state, no clicks (the parent card owns the interaction).
 * Cards without showcase art degrade to blank tiles, so the demo still paints
 * offline and in jsdom.
 */
export default function PresetDemo({ preset }: Props) {
  const scene = PRESET_DEMO_SCENES[preset]
  return (
    <span className="preset-demo" data-mode={scene.mode} data-testid={`preset-demo-${preset}`} aria-hidden="true">
      <span className="playmat-layer preset-demo-mat" data-playmat={scene.mat} />
      <span className="preset-demo-orb">
        <span className="preset-orb is-spent" />
        <span className="preset-orb is-spent" />
        <span className="preset-orb" />
      </span>
      <span className="preset-demo-row">
        {scene.cards.map((card, i) => {
          const art = showcaseArtUrl(card.name)
          return (
            <span key={`${card.name}-${i}`} className={`preset-tile is-${card.kind}`} data-testid="preset-tile">
              {art ? (
                <img className="preset-tile-art" src={art} alt="" draggable={false} />
              ) : (
                <span className="preset-tile-blank" />
              )}
            </span>
          )
        })}
      </span>
      <span className="preset-demo-phases">
        {PHASES.map((p) => (
          <span
            key={p.key}
            className="preset-phase"
            data-stop={scene.stopKeys.includes(p.key) ? (scene.mode === 'stops' ? 'smart' : 'solid') : 'none'}
          >
            {p.short}
          </span>
        ))}
      </span>
    </span>
  )
}
