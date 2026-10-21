export type GlyphTag = 'path' | 'circle' | 'ellipse' | 'rect' | 'line' | 'polyline' | 'polygon'

export type GlyphNode = readonly [tag: GlyphTag, attrs: Readonly<Record<string, string | number>>]

export type Glyph = readonly GlyphNode[]

export interface GlyphGroup {
  glyphs: Readonly<Record<string, Glyph>>
  abbreviations: Readonly<Record<string, string>>
}
