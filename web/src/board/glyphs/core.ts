import type { Glyph, GlyphGroup } from './types'

const SHIELD = 'M12 2.5 4.5 5.5v6c0 4.7 3.2 8.2 7.5 9.8 4.3-1.6 7.5-5.1 7.5-9.8v-6z'

export const group: GlyphGroup = {
  glyphs: {
    first_strike: [
      ['path', { d: 'M20 4 9 15' }],
      ['path', { d: 'M20 4v5M20 4h-5' }],
      ['path', { d: 'm7 13 4 4M7 17l-3 3' }],
    ],
    double_strike: [
      ['path', { d: 'M4 4l11 11M20 4 9 15' }],
      ['path', { d: 'm13 17 4-4M7 13l4 4' }],
    ],
    vigilance: [
      ['path', { d: 'M2 12c1.2-2.6 5-6.5 10-6.5S20.8 9.4 22 12c-1.2 2.6-5 6.5-10 6.5S3.2 14.6 2 12z' }],
      ['circle', { cx: 12, cy: 12, r: 3 }],
    ],
    menace: [
      ['circle', { cx: 8, cy: 8, r: 2.6 }],
      ['circle', { cx: 16, cy: 8, r: 2.6 }],
      ['path', { d: 'M3 20c0-3 2.2-5 5-5s5 2 5 5M11 20c0-3 2.2-5 5-5s5 2 5 5' }],
    ],
    reach: [['path', { d: 'M12 21V4M6 10l6-6 6 6' }]],
    defender: [['path', { d: 'M5 20h14M7 20V10h10v10M7 10V5h2v2h2V5h2v2h2V5h2v5' }]],
    ward: [
      ['path', { d: SHIELD }],
      ['path', { d: 'm9 12 2.2 2.2L15.5 10' }],
    ],
    protection: [
      ['path', { d: SHIELD }],
      ['path', { d: 'M12 6.5v12' }],
    ],
    shroud: [['path', { d: 'M7 18a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.7 1.2A3.4 3.4 0 0 1 17 18z' }]],
    infect: [
      ['path', { d: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3' }],
      ['path', { d: 'M7.5 15h9' }],
    ],
    prowess: [['path', { d: 'm12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z' }]],
    mutate: [
      ['path', { d: 'M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9' }],
      ['path', { d: 'M9.5 7h5M9.5 17h5' }],
    ],
    landwalk: [['path', { d: 'M3 19 10 6l4 7 3-4 4 10z' }]],
  },
  abbreviations: {},
}

export const fallbacks: Readonly<Record<'evasion' | 'combat' | 'protection', Glyph>> = {
  evasion: [['path', { d: 'M3 12h13M12 6l6 6-6 6' }]],
  combat: [['path', { d: 'm6 14 6-6 6 6M6 20l6-6 6 6' }]],
  protection: [['path', { d: SHIELD }]],
}
