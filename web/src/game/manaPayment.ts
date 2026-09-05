import type { ManaPaymentStored } from '../state/persistence'

export type ManaPaymentAction =
  | 'MANA_AUTO_PAYMENT_ON'
  | 'MANA_AUTO_PAYMENT_OFF'
  | 'MANA_AUTO_PAYMENT_RESTRICTED_ON'
  | 'MANA_AUTO_PAYMENT_RESTRICTED_OFF'
  | 'USE_FIRST_MANA_ABILITY_ON'
  | 'USE_FIRST_MANA_ABILITY_OFF'

export function manaPaymentActions(mana: ManaPaymentStored): ManaPaymentAction[] {
  return [
    mana.auto ? 'MANA_AUTO_PAYMENT_ON' : 'MANA_AUTO_PAYMENT_OFF',
    mana.restricted ? 'MANA_AUTO_PAYMENT_RESTRICTED_ON' : 'MANA_AUTO_PAYMENT_RESTRICTED_OFF',
    mana.useFirstAbility ? 'USE_FIRST_MANA_ABILITY_ON' : 'USE_FIRST_MANA_ABILITY_OFF',
  ]
}

export type PoolKey = 'white' | 'blue' | 'black' | 'red' | 'green' | 'colorless'

const POOL_TO_MANA_TYPE: Record<PoolKey, string> = {
  white: 'WHITE',
  blue: 'BLUE',
  black: 'BLACK',
  red: 'RED',
  green: 'GREEN',
  colorless: 'COLORLESS',
}

export function manaTypeOf(poolKey: string): string | null {
  return (POOL_TO_MANA_TYPE as Record<string, string>)[poolKey] ?? null
}

export function poolTotal(pool: Partial<Record<PoolKey, number>> | null | undefined): number {
  if (!pool || typeof pool !== 'object') return 0
  return (Object.keys(POOL_TO_MANA_TYPE) as PoolKey[]).reduce((sum, key) => sum + (pool[key] ?? 0), 0)
}

export function shouldConfirmEmptyPool(pool: Partial<Record<PoolKey, number>> | null | undefined, mana: ManaPaymentStored): boolean {
  return mana.confirmEmptyPool && poolTotal(pool) > 0
}
