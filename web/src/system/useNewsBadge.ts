import { useCallback, useEffect, useMemo, useState } from 'react'
import { getNews, hasUnseenNews, loadNewsCache } from './news'

export function useNewsBadge(): { unseen: boolean; refresh: () => void } {
  const [tick, setTick] = useState(0)
  const unseen = useMemo(
    () => hasUnseenNews(loadNewsCache()?.releases ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  )
  const refresh = useCallback(() => {
    void getNews().then(({ releases }) => {
      if (releases.length > 0) setTick((t) => t + 1)
    })
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { unseen, refresh }
}
