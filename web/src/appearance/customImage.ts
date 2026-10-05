import { useSyncExternalStore } from 'react'

export const CUSTOM_IMAGE_MAX_FILE_BYTES = 15 * 1024 * 1024

export type ImageFit =
  | { mode: 'cover'; width: number; height: number }
  | { mode: 'contain'; maxWidth: number; maxHeight: number }

export interface CustomImageStore {
  key: string
  get(): string | null
  set(dataUrl: string): void
  clear(): void
  use(): string | null
  fromFile(file: File): Promise<string>
}

export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const target = dstW / dstH
  const ratio = srcW / srcH
  if (ratio > target) {
    const w = srcH * target
    return { sx: (srcW - w) / 2, sy: 0, sw: w, sh: srcH }
  }
  const h = srcW / target
  return { sx: 0, sy: (srcH - h) / 2, sw: srcW, sh: h }
}

export function containSize(srcW: number, srcH: number, maxW: number, maxH: number) {
  const scale = Math.min(1, maxW / srcW, maxH / srcH)
  return { width: Math.max(1, Math.round(srcW * scale)), height: Math.max(1, Math.round(srcH * scale)) }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

export async function fileToImageDataUrl(file: File, fit: ImageFit, quality: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  if (file.size > CUSTOM_IMAGE_MAX_FILE_BYTES) throw new Error('file too large')
  const img = await loadImage(file)
  const srcW = img.naturalWidth
  const srcH = img.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.imageSmoothingQuality = 'high'
  if (fit.mode === 'cover') {
    canvas.width = fit.width
    canvas.height = fit.height
    const { sx, sy, sw, sh } = coverCrop(srcW, srcH, fit.width, fit.height)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, fit.width, fit.height)
  } else {
    const { width, height } = containSize(srcW, srcH, fit.maxWidth, fit.maxHeight)
    canvas.width = width
    canvas.height = height
    ctx.drawImage(img, 0, 0, width, height)
  }
  return canvas.toDataURL('image/jpeg', quality)
}

export function createCustomImageStore(key: string, fit: ImageFit, quality: number): CustomImageStore {
  const listeners = new Set<() => void>()
  let cached: string | null | undefined

  const read = (): string | null => {
    try {
      const v = localStorage.getItem(key)
      return v && v.startsWith('data:image/') ? v : null
    } catch {
      return null
    }
  }

  const emit = () => { for (const l of listeners) l() }

  const get = () => {
    if (cached === undefined) cached = read()
    return cached
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== key) return
      cached = read()
      listener()
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
  }

  return {
    key,
    get,
    set(dataUrl) {
      if (!dataUrl.startsWith('data:image/')) throw new Error('invalid image')
      localStorage.setItem(key, dataUrl)
      cached = dataUrl
      emit()
    },
    clear() {
      try { localStorage.removeItem(key) } catch {}
      cached = null
      emit()
    },
    use: () => useSyncExternalStore(subscribe, get, () => null),
    fromFile: (file) => fileToImageDataUrl(file, fit, quality),
  }
}
