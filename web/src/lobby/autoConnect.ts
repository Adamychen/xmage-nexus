export interface AutoConnectParams {
  proxyHost?: string
  proxyPort?: number
  serverHost?: string
  serverPort?: number
  username?: string
  auto: boolean
}

function truthy(raw: string | null): boolean {
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function parsePort(raw: string | null | undefined): number | undefined {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : undefined
}

function splitHostPort(value: string): { host: string; port?: number } {
  const sep = value.lastIndexOf(':')
  if (sep > 0 && /^\d+$/.test(value.slice(sep + 1))) {
    return { host: value.slice(0, sep).trim(), port: parsePort(value.slice(sep + 1)) }
  }
  return { host: value }
}

export function parseAutoConnect(search: string): AutoConnectParams {
  const params = new URLSearchParams(search)
  const out: AutoConnectParams = { auto: truthy(params.get('auto')) }

  const rawProxy = (params.get('proxy') ?? '').trim()
  const urlProxyPort = parsePort(params.get('proxyPort'))
  if (rawProxy.includes('://')) {
    try {
      const url = new URL(rawProxy)
      out.proxyHost = url.toString().replace(/\/$/, '')
      out.proxyPort = urlProxyPort ?? parsePort(url.port)
    } catch {
      out.proxyPort = urlProxyPort
    }
  } else if (rawProxy) {
    const { host, port } = splitHostPort(rawProxy)
    out.proxyHost = host
    out.proxyPort = urlProxyPort ?? port
  } else {
    out.proxyPort = urlProxyPort
  }

  const rawServer = (params.get('server') ?? '').trim()
  const urlServerPort = parsePort(params.get('serverPort'))
  if (rawServer) {
    const { host, port } = splitHostPort(rawServer)
    out.serverHost = host
    out.serverPort = urlServerPort ?? port
  }

  const rawUsername = (params.get('username') ?? '').trim()
  if (rawUsername) out.username = rawUsername

  return out
}

export function guestUsername(rand: () => number = Math.random): string {
  return `guest${Math.floor(rand() * 900000 + 100000)}`
}
