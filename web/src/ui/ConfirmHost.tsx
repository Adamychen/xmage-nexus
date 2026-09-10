import { useSyncExternalStore } from 'react'
import ConfirmModal from './ConfirmModal'
import { getConfirmQueue, subscribeConfirm } from './confirmDialog'

export default function ConfirmHost() {
  const queue = useSyncExternalStore(subscribeConfirm, getConfirmQueue)
  const request = queue[0] ?? null
  if (!request) return null
  return <ConfirmModal key={request.id} request={request} />
}
