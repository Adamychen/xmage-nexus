import type { GameView } from '../net/types.generated'
import type { PrioritySoundMode } from './prioritySound'
import { soundManager } from './soundManager'

export function dispatchGameSounds(
  prevGame: GameView | null,
  nextGame: GameView | null,
  method: string | undefined,
  prioritySound: PrioritySoundMode,
) {
  if (!nextGame) return

  const prevMe = prevGame?.players?.find((p) => p.controlled)
  const nextMe = nextGame.players?.find((p) => p.controlled)
  // A priority window opens with the prompt frame itself: the server sets the
  // priority player before it sends the ask (HumanPlayer.prepareForResponse), so
  // a GAME_SELECT carries the view where my `hasPriority` already flipped.
  const gainedPriority = !!prevGame && !prevMe?.hasPriority && nextMe?.hasPriority === true

  if (prioritySound === 'every-prompt') {
    if (method === 'GAME_SELECT' || gainedPriority) soundManager.play('priority', 'game')
  } else if (prioritySound === 'on-gain' && gainedPriority) {
    soundManager.play('priority', 'game')
  }

  if (!prevGame) return

  const prevStack = Object.keys(prevGame.stack ?? {}).length
  const nextStack = Object.keys(nextGame.stack ?? {}).length
  if (nextStack > prevStack) {
    soundManager.play('stack_cast', 'game')
  }

  const countTapped = (g: GameView | null) =>
    (g?.players ?? []).reduce(
      (acc, p) => acc + Object.values(p.battlefield ?? {}).filter((c) => c.tapped).length,
      0,
    )

  if (countTapped(nextGame) > countTapped(prevGame)) {
    soundManager.play('tap', 'game')
  }

  const countBf = (g: GameView | null) =>
    (g?.players ?? []).reduce((acc, p) => acc + Object.keys(p.battlefield ?? {}).length, 0)

  if (countBf(nextGame) > countBf(prevGame)) {
    soundManager.play('play_card', 'game')
  }

  const countHandCards = (g: GameView | null) => {
    if (!g) return 0
    let total = Object.keys(g.myHand ?? {}).length
    for (const p of g.players ?? []) {
      if (!p.controlled && typeof p.handCount === 'number') {
        total += p.handCount
      }
    }
    return total
  }

  if (countHandCards(nextGame) > countHandCards(prevGame)) {
    soundManager.play('draw', 'game')
  }

  if (prevMe && nextMe && typeof prevMe.life === 'number' && typeof nextMe.life === 'number') {
    if (nextMe.life < prevMe.life) {
      const combatDamage = nextGame.step === 'COMBAT_DAMAGE' || nextGame.step === 'FIRST_COMBAT_DAMAGE'
      if (!combatDamage) soundManager.play('life_loss', 'game')
    } else if (nextMe.life > prevMe.life) {
      soundManager.play('life_gain', 'game')
    }
  }

  const countGrave = (g: GameView | null) =>
    (g?.players ?? []).reduce((acc, p) => acc + Object.keys(p.graveyard ?? {}).length, 0)

  if (countGrave(nextGame) > countGrave(prevGame)) {
    soundManager.play('destroy', 'game')
  }
}
