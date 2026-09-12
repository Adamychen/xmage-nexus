import { useState } from 'react'
import { useStore } from '../state/store'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import { buildDeepLink } from './deepLink'

/** Botones "copiar enlace de invitación" (join + watch) para la sala de espera. */
export default function InviteLinkButton({ tableId }: { tableId: string | undefined }) {
  const { t } = useTranslation()
  const conn = useStore((s) => s.conn)
  const [copied, setCopied] = useState<'join' | 'watch' | null>(null)
  const [copyFailed, setCopyFailed] = useState<'join' | 'watch' | null>(null)
  if (!tableId) return null

  const copy = async (kind: 'join' | 'watch') => {
    const url = `${window.location.origin}${window.location.pathname}${buildDeepLink({
      kind,
      tableId,
      serverHost: conn?.serverHost,
      serverPort: conn?.port,
    })}`
    let ok = false
    try {
      await navigator.clipboard.writeText(url)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopyFailed((cur) => (cur === kind ? null : cur))
      setCopied(kind)
    } else {
      setCopied((cur) => (cur === kind ? null : cur))
      setCopyFailed(kind)
    }
    window.setTimeout(() => {
      setCopied((cur) => (cur === kind ? null : cur))
      setCopyFailed((cur) => (cur === kind ? null : cur))
    }, 2500)
  }

  const render = (kind: 'join' | 'watch') => (
    <button
      key={kind}
      type="button"
      className="staging-tag tag-invite"
      data-testid={`invite-copy-${kind}`}
      title={t('lobby', kind === 'join' ? 'invite_copy_join' : 'invite_copy_watch')}
      onClick={() => void copy(kind)}
    >
      <Icon name={copied === kind ? 'check' : 'copy'} size={12} />{' '}
      {copied === kind
        ? t('lobby', 'invite_copied')
        : copyFailed === kind
          ? t('lobby', 'invite_copy_failed')
          : t('lobby', kind === 'join' ? 'invite_copy_join' : 'invite_copy_watch')}
    </button>
  )

  return (
    <>
      {render('join')}
      {render('watch')}
    </>
  )
}
