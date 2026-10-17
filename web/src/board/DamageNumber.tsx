import { useEffect, useRef, useSyncExternalStore } from 'react'
import { fxDuration, fxEnabled } from './fx'
import './DamageNumber.css'

export const DAMAGE_NUMBER_MS = 700
const MAX_PER_TARGET = 4

export interface DamageNumberItem {
  id: number
  amount: number
}

const EMPTY: DamageNumberItem[] = []
const itemsByTarget = new Map<string, DamageNumberItem[]>()
const listeners = new Set<() => void>()
let counter = 0

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function spawnDamageNumber(targetKey: string, amount: number): void {
  if (amount <= 0 || !fxEnabled()) return
  const item: DamageNumberItem = { id: ++counter, amount }
  const current = itemsByTarget.get(targetKey) ?? EMPTY
  itemsByTarget.set(targetKey, [...current, item].slice(-MAX_PER_TARGET))
  notify()
}

export function damageNumbersFor(targetKey: string): DamageNumberItem[] {
  return itemsByTarget.get(targetKey) ?? EMPTY
}

export function dismissDamageNumber(targetKey: string, id: number): void {
  const current = itemsByTarget.get(targetKey)
  if (!current?.some((item) => item.id === id)) return
  const next = current.filter((item) => item.id !== id)
  if (next.length === 0) itemsByTarget.delete(targetKey)
  else itemsByTarget.set(targetKey, next)
  notify()
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function useDamageNumbers(targetKey: string): DamageNumberItem[] {
  return useSyncExternalStore(subscribe, () => itemsByTarget.get(targetKey) ?? EMPTY, () => EMPTY)
}

export function DamageNumber({ amount, onDone }: { amount: number; onDone: () => void }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), fxDuration(DAMAGE_NUMBER_MS))
    return () => clearTimeout(timer)
  }, [])

  return (
    <span
      className="damage-number"
      aria-hidden="true"
      onAnimationEnd={() => doneRef.current()}
    >
      {`-${amount}`}
    </span>
  )
}

export function DamageNumbers({ targetKey }: { targetKey: string }) {
  const items = useDamageNumbers(targetKey)
  if (items.length === 0) return null
  return (
    <>
      {items.map((item) => (
        <DamageNumber
          key={item.id}
          amount={item.amount}
          onDone={() => dismissDamageNumber(targetKey, item.id)}
        />
      ))}
    </>
  )
}
