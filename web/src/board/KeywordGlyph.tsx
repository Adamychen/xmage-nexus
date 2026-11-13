import { createElement, type CSSProperties, type ReactNode } from 'react'
import type { KeywordIconSet } from './cardOverlays'
import { resolveKeywordGlyph, type SolidKeyword } from './glyphs'
import type { GlyphNode } from './glyphs/types'
import { useSettings } from '../state/store'
import './KeywordCoin.css'

const SOLID: Record<SolidKeyword, ReactNode> = {
  haste: <path d="M13.5 1.5 4 13.5h6.5L9 22.5l10-12.5h-6.6z" />,
  deathtouch: (
    <path
      fillRule="evenodd"
      d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 2.8 1.3 4.9 3.2 6.1V20a1.5 1.5 0 0 0 1.5 1.5h.8V19h1.6v2.5h2.8V19H15v2.5h.8a1.5 1.5 0 0 0 1.5-1.5v-3.4c1.9-1.2 3.2-3.3 3.2-6.1A8.5 8.5 0 0 0 12 2zM8.7 9.3a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm6.6 0a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM12 14l1.3 2.4h-2.6z"
    />
  ),
  flying: <path d="M2 19.5C4.5 11 11 5 22 3.5c-.8 2.6-2.4 4.6-4.6 5.9 1.3.2 2.4.1 3.4-.3-1.5 2.8-4 4.6-7 5.2 1 .4 2 .5 3 .4-2.6 3.1-8.2 5.4-14.8 4.8z" />,
  lifelink: <path fillRule="evenodd" d="M12 21.5 3.6 13.3A5.6 5.6 0 0 1 12 5.9a5.6 5.6 0 0 1 8.4 7.4zM11 9v3H8v2h3v3h2v-3h3v-2h-3V9z" />,
  trample: (
    <>
      <path d="M12 11c3.6 0 6.5 3 6.5 6.4 0 2.6-2 4.1-4.2 4.1-.9 0-1.5-.4-2.3-.4s-1.4.4-2.3.4c-2.2 0-4.2-1.5-4.2-4.1C5.5 14 8.4 11 12 11z" />
      <ellipse cx="4.6" cy="9.2" rx="2.1" ry="2.6" transform="rotate(-20 4.6 9.2)" />
      <ellipse cx="9" cy="5" rx="2.1" ry="2.8" />
      <ellipse cx="15" cy="5" rx="2.1" ry="2.8" />
      <ellipse cx="19.4" cy="9.2" rx="2.1" ry="2.6" transform="rotate(20 19.4 9.2)" />
    </>
  ),
  indestructible: <path fillRule="evenodd" d="M12 1.8 3.5 5v6.6c0 5.2 3.6 9 8.5 10.6 4.9-1.6 8.5-5.4 8.5-10.6V5zm0 4.4 4.6 5.8L12 17.8 7.4 12z" />,
  hexproof: (
    <>
      <path fillRule="evenodd" d="M12 5C6.5 5 2.6 9.3 1.5 12c1.1 2.7 5 7 10.5 7s9.4-4.3 10.5-7C21.4 9.3 17.5 5 12 5zm0 3.3a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4z" />
      <path d="M4 3.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
}

const OUTLINE: Record<SolidKeyword, ReactNode> = {
  haste: <path d="M13.5 2 4.5 13.5h6.5L10 22l9.5-12H13z" />,
  deathtouch: (
    <>
      <path d="M7 16.6C5 15.4 3.7 13.3 3.7 10.5a8.3 8.3 0 0 1 16.6 0c0 2.8-1.3 4.9-3.3 6.1V20a1.2 1.2 0 0 1-1.2 1.2H8.2A1.2 1.2 0 0 1 7 20z" />
      <circle cx="8.8" cy="11" r="1.7" />
      <circle cx="15.2" cy="11" r="1.7" />
      <path d="M10 21v-2.5M14 21v-2.5" />
    </>
  ),
  flying: (
    <>
      <path d="M2.5 19C5 11 11 5.5 21.5 4c-.8 2.5-2.5 4.4-4.6 5.6 1.2.2 2.3.1 3.2-.2-1.5 2.7-4 4.4-6.9 5-2.7 3-6.5 4.6-10.7 4.6z" />
      <path d="M8 14.5c2-1.8 4.6-3.3 7.5-4" />
    </>
  ),
  lifelink: (
    <>
      <path d="M12 21 4 13.2A5.3 5.3 0 0 1 12 6.4a5.3 5.3 0 0 1 8 6.8z" />
      <path d="M12 10v6M9 13h6" />
    </>
  ),
  trample: (
    <>
      <path d="M12 11.5c3.3 0 6 2.8 6 5.9 0 2.3-1.8 3.6-3.8 3.6-.8 0-1.4-.4-2.2-.4s-1.4.4-2.2.4c-2 0-3.8-1.3-3.8-3.6 0-3.1 2.7-5.9 6-5.9z" />
      <ellipse cx="4.8" cy="9.3" rx="1.7" ry="2.2" transform="rotate(-20 4.8 9.3)" />
      <ellipse cx="9.1" cy="5.2" rx="1.7" ry="2.4" />
      <ellipse cx="14.9" cy="5.2" rx="1.7" ry="2.4" />
      <ellipse cx="19.2" cy="9.3" rx="1.7" ry="2.2" transform="rotate(20 19.2 9.3)" />
    </>
  ),
  indestructible: (
    <>
      <path d="M12 2.2 4 5.2v6.4c0 5 3.4 8.6 8 10.1 4.6-1.5 8-5.1 8-10.1V5.2z" />
      <path d="m12 7.2 3.9 4.8-3.9 4.8L8.1 12z" />
    </>
  ),
  hexproof: (
    <>
      <path d="M2 12c1.2-2.6 5-6.5 10-6.5S20.8 9.4 22 12c-1.2 2.6-5 6.5-10 6.5S3.2 14.6 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 3.5 20 20.5" />
    </>
  ),
}

function camelAttr(name: string): string {
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function renderNode([tag, attrs]: GlyphNode, index: number) {
  const props: Record<string, string | number> = { key: index }
  for (const [name, value] of Object.entries(attrs)) props[camelAttr(name)] = value
  return createElement(tag, props)
}

const STROKE_PROPS = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export default function KeywordGlyph({ id, category, set }: { id: string; category: string; set: KeywordIconSet }) {
  const spec = resolveKeywordGlyph(id, category)
  if (spec.kind === 'abbr') return <span className="kw-coin-abbr" aria-hidden="true">{spec.text}</span>
  if (spec.kind === 'nodes' || spec.kind === 'fallback') return <svg {...STROKE_PROPS}>{spec.nodes.map(renderNode)}</svg>
  return set === 'outline' ? (
    <svg {...STROKE_PROPS}>{OUTLINE[spec.id]}</svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {SOLID[spec.id]}
    </svg>
  )
}

export function KeywordCoin({ id, category, size, set, className }: { id: string; category: string; size?: number; set?: KeywordIconSet; className?: string }) {
  const settings = useSettings()
  const iconSet = set ?? settings.keywordIcons
  return (
    <span
      className={`kw-coin icons-${iconSet} cat-${category} kw-${id}${className ? ` ${className}` : ''}`}
      style={size ? ({ '--kw-size': `${size}px` } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      <KeywordGlyph id={id} category={category} set={iconSet} />
    </span>
  )
}
