import { getState, setState } from '../state/state'
import type { SimpleCardView } from '../net/types'

const NEXT_PICK_MS = 700

type Envelope = { type: 'result'; action: string; ok: boolean; error?: string; data?: unknown }

function fail(error: string): Envelope {
  return { type: 'result', action: 'sendCardPick', ok: false, error }
}

export function galleryDraftPick(args: Record<string, unknown>): Envelope {
  const cur = getState().draft
  const cardId = typeof args.cardId === 'string' ? args.cardId : ''
  if (!cur || cur.draftId !== args.draftId) return fail('gallery: no draft')
  const view = cur.message.draftPickView
  const booster = { ...((view?.booster ?? {}) as Record<string, SimpleCardView>) }
  const card = booster[cardId]
  if (!view || !card) return fail('gallery: card not in booster')
  delete booster[cardId]
  const picks = { ...((view.picks ?? {}) as Record<string, SimpleCardView>), [cardId]: card }
  const after = { ...view, booster, picks, picking: false }
  const sentCardNum = cur.message.draftView.cardNum
  setTimeout(() => {
    const now = getState().draft
    if (!now || now.draftId !== cur.draftId || now.message.draftView.cardNum !== sentCardNum) return
    setState({
      lastDraftMethod: 'DRAFT_PICK',
      draft: {
        ...now,
        message: {
          ...now.message,
          draftView: { ...now.message.draftView, cardNum: sentCardNum + 1 },
          draftPickView: { ...after, picking: Object.keys(booster).length > 0 },
        },
      },
    })
  }, NEXT_PICK_MS)
  return { type: 'result', action: 'sendCardPick', ok: true, data: after }
}
