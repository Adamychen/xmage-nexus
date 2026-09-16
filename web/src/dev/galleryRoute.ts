export const GALLERY_HASH = '#/gallery'

export function isGalleryHash(hash: string): boolean {
  return /^#\/gallery\b/.test(hash)
}
