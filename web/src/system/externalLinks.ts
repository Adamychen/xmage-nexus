type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

function tauriInvoke(): TauriInvoke | null {
  const tauri = (window as unknown as { __TAURI__?: { core?: { invoke?: TauriInvoke } } }).__TAURI__
  return tauri?.core?.invoke ?? null
}

export function externalHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const anchor = target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement)) return null
  if (!/^(https?:|mailto:|tel:)/i.test(anchor.href)) return null
  if (anchor.target !== '_blank' && new URL(anchor.href).origin === window.location.origin) return null
  return anchor.href
}

export function installExternalLinks(): void {
  const invoke = tauriInvoke()
  if (!invoke) return
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    const href = externalHref(event.target)
    if (!href) return
    event.preventDefault()
    void invoke('plugin:opener|open_url', { url: href }).catch((err) => console.error('open_url failed', err))
  })
}
