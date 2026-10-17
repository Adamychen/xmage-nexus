import { useCallback, useEffect, useState } from 'react'

export function useChangeFlag<T>(value: T, settleMs = 1000): [boolean, () => void] {
  const [seen, setSeen] = useState(value)
  const [flagged, setFlagged] = useState(false)
  if (!Object.is(seen, value)) {
    setSeen(value)
    setFlagged(true)
  }
  const clear = useCallback(() => setFlagged(false), [])
  useEffect(() => {
    if (!flagged) return
    const id = setTimeout(clear, settleMs)
    return () => clearTimeout(id)
  }, [seen, flagged, clear, settleMs])
  return [flagged, clear]
}
