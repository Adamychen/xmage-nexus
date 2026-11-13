import type { CardView, PlayerView } from '../net/types'
import { useSettings } from '../state/store'
import { parseCommandList } from './CommandZone'
import { commanderTax } from './commanders'

/** BRD-32: on the own Arena board the uncast commander (and companion) is drawn as the last card
 *  of the hand fan, apart from it. Only with the fanned hand: the hand column and row keep the
 *  command zone on the board. */
export function commanderInHand(settings: { gameUi: string; handRail: boolean; handRow: boolean }): boolean {
  return settings.gameUi !== 'v2' && !settings.handRail && !settings.handRow
}

export interface HandTrailingCard {
  id: string
  card: CardView
  /** Extra mana the next cast costs (commander tax); 0 for a companion or a first cast. */
  tax: number
  companion: boolean
}

export function useHandCommander(player: PlayerView | undefined, enabled: boolean, helperEmblems?: Record<string, CardView>): HandTrailingCard[] {
  const settings = useSettings()
  if (!enabled || !player || !commanderInHand(settings)) return []
  return parseCommandList(player.commandList, { ...(player.helperCards ?? {}), ...(helperEmblems ?? {}) })
    .filter((item) => item.isCommander || item.isCompanion)
    .map((item) => ({
      id: item.id,
      card: item.card,
      tax: item.isCompanion ? 0 : commanderTax(item.castCount),
      companion: !!item.isCompanion,
    }))
}
