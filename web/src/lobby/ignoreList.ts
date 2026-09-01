import { t } from '../i18n'

const STORAGE_KEY = 'xmage_nexus_ignored_users'

let memoryList: string[] = []

function loadList(): string[] {
  try {
    if (typeof localStorage === 'undefined') return memoryList
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return memoryList
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : memoryList
  } catch {
    return memoryList
  }
}

function saveList(list: string[]): void {
  memoryList = list
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    }
  } catch {
    // ignore
  }
}

export function resetIgnoredUsersForTest(): void {
  memoryList = []
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

export function getIgnoredUsers(): string[] {
  return loadList()
}

export function isUserIgnored(username?: string | null): boolean {
  if (!username) return false
  const list = loadList()
  const lower = username.toLowerCase()
  return list.some((u) => u.toLowerCase() === lower)
}

export function addIgnoredUser(username: string): { ok: boolean; message: string } {
  const trimmed = username.trim()
  if (!trimmed) {
    return { ok: false, message: t('errors', 'generic_error') }
  }
  const list = loadList()
  if (isUserIgnored(trimmed)) {
    return { ok: false, message: `${t('lobby', 'useraction_ignore')}: "${trimmed}"` }
  }
  const updated = [...list, trimmed]
  saveList(updated)
  return {
    ok: true,
    message: `🚫 ${t('lobby', 'useraction_ignore')} "${trimmed}" (${updated.length})`,
  }
}

export function removeIgnoredUser(username: string): { ok: boolean; message: string } {
  const trimmed = username.trim()
  if (!trimmed) {
    return { ok: false, message: t('errors', 'generic_error') }
  }
  const list = loadList()
  const lower = trimmed.toLowerCase()
  if (!list.some((u) => u.toLowerCase() === lower)) {
    return { ok: false, message: `${t('errors', 'generic_error')}: "${trimmed}"` }
  }
  const updated = list.filter((u) => u.toLowerCase() !== lower)
  saveList(updated)
  return {
    ok: true,
    message: `🔓 ${t('lobby', 'useraction_ignore')} "${trimmed}" (${updated.length})`,
  }
}

export function handleIgnoreCommand(text: string): { handled: boolean; message: string } | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/') && !trimmed.startsWith('\\')) {
    return null
  }

  const withoutPrefix = trimmed.substring(1).trim()
  const parts = withoutPrefix.split(/\s+/)
  const command = parts[0].toLowerCase()
  const targetUser = parts.slice(1).join(' ').trim()

  if (command === 'ignore') {
    if (!targetUser) {
      const list = getIgnoredUsers()
      if (list.length === 0) {
        return {
          handled: true,
          message: `ℹ️ ${t('lobby', 'useraction_ignore')}: ${t('decks', 'deck_no_cards')}`,
        }
      }
      return {
        handled: true,
        message: `ℹ️ ${t('lobby', 'useraction_ignore')} (${list.length}): [${list.join(', ')}]`,
      }
    }
    const res = addIgnoredUser(targetUser)
    return { handled: true, message: res.message }
  }

  if (command === 'unignore') {
    if (!targetUser) {
      return {
        handled: true,
        message: `ℹ️ ${t('lobby', 'useraction_ignore')}`,
      }
    }
    const res = removeIgnoredUser(targetUser)
    return { handled: true, message: res.message }
  }

  return null
}
