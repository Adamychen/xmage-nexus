function hintTip(hint: string | undefined, fallback: string) {
  const lines = (hint ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { title: fallback }
  return { title: lines[0], body: lines.slice(1).join(' ') || undefined }
}

function abbrev(hint: string): string {
  const words = hint.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

import { useState } from 'react'
import { t as tStatic } from '../i18n'
import BadgeTip from '../ui/BadgeTip'
import Icon from '../ui/Icon'
import { iconKeywordId } from './cardBadges'
import { gainedIconKeys, iconKey, isGoadIcon, type CardIconLike as CardIcon } from './cardIconFx'

/**
 * Renders the restriction / ability icons the server sends on each card
 * (`cardIcons`). Goad and all combat restrictions (must/can't attack/block/untap/
 * transform) arrive as `OTHER_HAS_RESTRICTIONS` with the human text in `hint`;
 * ability icons (Reach, Trample, …) carry their name in `hint`. This is the
 * client-side piece that actually surfaces goad — the engine state reaches us
 * through the view's restriction icon, not a dedicated field.
 */
export default function CardIcons({ icons }: { icons?: CardIcon[] }) {
  const [seen, setSeen] = useState<CardIcon[] | undefined>(icons)
  const [gained, setGained] = useState<string[]>([])
  if (seen !== icons) {
    const keys = (icons ?? []).map(iconKey)
    setSeen(icons)
    setGained([...gained.filter((key) => keys.includes(key)), ...gainedIconKeys(seen, icons)])
  }
  if (!icons || icons.length === 0) return null
  const restrictions = icons.filter((i) => i.cardIconType === 'OTHER_HAS_RESTRICTIONS')
  const others = icons.filter((i) => i.cardIconType !== 'OTHER_HAS_RESTRICTIONS' && !iconKeywordId(i))
  if (restrictions.length === 0 && others.length === 0) return null

  return (
    <div className="card-icons" data-badge-zone="icons">
      {restrictions.map((r, i) => (
        <BadgeTip
          key={`r${i}`}
          className={`card-icon restriction${gained.includes(iconKey(r)) ? (isGoadIcon(r) ? ' icon-gained icon-gained--goad' : ' icon-gained') : ''}`}
          tip={hintTip(r.hint, tStatic('board', 'restriction_fallback'))}
        >
          {r.text || <Icon name="alert" size={11} />}
        </BadgeTip>
      ))}
      {others.map((o, i) => (
        <BadgeTip
          key={`a${i}`}
          className={`card-icon ability${gained.includes(iconKey(o)) ? ' icon-gained' : ''}`}
          tip={hintTip(o.hint, o.text || tStatic('board', 'restriction_fallback'))}
        >
          {o.text || abbrev(o.hint ?? '')}
        </BadgeTip>
      ))}
    </div>
  )
}
