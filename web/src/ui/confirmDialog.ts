import { t as tStatic } from '../i18n'

export interface ConfirmOptions {
  title?: string
  okLabel?: string
  cancelLabel?: string
  danger?: boolean
  hideCancel?: boolean
}

export interface ConfirmRequest extends Required<Pick<ConfirmOptions, 'title' | 'okLabel' | 'cancelLabel' | 'danger' | 'hideCancel'>> {
  id: number
  message: string
  resolve: (ok: boolean) => void
}

type Listener = () => void

let seq = 0
let queue: ConfirmRequest[] = []
const listeners = new Set<Listener>()

function emit() {
  for (const l of [...listeners]) l()
}

export function subscribeConfirm(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getConfirmQueue(): ConfirmRequest[] {
  return queue
}

function push(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [
      ...queue,
      {
        id: ++seq,
        message,
        title: opts.title ?? tStatic('common', 'confirm'),
        okLabel: opts.okLabel ?? tStatic('common', 'confirm'),
        cancelLabel: opts.cancelLabel ?? tStatic('common', 'cancel'),
        danger: opts.danger ?? false,
        hideCancel: opts.hideCancel ?? false,
        resolve,
      },
    ]
    emit()
  })
}

function settle(id: number, ok: boolean) {
  const req = queue.find((r) => r.id === id)
  if (!req) return
  queue = queue.filter((r) => r.id !== id)
  emit()
  req.resolve(ok)
}

export function resolveConfirm(id: number, ok: boolean) {
  settle(id, ok)
}

export function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return push(message, opts)
}

export function alertDialog(message: string, opts: Omit<ConfirmOptions, 'hideCancel'> = {}): Promise<void> {
  return push(message, { ...opts, hideCancel: true }).then(() => undefined)
}
