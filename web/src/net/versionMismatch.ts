export interface VersionMismatch {
  proxy: string | null
  server: string | null
}

export function versionMismatchOf(res: { errorCode?: string; error?: string }): VersionMismatch | null {
  const detail = res.error ?? ''
  if (res.errorCode !== 'VERSION_MISMATCH' && !/wrong client version/i.test(detail)) return null
  return {
    proxy: /Your version:\s*([^\s<(]+)/i.exec(detail)?.[1] ?? null,
    server: /Server version:\s*([^\s<(]+)/i.exec(detail)?.[1] ?? null,
  }
}
