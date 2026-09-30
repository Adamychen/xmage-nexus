export function downloadBlob(blob: Blob, filename: string, revokeMs = 2000): boolean {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return false
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), revokeMs)
    return true
  } catch {
    return false
  }
}
