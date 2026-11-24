import type { ReactNode } from 'react'
import type { LadderGlyph } from './ladderSteps'

const TINT = { fill: 'currentColor', fillOpacity: 0.28 } as const
const SOLID = { fill: 'currentColor', stroke: 'none' } as const

const GLYPHS: Record<LadderGlyph, ReactNode> = {
  upkeep: (
    <>
      <path d="M6.5 18a5.5 5.5 0 0 1 11 0z" {...TINT} />
      <path d="M2.5 18h19" />
      <path d="M12 4.5v3M4.9 8.4l2.1 2.1M19.1 8.4L17 10.5M2.5 14.5h2M19.5 14.5h2" />
      <path d="M7 21h10" opacity="0.55" />
    </>
  ),
  draw: (
    <>
      <rect x="3.5" y="8" width="11" height="14" rx="2" transform="rotate(-9 9 15)" opacity="0.6" {...TINT} />
      <rect x="9.5" y="2.5" width="11" height="14" rx="2" {...TINT} />
      <path d="M15 12.5V6.5M12.6 8.9L15 6.5l2.4 2.4" />
    </>
  ),
  main1: (
    <>
      <path d="M7 3.5h10l4.5 5.5L12 21.5 2.5 9z" {...TINT} />
      <path d="M7 3.5h10l4.5 5.5L12 21.5 2.5 9z" />
      <path d="M2.5 9h19" strokeWidth="1.2" opacity="0.55" />
      <path d="M12 7v8M10.4 7h3.2M10.4 15h3.2" strokeWidth="1.75" />
    </>
  ),
  main2: (
    <>
      <path d="M7 3.5h10l4.5 5.5L12 21.5 2.5 9z" {...TINT} />
      <path d="M7 3.5h10l4.5 5.5L12 21.5 2.5 9z" />
      <path d="M2.5 9h19" strokeWidth="1.2" opacity="0.55" />
      <path d="M10.2 7v8M13.8 7v8M8.8 7h6.4M8.8 15h6.4" strokeWidth="1.65" />
    </>
  ),
  combat: (
    <>
      <path d="M3 3l3.6.4 9.2 9.2-3.2 3.2-9.2-9.2z" {...TINT} />
      <path d="M21 3l-3.6.4-9.2 9.2 3.2 3.2 9.2-9.2z" {...TINT} />
      <path d="M3 3l3.6.4 9.2 9.2M21 3l-3.6.4-9.2 9.2" />
      <path d="M11.2 17.2l5.6-5.6M12.8 17.2l-5.6-5.6M15.2 15.2l3.6 3.6M8.8 15.2l-3.6 3.6" />
      <circle cx="19.6" cy="19.6" r="1.3" {...SOLID} />
      <circle cx="4.4" cy="19.6" r="1.3" {...SOLID} />
    </>
  ),
  beginCombat: (
    <>
      <path d="M5.5 4h12.5l-3 4.2 3 4.3H5.5z" {...TINT} />
      <path d="M5.5 4h12.5l-3 4.2 3 4.3H5.5" />
      <path d="M5.5 2.5v19" />
      <path d="M3 21.5h5" />
    </>
  ),
  attackers: (
    <>
      <path d="M21 3l-.6 3.8-9.4 9.4-3.2-3.2 9.4-9.4z" {...TINT} />
      <path d="M21 3l-.6 3.8-9.4 9.4M21 3l-3.8.6-9.4 9.4" />
      <path d="M6.2 11.8l6 6M9.2 14.8l-4.6 4.6" />
      <circle cx="3.9" cy="20.1" r="1.3" {...SOLID} />
      <path d="M2.5 8.5h3.5M4.5 5h3" opacity="0.6" />
    </>
  ),
  blockers: (
    <>
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5v-6z" {...TINT} />
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5v-6z" />
      <path d="M12 6v12.5M7.5 10.5h9" strokeWidth="1.4" opacity="0.8" />
    </>
  ),
  damage: (
    <>
      <path d="M12 2l2 5.4 5.3-2.6-2.4 5.3 5.6 1.9-5.6 1.9 2.4 5.3-5.3-2.6L12 22l-2-5.4-5.3 2.6 2.4-5.3L1.5 12l5.6-1.9-2.4-5.3L10 7.4z" {...TINT} />
      <path d="M12 2l2 5.4 5.3-2.6-2.4 5.3 5.6 1.9-5.6 1.9 2.4 5.3-5.3-2.6L12 22l-2-5.4-5.3 2.6 2.4-5.3L1.5 12l5.6-1.9-2.4-5.3L10 7.4z" />
      <circle cx="12" cy="12" r="2.4" {...SOLID} />
    </>
  ),
  endCombat: (
    <>
      <path d="M10.5 8h3v9L12 19.5 10.5 17z" {...TINT} />
      <path d="M10.5 8h3v9L12 19.5 10.5 17z" />
      <path d="M8 7.5h8M12 3.8v3.7" />
      <circle cx="12" cy="2.8" r="1.2" {...SOLID} />
      <path d="M4 21h16" />
      <path d="M7 18.5l-1.5-1.5M17 18.5l1.5-1.5" opacity="0.6" />
    </>
  ),
  endStep: (
    <>
      <path d="M14.5 4a8.5 8.5 0 1 0 6 13.5A7 7 0 0 1 14.5 4z" {...TINT} />
      <path d="M14.5 4a8.5 8.5 0 1 0 6 13.5A7 7 0 0 1 14.5 4z" />
      <path d="M19 2.5v3.5M17.25 4.25h3.5" strokeWidth="1.4" />
      <circle cx="21" cy="9.5" r="0.9" {...SOLID} />
    </>
  ),
}

export function PhaseGlyph({ glyph, size }: { glyph: LadderGlyph; size: number }) {
  return (
    <svg
      className="phase-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[glyph]}
    </svg>
  )
}
