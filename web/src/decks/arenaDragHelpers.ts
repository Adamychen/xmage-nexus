import type React from 'react'
import { t as tStatic } from '../i18n'

/**
 * Creates a high-definition floating card ghost image for Drag & Drop operations.
 */
export function setFloatingCardDragImage(
  e: React.DragEvent,
  imageUrl: string | null,
  cardName: string
) {
  let ghost = document.getElementById('arena-drag-ghost-canvas') as HTMLDivElement | null
  if (!ghost) {
    ghost = document.createElement('div')
    ghost.id = 'arena-drag-ghost-canvas'
    ghost.style.position = 'absolute'
    ghost.style.top = '-9999px'
    ghost.style.left = '-9999px'
    ghost.style.width = '130px'
    ghost.style.height = '182px'
    ghost.style.borderRadius = '8px'
    ghost.style.overflow = 'hidden'
    ghost.style.border = '2px solid #f6e05e'
    ghost.style.boxShadow = '0 16px 36px rgba(0,0,0,0.9), 0 0 24px rgba(246,224,94,0.85)'
    ghost.style.transform = 'rotate(4deg) scale(1.02)'
    ghost.style.zIndex = '999999'
    ghost.style.background = '#111'
    ghost.style.opacity = '0.88'
    ghost.style.pointerEvents = 'none'
    document.body.appendChild(ghost)
  }

  ghost.innerHTML = imageUrl
    ? `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:6px;" />`
    : `<div style="padding:12px;color:#ffffff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#1b2430,#0d1218);text-align:center;border-radius:6px;">${cardName}</div>`

  // Ancla el fantasma cerca de su esquina superior izquierda (no centrado en
  // el cursor): así la carta arrastrada queda por debajo/derecha del puntero
  // en vez de taparlo, dejando visibles los mensajes de "suelta aquí" de la
  // zona de destino mientras el usuario apunta.
  try {
    e.dataTransfer.setDragImage(ghost, 24, 28)
  } catch {}
}

/**
 * Creates a floating card strip ghost image when dragging out of the decklist to remove.
 */
export function setFloatingStripDragImage(
  e: React.DragEvent,
  cardName: string,
  artCropUrl?: string | null
) {
  let ghost = document.getElementById('arena-drag-strip-canvas') as HTMLDivElement | null
  if (!ghost) {
    ghost = document.createElement('div')
    ghost.id = 'arena-drag-strip-canvas'
    ghost.style.position = 'absolute'
    ghost.style.top = '-9999px'
    ghost.style.left = '-9999px'
    ghost.style.width = '240px'
    ghost.style.height = '40px'
    ghost.style.borderRadius = '6px'
    ghost.style.overflow = 'hidden'
    ghost.style.border = '2px solid #fc8181'
    ghost.style.boxShadow = '0 12px 28px rgba(0,0,0,0.85), 0 0 20px rgba(245,101,101,0.7)'
    ghost.style.transform = 'rotate(-3deg)'
    ghost.style.zIndex = '999999'
    ghost.style.background = '#1a202c'
    ghost.style.opacity = '0.9'
    ghost.style.pointerEvents = 'none'
    document.body.appendChild(ghost)
  }

  ghost.innerHTML = `
    <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;padding:0 12px;color:#ffffff;font-weight:800;font-size:13px;background:rgba(25,12,12,0.95);">
      ${artCropUrl ? `<div style="position:absolute;top:0;right:0;bottom:0;width:70%;background-image:url(${artCropUrl});background-size:cover;background-position:center;opacity:0.35;"></div>` : ''}
      <span style="position:relative;z-index:1;display:flex;align-items:center;gap:6px;">
        <span style="font-size:16px;">✕</span> ${tStatic('decks', 'drag_remove', { name: cardName })}
      </span>
    </div>
  `

  // Ancla cerca de la esquina superior izquierda por el mismo motivo que el
  // fantasma de carta: deja el punto de suelta despejado bajo el cursor.
  try {
    e.dataTransfer.setDragImage(ghost, 24, 16)
  } catch {}
}
