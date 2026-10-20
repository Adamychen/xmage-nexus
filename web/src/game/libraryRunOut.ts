import { useEffect, useRef, useState } from 'react'

export const LIBRARY_LOW_AT = 3
export const LIBRARY_CRACK_MS = 1300

export type LibraryLevel = 'ok' | 'low' | 'empty'

export function libraryLevel(count: number | undefined): LibraryLevel {
  if (typeof count !== 'number') return 'ok'
  if (count <= 0) return 'empty'
  return count <= LIBRARY_LOW_AT ? 'low' : 'ok'
}

/** The library went from having cards to having none between two views; the first value seen never counts. */
export function libraryRanOut(before: number | null | undefined, now: number | undefined): boolean {
  return typeof before === 'number' && typeof now === 'number' && before > 0 && now <= 0
}

/** Class names for a library pile or chip: a steady red state at three cards or fewer, and a crack when it empties. */
export function useLibraryRunOut(count: number | undefined): string {
  const previous = useRef<number | undefined | null>(null)
  const [cracking, setCracking] = useState(false)

  useEffect(() => {
    const before = previous.current
    previous.current = count
    if (!libraryRanOut(before, count)) return
    setCracking(true)
    const timer = setTimeout(() => setCracking(false), LIBRARY_CRACK_MS)
    return () => clearTimeout(timer)
  }, [count])

  const level = libraryLevel(count)
  return [level === 'ok' ? '' : `library-${level}`, cracking ? 'library-cracking' : ''].filter(Boolean).join(' ')
}
