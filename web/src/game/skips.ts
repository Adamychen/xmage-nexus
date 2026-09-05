export interface SkipDef {
  key: 'turn' | 'endStep' | 'nextMain' | 'myTurn' | 'stack' | 'beforeMine'
  action: string
  shortcut: 'F4' | 'F5' | 'F7' | 'F9' | 'F10' | 'F11'
  flag: 'passedTurn' | 'passedUntilEndOfTurn' | 'passedUntilNextMain' | 'passedAllTurns' | 'passedUntilStackResolved' | 'passedUntilEndStepBeforeMyTurn'
  labelKey: 'skip_turn' | 'skip_end_step' | 'skip_next_main' | 'skip_my_turn' | 'skip_stack' | 'skip_before_mine'
}

export const CANCEL_SKIP_ACTION = 'PASS_PRIORITY_CANCEL_ALL_ACTIONS'
export const CANCEL_SKIP_SHORTCUT = 'F3'

export const SKIPS: SkipDef[] = [
  { key: 'turn', action: 'PASS_PRIORITY_UNTIL_NEXT_TURN', shortcut: 'F4', flag: 'passedTurn', labelKey: 'skip_turn' },
  { key: 'endStep', action: 'PASS_PRIORITY_UNTIL_TURN_END_STEP', shortcut: 'F5', flag: 'passedUntilEndOfTurn', labelKey: 'skip_end_step' },
  { key: 'nextMain', action: 'PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE', shortcut: 'F7', flag: 'passedUntilNextMain', labelKey: 'skip_next_main' },
  { key: 'myTurn', action: 'PASS_PRIORITY_UNTIL_MY_NEXT_TURN', shortcut: 'F9', flag: 'passedAllTurns', labelKey: 'skip_my_turn' },
  { key: 'stack', action: 'PASS_PRIORITY_UNTIL_STACK_RESOLVED', shortcut: 'F10', flag: 'passedUntilStackResolved', labelKey: 'skip_stack' },
  { key: 'beforeMine', action: 'PASS_PRIORITY_UNTIL_END_STEP_BEFORE_MY_NEXT_TURN', shortcut: 'F11', flag: 'passedUntilEndStepBeforeMyTurn', labelKey: 'skip_before_mine' },
]

export function skipForShortcut(shortcut: string): SkipDef | undefined {
  return SKIPS.find((s) => s.shortcut === shortcut)
}

export function activeSkipOf(me: Partial<Record<SkipDef['flag'], unknown>> | null | undefined): SkipDef | null {
  if (!me) return null
  return SKIPS.find((s) => me[s.flag] === true) ?? null
}
