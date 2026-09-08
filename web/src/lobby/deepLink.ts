export interface DeepLink {
  kind: 'join' | 'watch'
  tableId: string
  password?: string
  serverHost?: string
  serverPort?: number
}

function parseServer(raw: string | null): { serverHost?: string; serverPort?: number } {
  if (!raw) return {}
  const value = raw.trim()
  const sep = value.lastIndexOf(':')
  if (sep <= 0 || sep === value.length - 1) return {}
  const host = value.slice(0, sep).trim()
  const port = Number(value.slice(sep + 1))
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return {}
  return { serverHost: host, serverPort: port }
}

export function parseDeepLink(hash: string): DeepLink | null {
  if (!hash) return null
  let rest = hash.trim()
  if (rest.startsWith('#')) rest = rest.slice(1)
  if (rest.startsWith('/')) rest = rest.slice(1)
  if (!rest) return null

  let kind: DeepLink['kind'] | null = null
  let query = ''
  const slash = rest.match(/^(join|watch)\/([^?]*)(?:\?(.*))?$/i)
  if (slash) {
    kind = slash[1].toLowerCase() as DeepLink['kind']
    const id = safeDecode(slash[2])
    const params = new URLSearchParams(slash[3] ?? '')
    const link = assemble(kind, id, params)
    return link.tableId ? link : null
  }
  const eq = rest.match(/^(join|watch)=/i)
  if (eq) {
    kind = eq[1].toLowerCase() as DeepLink['kind']
    query = rest
  } else if (/^(join|watch)(&|$)/i.test(rest)) {
    return null
  } else {
    return null
  }
  const params = new URLSearchParams(query)
  const id = (params.get('join') ?? params.get('watch') ?? '').trim()
  const link = assemble(kind, id, params)
  return link.tableId ? link : null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value).trim()
  } catch {
    return value.trim()
  }
}

function assemble(
  kind: DeepLink['kind'],
  tableId: string,
  params: URLSearchParams,
): DeepLink {
  const link: DeepLink = { kind, tableId }
  const pwd = params.get('pwd') ?? params.get('password') ?? ''
  if (pwd) link.password = pwd
  const { serverHost, serverPort } = parseServer(params.get('server'))
  if (serverHost && serverPort) {
    link.serverHost = serverHost
    link.serverPort = serverPort
  }
  return link
}

export function buildDeepLink(link: DeepLink): string {
  const params = new URLSearchParams()
  params.set(link.kind, link.tableId)
  if (link.password) params.set('pwd', link.password)
  if (link.serverHost && link.serverPort) params.set('server', `${link.serverHost}:${link.serverPort}`)
  return `#${params.toString()}`
}

export function serverLabel(link: Pick<DeepLink, 'serverHost' | 'serverPort'>): string | null {
  if (!link.serverHost || !link.serverPort) return null
  return `${link.serverHost}:${link.serverPort}`
}
