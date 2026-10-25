import { onTestFinished } from 'vitest'

export function captureUnhandledRejections(): unknown[] {
  const reasons: unknown[] = []
  const onReject = (reason: unknown) => {
    reasons.push(reason)
  }
  process.on('unhandledRejection', onReject)
  onTestFinished(() => {
    process.off('unhandledRejection', onReject)
  })
  return reasons
}

export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
