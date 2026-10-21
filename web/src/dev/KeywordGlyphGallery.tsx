import { MTG_KEYWORDS } from '../data/mtgKeywords'
import { KeywordCoin } from '../board/KeywordGlyph'
import { resolveKeywordGlyph } from '../board/glyphs'
import './KeywordGlyphGallery.css'

export default function KeywordGlyphGallery() {
  return (
    <div className="kw-gallery" data-testid="keyword-glyph-gallery">
      {MTG_KEYWORDS.map((kw) => (
        <div key={kw.id} className="kw-gallery-cell" data-kind={resolveKeywordGlyph(kw.id, kw.category).kind}>
          <KeywordCoin id={kw.id} category={kw.category} size={40} />
          <KeywordCoin id={kw.id} category={kw.category} size={14} />
          <span className="kw-gallery-id">{kw.id}</span>
        </div>
      ))}
    </div>
  )
}
