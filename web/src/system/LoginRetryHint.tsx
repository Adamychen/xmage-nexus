import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'

/** Counts down the wait before the next automatic login retry.
 *
 * The server refuses a login while it still holds the account's previous session
 * ("User ... already connected or your IP address changed"); `gateway.ts` retries with a
 * growing wait, and this line is what turns that silence into "it is working on it". */
export default function LoginRetryHint({ attempt, max, until }: { attempt: number; max: number; until: number }) {
  const { t } = useTranslation()
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((until - Date.now()) / 1000)))

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [until])

  return (
    <p className="connecting-retry-hint" data-testid="login-retry-hint">
      {t('login', 'retrying_session', { s: left, n: attempt, max })}
    </p>
  )
}
