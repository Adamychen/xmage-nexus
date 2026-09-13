import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { setState } from '../state/state'
import { doConnect } from '../state/gateway'
import type { ConnectionInfo } from '../state/persistence'
import type { TableView } from '../net/types'
import { t as tStatic } from '../i18n'
import { confirmDialog } from '../ui/confirmDialog'
import { serverLabel } from './deepLink'

const MAX_RETRIES = 10

interface InviteLinkDeps {
  conn: ConnectionInfo | null
  tables: TableView[]
  hasLobby: boolean
  joinHuman: (t: TableView, presetPassword?: string) => void
  watchTable: (t: TableView) => Promise<void>
  setNotice: (n: string | null) => void
}

/**
 * Consume la invitación pendiente de un deep link (#join= / #watch=).
 * - watch → especta directo (sin mazo).
 * - join → abre el diálogo de mazo con la password pre-rellenada.
 * - servidor distinto → confirmación explícita y reconexión (el proxy no cambia).
 * - mesa ausente → reintenta 10s (el broadcast del lobby va desfasado) y avisa.
 */
export function useInviteLink({ conn, tables, hasLobby, joinHuman, watchTable, setNotice }: InviteLinkDeps) {
  const pending = useStore((s) => s.pendingDeepLink)
  const [retry, setRetry] = useState(0)
  const handledRef = useRef<object | null>(null)
  const handledConnRef = useRef<object | null>(null)

  useEffect(() => {
    setRetry(0)
    handledRef.current = null
    handledConnRef.current = null
  }, [pending])

  useEffect(() => {
    if (!pending) return
    if (handledRef.current === pending && handledConnRef.current !== conn) {
      handledRef.current = null
      handledConnRef.current = null
    }
    if (handledRef.current === pending) return
    if (pending.serverRaw && !(pending.serverHost && pending.serverPort)) {
      handledRef.current = pending
      handledConnRef.current = conn
      setNotice(tStatic('lobby', 'invite_bad_server', { server: pending.serverRaw }))
      setState({ pendingDeepLink: null })
      return
    }
    if (pending.serverHost && pending.serverPort && conn
      && (conn.serverHost !== pending.serverHost || conn.port !== pending.serverPort)) {
      handledRef.current = pending
      handledConnRef.current = conn
      const label = serverLabel(pending) ?? ''
      const targetHost = pending.serverHost
      const targetPort = pending.serverPort
      void confirmDialog(tStatic('lobby', 'invite_server_switch', { server: label })).then((ok) => {
        if (!ok) {
          // Rastro visible: antes se descartaba en silencio.
          setNotice(tStatic('lobby', 'invite_cancelled_stay'))
          setState({ pendingDeepLink: null })
          return
        }
        setState({ error: null })
        void doConnect(
          conn.wsHost, conn.proxyPort,
          targetHost, targetPort,
          conn.username, conn.password, conn.flagName, conn.avatarId,
        )
      })
      return
    }
    if (!hasLobby) return
    const table = tables.find((t) => t.tableId === pending.tableId)
    if (!table) {
      if (retry >= MAX_RETRIES) {
        handledRef.current = pending
        setNotice(tStatic('lobby', 'invite_table_not_found'))
        setState({ pendingDeepLink: null })
        return
      }
      // Estado pendiente visible durante los reintentos (antes silencioso).
      if (retry === 0) setNotice(tStatic('lobby', 'invite_searching', { current: retry + 1, total: MAX_RETRIES }))
      const id = window.setTimeout(() => setRetry((r) => r + 1), 1000)
      return () => window.clearTimeout(id)
    }
    handledRef.current = pending
    setState({ pendingDeepLink: null })
    if (pending.kind === 'watch') {
      void watchTable(table)
    } else {
      joinHuman(table, pending.password)
    }
  }, [pending, tables, hasLobby, retry, conn, joinHuman, watchTable, setNotice])
}
